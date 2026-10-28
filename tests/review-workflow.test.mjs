import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import test from "node:test";

const directory = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(directory, "..");
const runtimePath = process.env.PI_SUBAGENTS_RUNTIME ?? path.join(packageRoot, "node_modules/@tintinweb/pi-subagents/dist/workflow/runtime.js");
const { runWorkflow } = await import(pathToFileURL(runtimePath).href);
const script = readFileSync(path.join(directory, "../workflows/review.js"), "utf8");
const questions = ["product", "system-fit", "simplicity", "readability", "correctness"];

function fixture(options = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), "review-workflow-"));
  const skillRoot = path.join(root, "skills/review");
  const repository = path.join(root, "repository");
  const artifacts = path.join(root, "artifacts with 'quotes'");
  mkdirSync(path.join(skillRoot, "rules"), { recursive: true });
  writeFileSync(path.join(skillRoot, "SKILL.md"), readFileSync(path.join(packageRoot, "skills/review/SKILL.md")));
  mkdirSync(path.join(skillRoot, "scripts"));
  for (const name of ["github_approval.py", "github_progress.py"]) {
    writeFileSync(path.join(skillRoot, "scripts", name), readFileSync(path.join(packageRoot, "skills/review/scripts", name)));
  }
  mkdirSync(repository);
  const git = (...args) => execFileSync("git", ["-c", "core.hooksPath=/dev/null", ...args], { cwd: repository, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "--quiet");
  writeFileSync(path.join(repository, "example.ts"), "export const value = 1;\n");
  git("add", "example.ts");
  git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--quiet", "-m", "base");
  const base = git("rev-parse", "HEAD");
  writeFileSync(path.join(repository, "added.ts"), "export {};\n".repeat(options.addedLines ?? 1));
  git("add", "added.ts");
  git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--quiet", "-m", "change");
  const head = git("rev-parse", "HEAD");
  const rulePaths = ["await", "cleanup"].map(name => path.join(skillRoot, "rules", `${name}.md`));
  writeFileSync(path.join(skillRoot, "rules/README.md"), rulePaths.map(file => `[Rule](${path.basename(file)})`).join("\n"));
  rulePaths.forEach(file => writeFileSync(file, "Inspect the relevant operation."));
  const args = {
    workflowEnabled: true, packageRoot, repository, target: "fixture/app#1", skillRoot,
    base, head, artifacts, supportRoot: path.join(packageRoot, "scripts/review"),
    publication: options.publication ?? { mode: "local" }, contextFiles: [],
    runId: "fixture-run", invocationId: "invocation-one", notification: options.notify ? { destination: "review-progress", messageKey: "fixture-run" } : null,
  };
  if (options.wrapper) {
    const wrapper = path.join(root, "skills/wrapper");
    mkdirSync(path.join(wrapper, "rules"), { recursive: true });
    const file = path.join(wrapper, "rules/ownership.md");
    writeFileSync(file, "Trace the wrapper ownership boundary.");
    writeFileSync(path.join(wrapper, "rules/README.md"), "[Ownership](ownership.md)");
    rulePaths.push(file);
    args.wrapperSkillRoots = [wrapper];
  }
  const calls = [];
  const instructions = new Map();
  let bundle;
  const checks = name => [{
    guidance: `fixture/${name}#behaviour@v1`, item: `${name} observable behaviour`,
    method: "source inspection", result: "Source checked", evidence: ["example.ts:4"], reason: "Traced the affected caller.",
  }];
  const host = {
    abortAgent() {},
    async spawnAgent(request) {
      calls.push(request.label);
      if (options.hold) await options.hold(request);
      if (request.label.startsWith("notify:")) {
        return { ok: true, text: JSON.stringify({ status: options.notificationStatus ?? "confirmed", reason: "Fixture receipt, no external delivery." }) };
      }
      if (request.label === "save-artefacts") {
        bundle = JSON.parse(request.prompt.split("\n").at(-1));
        mkdirSync(artifacts, { recursive: true });
        writeFileSync(path.join(artifacts, "bundle.json"), JSON.stringify(bundle));
        for (const [name, result] of Object.entries(bundle.stages)) {
          writeFileSync(path.join(artifacts, `${name}.md`), result.markdown);
        }
        if (bundle.status === "incomplete") writeFileSync(path.join(artifacts, "incomplete.md"), JSON.stringify(bundle.failures));
        else writeFileSync(path.join(artifacts, "review-report.md"), (bundle.stages.report ?? bundle.stages["split-plan"]).markdown);
        const savedResult = request.prompt.split("\n").map(line => {
          try { return JSON.parse(line); } catch { return null; }
        }).find(value => value?.fingerprint && value.status);
        writeFileSync(path.join(artifacts, "result.json"), JSON.stringify(savedResult));
        if (bundle.stages.decision) {
          writeFileSync(path.join(artifacts, "approval.json"), JSON.stringify(bundle.stages.decision.approval));
          writeFileSync(path.join(artifacts, "summary.md"), bundle.stages.decision.summaryMarkdown);
          writeFileSync(path.join(artifacts, "inline.json"), JSON.stringify(bundle.stages.decision.inlineComments));
        }
        options.corrupt?.(bundle, artifacts);
        return { ok: true, text: JSON.stringify({ saved: true }) };
      }
      if (request.label === "publication") {
        if (options.failPublication) return { ok: false, error: "Publication confirmation unavailable" };
        const published = spawnSync("python3", [path.join(packageRoot, "scripts/review/publication.py"), "finish", path.join(artifacts, "bundle.json")], { encoding: "utf8" });
        if (published.status !== 0) return { ok: false, error: published.stdout + published.stderr };
        return { ok: true, text: JSON.stringify({ status: "rendered", reason: "Actual helper rendered dry-run payload" }) };
      }
      const [name, attempt] = request.label.split(":");
      const assigned = request.prompt.match(/^Assigned instructions: (.+)$/m)?.[1];
      assert.ok(assigned, `Missing assigned instructions for ${name}`);
      const [instructionFile, anchor] = assigned.split("#");
      const content = readFileSync(instructionFile, "utf8");
      assert.ok(content.trim(), `Empty assigned instructions for ${name}`);
      if (anchor) {
        const anchors = [...content.matchAll(/^#{1,6} (.+)$/gm)].map(match => match[1].toLowerCase().replace(/[^\w -]/g, "").replaceAll(" ", "-"));
        assert.ok(anchors.includes(anchor), `Missing instruction section for ${name}`);
      }
      instructions.set(name, path.resolve(instructionFile) + (anchor ? `#${anchor}` : ""));
      if (options.fail?.(name, Number(attempt))) return { ok: false, error: "Fixture child failed" };
      const value = {
        stage: name, base: args.base, head: args.head, markdown: `# ${name}\nInspected the pinned change. 🐈\n`,
        checks: checks(name), findings: [], gaps: [],
      };
      if (name === "setup") Object.assign(value, {
        mode: options.split ? "split" : "full", addedLines: options.addedLines ?? 1,
        deletedLines: 0, sizeException: options.exception ?? null, rulePaths,
      });
      if (name === "rules") value.rules = rulePaths.map(file => ({
        path: file, selection: "selected", result: "Satisfied", reason: "Inspected caller", evidence: ["example.ts:4"],
      }));
      if (name === "report") value.decisions = [];
      if (name === "decision") {
        const keys = ["focused", "low_risk", "no_sensitive_changes", "clean_review", "complete_review", "verification", "concerns_resolved"];
        const split = options.split;
        value.approval = { outcome: split ? "split" : "human_review", changed_lines: options.addedLines ?? 1,
          checks: split ? null : Object.fromEntries(keys.map(key => [key, { result: key === "verification" ? "Not verified" : "Pass", reason: "Fixture source review; no CI supplied" }])),
          reason: split ? "Split the oversized change" : "A person should assess missing fixture CI", next_steps: ["Reviewer: inspect fixture verification limits"] };
        value.summaryMarkdown = "- **Overall:** Fixture source review complete.\n- **Risk:** Low, with missing CI evidence.\n- **Rules:** Source inspected.\n";
        value.inlineComments = [];
      }
      if (["draft", "editorial", "report"].includes(name)) value.markdown = "# Review: fixture/app#1\n\n## Assessment\nSource review completed.\n\n### Risk and scope\nLow production exposure in the inspected caller.\n\n## Findings\nNo supported findings.\n\n## Verification summary\nSource inspection only; fixture CI is unavailable.\n\n## References\nFixture requirements inspected.\n\n## Supporting details\nCaller traced at example.ts:4. 🐈\n";
      if (name === "split-plan") value.markdown = "# Review: fixture/app#1\n\n## Assessment\nSplit required.\n\n### Risk and scope\nOversized change; full review deferred.\n\n## Split plan\nSeparate preparation from behaviour.\n\n## CI status\nUnavailable in fixture.\n";
      options.mutate?.(name, value, Number(attempt));
      return { ok: true, text: JSON.stringify(value) };
    },
    async runGate(command) {
      const result = spawnSync("sh", ["-c", command], { encoding: "utf8" });
      return { ok: result.status === 0, output: result.stdout + result.stderr };
    },
  };
  return {
    args, calls, rulePaths, instructions,
    get bundle() { return bundle; },
    run: (overrides, runtimeOptions = {}) => runWorkflow({ script, args: { ...args, ...overrides }, host, concurrency: 8, ...runtimeOptions }),
    close: () => rmSync(root, { recursive: true, force: true }),
  };
}

async function scenario(options, check) {
  const state = fixture(options);
  try { await check(state); } finally { state.close(); }
}

test("complete review uses all required stages and validates real saved files", () => scenario({}, async state => {
  const result = await state.run();
  assert.equal(result.status, "completed", result.error);
  assert.equal(result.value.status, "complete");
  assert.equal(result.value.published, false);
  assert.equal(result.value.publication.status, "not_requested");
  assert.equal(state.calls[0], "setup:1");
  assert.ok(state.calls.indexOf("research:1") < state.calls.indexOf("product:1"));
  for (const name of questions) assert.ok(state.calls.indexOf(`${name}:1`) < state.calls.indexOf("rules:1"));
  assert.ok(state.calls.indexOf("rules:1") < state.calls.indexOf("consolidation:1"));
  assert.ok(state.calls.indexOf("editorial:1") < state.calls.indexOf("report:1"));
  const report = readFileSync(result.value.reportPath, "utf8");
  assert.match(report, /readability observable behaviour/);
  assert.ok(report.includes(state.rulePaths[1]));
}));

test("assessment barrier waits for the slowest reviewer", () => {
  let release;
  const held = new Promise(resolve => { release = resolve; });
  let started;
  const waiting = new Promise(resolve => { started = resolve; });
  return scenario({ hold: async request => {
    if (request.label === "readability:1") { started(); await held; }
  } }, async state => {
    const running = state.run();
    await waiting;
    assert.equal(state.calls.includes("rules:1"), false);
    release();
    assert.equal((await running).value.status, "complete");
  });
});

test("a failed assessment gets one fresh retry and can recover", () => scenario({ fail: (name, attempt) => name === "readability" && attempt === 1 }, async state => {
  const result = await state.run();
  assert.equal(result.value.status, "complete");
  assert.ok(state.calls.includes("readability:2"));
  assert.equal(state.bundle.attempts.length, 1);
  assert.equal(state.bundle.failures.length, 0);
}));

test("missing mandatory assessment stops downstream work and saves partial evidence", () => scenario({ fail: name => name === "readability" }, async state => {
  const result = await state.run();
  assert.equal(result.value.status, "incomplete");
  assert.equal(result.value.status, "incomplete");
  assert.equal(result.value.reportPath, null);
  assert.equal(state.calls.filter(label => label.startsWith("readability:")).length, 2);
  assert.equal(state.calls.includes("rules:1"), false);
  assert.ok(state.bundle.stages.correctness);
  assert.match(state.bundle.failures[0].reason, /Missing assessments: readability/);
}));

test("research failure prevents every assessment", () => scenario({ fail: name => name === "research" }, async state => {
  const result = await state.run();
  assert.equal(result.value.status, "incomplete");
  assert.equal(state.calls.some(label => label.startsWith("product:")), false);
}));

for (const [title, mutate] of [
  ["wrong revision", (name, value) => { if (name === "correctness") value.head = "c".repeat(40); }],
  ["missing required fields", (name, value) => { if (name === "correctness") delete value.checks; }],
  ["verified check without evidence", (name, value) => { if (name === "correctness") value.checks[0].evidence = []; }],
  ["template placeholder", (name, value) => { if (name === "correctness") value.markdown = "{{ unresolved }}"; }],
  ["missing rule row", (name, value) => { if (name === "rules") value.rules.pop(); }],
  ["duplicate rule row", (name, value) => { if (name === "rules") value.rules[1] = value.rules[0]; }],
  ["duplicate setup rule path", (name, value) => { if (name === "setup") value.rulePaths = [...value.rulePaths, value.rulePaths[0]]; }],
  ["report without required sections", (name, value) => { if (name === "report") value.markdown = "# report\nLooks fine"; }],
]) {
  test(`${title} cannot produce a complete review`, () => scenario({ mutate }, async state => {
    const result = await state.run();
    assert.equal(result.value.status, "incomplete");
    assert.equal(result.value.published, false);
  }));
}

test("skipped rules need reasons but do not count as passing", () => scenario({ mutate: (name, value) => {
  if (name === "rules") Object.assign(value.rules[0], { selection: "skipped", result: "Skipped", reason: "No relevant operation changed", evidence: [] });
} }, async state => {
  const result = await state.run();
  assert.equal(result.value.status, "complete");
  assert.match(readFileSync(result.value.reportPath, "utf8"), /skipped, Skipped/);
}));

test("split output omits research, assessments and full report coverage", () => scenario({ split: true, addedLines: 2001 }, async state => {
  const result = await state.run();
  assert.equal(result.value.status, "split");
  assert.deepEqual(state.calls, ["setup:1", "split-plan:1", "decision:1", "save-artefacts"]);
}));

test("over 2,000 added lines requires split or a documented exception", () => scenario({ addedLines: 2001 }, async state => {
  const result = await state.run();
  assert.equal(result.value.status, "incomplete");
  assert.equal(state.calls.includes("research:1"), false);
}));

test("documented size exception permits full review", () => scenario({ addedLines: 2001, exception: "Explicit request to review despite size" }, async state => {
  assert.equal((await state.run()).value.status, "complete");
}));

test("unaccounted finding prevents report acceptance", () => scenario({ mutate: (name, value) => {
  if (name === "readability") value.findings.push({
    id: "R1", kind: "readability", disposition: "optional", title: "Separate nested decisions",
    location: "example.ts:4", trigger: "Reading the update path", effect: "Reader tracks unrelated branches",
    action: "Group the two decisions", evidence: ["example.ts:4"], existingThread: null,
  });
} }, async state => {
  const result = await state.run();
  assert.equal(result.value.status, "incomplete");
  assert.equal(state.bundle.stages.report, undefined);
}));

test("notification uncertainty never retries or fails review stages", () => scenario({ notify: true, notificationStatus: "uncertain" }, async state => {
  const result = await state.run();
  assert.equal(result.value.status, "complete");
  assert.ok(result.value.notifications.length > 0);
  assert.equal(state.calls.filter(label => label === "research:1").length, 1);
  assert.equal(state.calls.filter(label => label === "notify:research:running").length, 1);
  assert.equal(result.value.notifications[0].receipt.status, "uncertain");
}));

for (const [title, corrupt] of [
  ["missing canonical report", (bundle, root) => { rmSync(path.join(root, "review-report.md")); }],
  ["changed assessment", (bundle, root) => { writeFileSync(path.join(root, "readability.md"), "Lost evidence"); }],
  ["changed bundle", (bundle, root) => { bundle.status = "incomplete"; writeFileSync(path.join(root, "bundle.json"), JSON.stringify(bundle)); }],
  ["invented setup inventory", (bundle, root) => { writeFileSync(path.join(bundle.input.skillRoot, "rules/README.md"), "[Extra](missing.md)"); }],
  ["dirty reviewed checkout", bundle => { writeFileSync(path.join(bundle.input.repository, "example.ts"), "unreviewed changes"); }],
  ["different checkout head", bundle => { execFileSync("git", ["switch", "--detach", bundle.input.base], { cwd: bundle.input.repository, stdio: "pipe" }); }],
]) {
  test(`${title} fails the real filesystem gate`, () => scenario({ corrupt }, async state => {
    const result = await state.run();
    assert.equal(result.status, "failed");
    assert.match(result.error, /Artefact validation failed/);
    assert.equal(state.calls.filter(label => label === "save-artefacts").length, 1);
  }));
}

test("an explicit package location is required before any agent is scheduled", () => scenario({}, async state => {
  const result = await state.run({ packageRoot: null });
  assert.equal(result.status, "failed");
  assert.equal(state.calls.length, 0);
}));

test("path traversal is rejected before any agent is scheduled", () => scenario({}, async state => {
  const result = await state.run({ artifacts: "/tmp/../etc" });
  assert.equal(result.status, "failed");
  assert.equal(state.calls.length, 0);
}));

test("evidence gaps remain visible in the report and result", () => scenario({ mutate: (name, value) => {
  if (name === "research") value.gaps = ["Notion is unavailable; ownership decision remains unverified"];
} }, async state => {
  const result = await state.run();
  assert.equal(result.value.status, "complete");
  assert.match(readFileSync(result.value.reportPath, "utf8"), /Notion is unavailable/);
  assert.deepEqual(result.value.coverageGaps, [{ stage: "research", reason: "Notion is unavailable; ownership decision remains unverified" }]);
}));

test("fresh invocation identity prevents stale journal replay", () => scenario({}, async state => {
  const entries = [];
  const first = await state.run({}, { journal: { append: entry => entries.push(entry) } });
  assert.equal(first.value.status, "complete");
  rmSync(first.value.reportPath);
  const second = await state.run({ invocationId: "invocation-two" }, { journal: { entries } });
  assert.equal(second.value.status, "complete");
  assert.equal(second.replayedCount, 0);
  assert.ok(readFileSync(second.value.reportPath, "utf8"));
}));

test("parent validation detects missing files even if a caller reuses journal identity", () => scenario({}, async state => {
  const entries = [];
  const first = await state.run({}, { journal: { append: entry => entries.push(entry) } });
  rmSync(first.value.reportPath);
  const replay = await state.run({}, { journal: { entries } });
  assert.ok(replay.replayedCount > 0);
  const validation = spawnSync("sh", ["-c", replay.value.validationCommand], { encoding: "utf8" });
  assert.notEqual(validation.status, 0);
  assert.match(validation.stderr, /Missing artefact/);
}));

test("persistence failure reports blocked progress without retrying the writer", () => scenario({ notify: true, corrupt: (bundle, root) => {
  rmSync(path.join(root, "review-report.md"));
} }, async state => {
  const result = await state.run();
  assert.equal(result.status, "failed");
  assert.ok(state.calls.includes("notify:save-artefacts:blocked"));
  assert.equal(state.calls.includes("notify:save-artefacts:complete"), false);
  assert.equal(state.calls.filter(label => label === "save-artefacts").length, 1);
}));

test("wrapper rule collections participate in full coverage", () => scenario({ wrapper: true }, async state => {
  const result = await state.run();
  assert.equal(result.value.status, "complete");
  assert.equal(state.bundle.stages.rules.rules.length, 3);
  assert.match(readFileSync(result.value.reportPath, "utf8"), /ownership\.md/);
}));

test("a review with retained defects completes without claiming publication or approval", () => scenario({ mutate: (name, value) => {
  if (name === "correctness") value.findings.push({
    id: "F1", kind: "bug", disposition: "required", title: "Caller loses the update",
    location: "example.ts:4", trigger: "Updating an existing item", effect: "The saved value stays stale",
    action: "Persist the updated value", evidence: ["example.ts:4 caller trace"], existingThread: null,
  });
  if (name === "report") {
    value.decisions = [{ sourceId: "correctness:F1", disposition: "retained", reportId: "F1", reason: "Caller trace supports the defect" }];
    value.markdown += "\nF1: Existing-item updates leave the saved value stale. Persist the updated value.\n";
  }
} }, async state => {
  const result = await state.run();
  assert.equal(result.value.status, "complete");
  assert.equal(result.value.published, false);
  assert.match(readFileSync(result.value.reportPath, "utf8"), /F1: Existing-item updates/);
}));

test("wrong complete-diff counts cannot pass the saved-bundle gate", () => scenario({ mutate: (name, value) => {
  if (name === "setup") value.addedLines = 99;
} }, async state => {
  const result = await state.run();
  assert.equal(result.status, "failed");
  assert.match(result.error, /Artefact validation failed/);
}));

test("workers load their assigned sections from the packaged review skill", () => scenario({}, async state => {
  const result = await state.run();
  assert.equal(result.value.status, "complete");
  assert.equal(state.instructions.get("research"), path.join(state.args.skillRoot, "SKILL.md") + "#step-2-research");
  assert.equal(state.instructions.get("correctness"), path.join(state.args.skillRoot, "SKILL.md") + "#q-is-this-implementation-correct");
  assert.equal(state.instructions.get("rules"), path.join(state.args.skillRoot, "SKILL.md") + "#step-4-check-review-rules");
}));

test("dry-run publication renders the existing helper payload without network writes", () => scenario({ publication: { mode: "dry-run", repository: "fixture/app", prNumber: 1 } }, async state => {
  const result = await state.run();
  assert.equal(result.status, "completed", result.error);
  assert.equal(result.value.publication.status, "rendered");
  assert.equal(result.value.published, false);
  const preview = JSON.parse(readFileSync(path.join(state.args.artifacts, "publication-preview.json"), "utf8"));
  assert.equal(preview.dry_run, true);
}));

test("publication failure is not retried or reported as complete delivery", () => scenario({ publication: { mode: "github", repository: "fixture/app", prNumber: 1 }, failPublication: true }, async state => {
  const result = await state.run();
  assert.equal(result.status, "failed");
  assert.equal(state.calls.filter(label => label === "publication").length, 1);
  assert.match(result.error, /Publication was not confirmed/);
}));

test("large generated coverage can be split into publication continuation comments", () => scenario({
  publication: { mode: "dry-run", repository: "fixture/app", prNumber: 1 },
  mutate: (name, value) => {
    if (questions.includes(name)) value.checks = Array.from({ length: 3 }, (_, index) => ({
      ...value.checks[0], item: `${name} check ${index}`, reason: "Source evidence and coverage detail. ".repeat(400),
    }));
  },
}, async state => {
  const result = await state.run();
  assert.equal(result.status, "completed", result.error);
  assert.equal(result.value.publication.status, "rendered");
  const preview = JSON.parse(readFileSync(path.join(state.args.artifacts, "publication-preview.json"), "utf8"));
  assert.ok(preview.report_parts.length > 1);
}));
