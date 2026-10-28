import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = process.env.REVIEW_PACKAGE_ROOT ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const validator = process.env.REVIEW_VALIDATOR_PATH ?? path.join(packageRoot, "scripts/review/validate_bundle.py");
const questions = ["product", "system-fit", "simplicity", "readability", "correctness"];
const allStages = ["setup", "research", ...questions, "rules", "consolidation", "draft", "editorial", "report", "decision"];
const approvalKeys = ["focused", "low_risk", "no_sensitive_changes", "clean_review", "complete_review", "verification", "concerns_resolved"];

function fingerprint(text) {
  let first = 2166136261;
  let second = 3339675911;
  for (let index = 0; index < text.length; index++) {
    first = Math.imul(first ^ text.charCodeAt(index), 16777619) >>> 0;
    second = Math.imul(second ^ text.charCodeAt(index), 16777619) >>> 0;
  }
  return first.toString(16).padStart(8, "0") + second.toString(16).padStart(8, "0");
}

function fixture(options = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), "review-bundle-"));
  const repository = path.join(root, "repository");
  const artifacts = path.join(root, "artefacts with 'quotes'");
  mkdirSync(repository);
  mkdirSync(artifacts);
  const git = (...args) => execFileSync("git", ["-c", "core.hooksPath=/dev/null", ...args], {
    cwd: repository, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  git("init", "--quiet");
  writeFileSync(path.join(repository, "base.ts"), "export const base = 1;\n");
  git("add", "base.ts");
  git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--quiet", "-m", "base");
  const base = git("rev-parse", "HEAD");
  writeFileSync(path.join(repository, "change.ts"), "export const change = 2;\n");
  git("add", "change.ts");
  git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--quiet", "-m", "change");
  const head = git("rev-parse", "HEAD");
  const skillRoot = path.join(packageRoot, "skills/review");
  const rulePaths = [...readFileSync(path.join(skillRoot, "rules/README.md"), "utf8").matchAll(/\[[^\]]+\]\(([^)#]+\.md)(?:#[^)]*)?\)/g)]
    .map(match => path.resolve(skillRoot, "rules", match[1]));
  const input = {
    workflowEnabled: true, packageRoot, skillRoot, supportRoot: path.join(packageRoot, "scripts/review"),
    repository, target: "fixture/app#1", base, head, artifacts, runId: "fixture-run",
    invocationId: "fixture-invocation", wrapperSkillRoots: [], notification: null,
    publication: { mode: options.mode ?? "local", repository: "fixture/app", prNumber: 1 }, contextFiles: [],
  };
  const stages = Object.fromEntries((options.split ? ["setup", "split-plan", "decision"] : allStages).map(name => [name, {
    stage: name, base, head, markdown: `# ${name}\nPinned source inspected. 🐈\n`,
    checks: [{ guidance: `guidance/${name}@v1`, item: `${name} check`, method: "source", result: "Source checked", reason: "Caller inspected", evidence: ["base.ts:1"] }],
    findings: [], gaps: [],
  }]));
  Object.assign(stages.setup, { mode: options.split ? "split" : "full", addedLines: 1, deletedLines: 0, sizeException: null, rulePaths });
  if (!options.split) {
    stages.rules.rules = rulePaths.map(file => ({ path: file, selection: "selected", result: "Satisfied", reason: "Source inspected", evidence: ["base.ts:1"] }));
    stages.report.decisions = [];
    stages.research.gaps = ["Slack unavailable in fixture"];
  }
  const reportHeadings = options.split ? ["Assessment", "Risk and scope", "Split plan", "CI status"] : ["Assessment", "Risk and scope", "Findings", "Verification summary", "References", "Supporting details"];
  let report = "# Review: fixture/app#1\n" + reportHeadings.map(name => `\n## ${name}\nFixture source evidence. 🐈\n`).join("");
  for (const [name, result] of Object.entries(stages)) {
    if (name === "decision") continue;
    report += result.checks.map(check => `${check.item}: ${check.guidance}\n`).join("");
    report += result.gaps.map(gap => `${gap}\n`).join("");
  }
  report += rulePaths.join("\n");
  (stages.report ?? stages["split-plan"]).markdown = report;
  Object.assign(stages.decision, {
    approval: {
      outcome: options.split ? "split" : "approve", changed_lines: 1,
      checks: options.split ? null : Object.fromEntries(approvalKeys.map(key => [key, { result: "Pass", reason: "Fixture evidence supports this answer." }])),
      reason: "Fixture review finished.", next_steps: options.split ? ["Author should separate the independent changes."] : [],
    },
    summaryMarkdown: "- **Overall:** Fixture review completed.\n", inlineComments: [],
  });
  const bundle = { version: 1, input, status: options.split ? "split" : "complete", stages, failures: [], attempts: [], notifications: [] };
  let digest;
  let result;
  function save() {
    const serialized = JSON.stringify(bundle);
    digest = fingerprint(serialized);
    writeFileSync(path.join(artifacts, "bundle.json"), serialized);
    for (const [name, stage] of Object.entries(stages)) writeFileSync(path.join(artifacts, `${name}.md`), stage.markdown);
    if (bundle.status === "incomplete") writeFileSync(path.join(artifacts, "incomplete.md"), JSON.stringify(bundle.failures));
    if (stages.report || stages["split-plan"]) writeFileSync(path.join(artifacts, "review-report.md"), (stages.report ?? stages["split-plan"]).markdown);
    if (stages.decision) {
      writeFileSync(path.join(artifacts, "approval.json"), JSON.stringify(stages.decision.approval));
      writeFileSync(path.join(artifacts, "summary.md"), stages.decision.summaryMarkdown);
      writeFileSync(path.join(artifacts, "inline.json"), JSON.stringify(stages.decision.inlineComments));
    }
    result = {
      status: bundle.status, runId: input.runId, invocationId: input.invocationId, base, head,
      bundlePath: path.join(artifacts, "bundle.json"), reportPath: bundle.status === "incomplete" ? null : path.join(artifacts, "review-report.md"),
      fingerprint: digest, publication: { mode: input.publication.mode, status: bundle.status === "incomplete" || input.publication.mode === "local" ? "not_requested" : "pending" },
    };
    saveResult();
  }
  function saveResult() { writeFileSync(path.join(artifacts, "result.json"), JSON.stringify(result)); }
  function run() { return spawnSync("python3", [validator, path.join(artifacts, "bundle.json"), "--fingerprint", digest], { encoding: "utf8" }); }
  return { root, repository, artifacts, git, bundle, stages, input, save, saveResult, run, get result() { return result; }, close: () => rmSync(root, { recursive: true, force: true }) };
}

async function scenario(options, action) {
  const state = fixture(options);
  try { await action(state); } finally { state.close(); }
}

function succeeds(state) {
  const result = state.run();
  assert.equal(result.status, 0, result.stderr);
  const value = JSON.parse(result.stdout);
  assert.equal(value.validated, true);
  assert.equal(value.remotePublicationVerified, false);
}

function fails(state, reason) {
  const result = state.run();
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, reason);
}

test("complete bundle validates actual Git scope, rules and canonical decision files", () => scenario({}, state => { state.save(); succeeds(state); }));
test("split bundle validates its decision without full-review stages", () => scenario({ split: true }, state => { state.save(); succeeds(state); }));
test("dry-run and GitHub pending are valid before publication", async () => {
  for (const mode of ["dry-run", "github"]) await scenario({ mode }, state => { state.save(); succeeds(state); });
});
test("decision failure preserves an accepted report but is not publication ready", () => scenario({}, state => {
  delete state.stages.decision;
  state.bundle.status = "incomplete";
  state.bundle.failures.push({ stage: "decision", reason: "Two attempts failed" });
  state.save();
  succeeds(state);
  assert.equal(state.result.reportPath, null);
  assert.ok(readFileSync(path.join(state.artifacts, "report.md"), "utf8").includes("Assessment"));
}));

for (const [name, mutate, reason] of [
  ["missing mandatory stage", state => { delete state.stages.readability; }, /missing or unexpected stages/],
  ["wrong stage revision", state => { state.stages.correctness.head = "c".repeat(40); }, /Revision mismatch/],
  ["wrong source counts", state => { state.stages.setup.addedLines = 2; }, /counts do not match/],
  ["missing indexed rule", state => { state.stages.setup.rulePaths.pop(); }, /inventory differs/],
  ["duplicate rule result", state => { state.stages.rules.rules[1] = state.stages.rules.rules[0]; }, /coverage is incomplete or duplicated/],
  ["lost evidence gap", state => { state.stages.report.markdown = state.stages.report.markdown.replace("Slack unavailable in fixture", ""); }, /lost an evidence gap/],
  ["lost individual check", state => { state.stages.report.markdown = state.stages.report.markdown.replace("readability check", "omitted check"); }, /lost individual check coverage/],
  ["lost report section", state => { state.stages.report.markdown = state.stages.report.markdown.replace("## Assessment", "Assessment"); }, /missing required sections/],
  ["approval contradicts its checks", state => { state.stages.decision.approval.checks.clean_review.result = "Fail"; }, /every checklist item to pass/],
  ["approval missing a required check", state => { delete state.stages.decision.approval.checks.focused; }, /all seven checklist/],
  ["approval line count mismatch", state => { state.stages.decision.approval.changed_lines = 9; }, /Approval line count/],
  ["split approval for full review", state => { Object.assign(state.stages.decision.approval, { outcome: "split", checks: null, next_steps: ["Author should split."] }); }, /outcome differs/],
]) {
  test(`${name} is rejected`, () => scenario({}, state => { mutate(state); state.save(); fails(state, reason); }));
}

for (const [name, mutate, reason] of [
  ["changed summary", state => writeFileSync(path.join(state.artifacts, "summary.md"), "Changed"), /summary differs/],
  ["changed inline file", state => writeFileSync(path.join(state.artifacts, "inline.json"), "[{}]"), /inline findings differ/],
  ["changed approval file", state => writeFileSync(path.join(state.artifacts, "approval.json"), "{}"), /approval differs/],
  ["changed bundle", state => writeFileSync(path.join(state.artifacts, "bundle.json"), "{}"), /differs from accepted/],
  ["missing canonical report", state => rmSync(path.join(state.artifacts, "review-report.md")), /Missing artefact/],
  ["changed assessment", state => writeFileSync(path.join(state.artifacts, "research.md"), "Changed"), /Saved assessment differs/],
  ["dirty source checkout", state => writeFileSync(path.join(state.repository, "base.ts"), "Changed"), /uncommitted changes/],
  ["checkout at another revision", state => state.git("switch", "--quiet", "--detach", state.input.base), /HEAD differs/],
  ["missing result metadata", state => rmSync(path.join(state.artifacts, "result.json")), /Missing artefact/],
  ["wrong invocation receipt", state => { state.result.invocationId = "another-invocation"; state.saveResult(); }, /identity mismatch: invocationId/],
  ["wrong result fingerprint", state => { state.result.fingerprint = "0".repeat(16); state.saveResult(); }, /fingerprint mismatch/],
  ["publication mode mismatch", state => { state.result.publication.mode = "github"; state.saveResult(); }, /Publication mode mismatch/],
  ["publication claim without confirmation", state => { state.result.published = true; state.saveResult(); }, /claims publication without confirmation/],
]) {
  test(`${name} fails saved-file validation`, () => scenario({}, state => { state.save(); mutate(state); fails(state, reason); }));
}

test("symlinked canonical report cannot substitute another file", () => scenario({}, state => {
  state.save();
  const report = path.join(state.artifacts, "review-report.md");
  const other = path.join(state.root, "outside.md");
  writeFileSync(other, state.stages.report.markdown);
  rmSync(report);
  symlinkSync(other, report);
  fails(state, /escapes directory/);
}));

test("GitHub confirmed without a local receipt is rejected", () => scenario({ mode: "github" }, state => {
  state.save();
  state.result.publication.status = "confirmed";
  state.saveResult();
  fails(state, /Missing artefact: progress.json/);
}));

test("dry-run rendered requires the helper preview", () => scenario({ mode: "dry-run" }, state => {
  state.save();
  state.result.publication.status = "rendered";
  state.saveResult();
  fails(state, /Missing artefact: publication-preview.json/);
  writeFileSync(path.join(state.artifacts, "publication-preview.json"), JSON.stringify({
    dry_run: true, body: "Rendered fixture review", inline: [], approval_decision: state.stages.decision.approval,
    publication_digest: "a".repeat(64),
  }));
  succeeds(state);
}));

test("a delivery failure does not mutate the structurally complete bundle", () => scenario({ mode: "github" }, state => {
  state.save();
  state.result.publication.status = "failed";
  state.result.publication.reason = "Remote outcome uncertain; operator inspection required.";
  state.saveResult();
  succeeds(state);
  assert.equal(state.bundle.status, "complete");
}));

test("incomplete review cannot claim publication confirmation", () => scenario({ mode: "github" }, state => {
  delete state.stages.decision;
  state.bundle.status = "incomplete";
  state.bundle.failures.push({ stage: "decision", reason: "Failed" });
  state.save();
  state.result.publication.status = "confirmed";
  state.saveResult();
  fails(state, /incompatible with review completion/);
}));

test("wrapper rule indexes are independently accounted for", () => scenario({}, state => {
  const wrapper = path.join(state.root, "wrapper");
  mkdirSync(path.join(wrapper, "rules"), { recursive: true });
  const rule = path.join(wrapper, "rules/ownership.md");
  writeFileSync(rule, "Inspect ownership.");
  writeFileSync(path.join(wrapper, "rules/README.md"), "[Ownership](ownership.md)");
  state.input.wrapperSkillRoots = [wrapper];
  state.save();
  fails(state, /inventory differs/);
  state.stages.setup.rulePaths.push(rule);
  state.stages.rules.rules.push({ path: rule, selection: "selected", result: "Satisfied", reason: "Source inspected", evidence: ["base.ts:1"] });
  state.stages.report.markdown += `\n${rule}\n`;
  state.save();
  succeeds(state);
}));

test("final report must account for each worker finding", () => scenario({}, state => {
  state.stages.readability.findings.push({ id: "R1", kind: "readability", disposition: "optional" });
  state.save();
  fails(state, /lost finding decisions/);
  state.stages.report.decisions = [{ sourceId: "readability:R1", disposition: "retained", reportId: "F1", reason: "Preserve the supported readability improvement" }];
  state.save();
  fails(state, /Retained finding is absent/);
  state.stages.report.markdown += "\nF1: Name the row variable for its role.\n";
  state.save();
  succeeds(state);
}));

test("decision cannot introduce unreviewed findings", () => scenario({}, state => {
  state.stages.decision.findings = [{ id: "NEW", kind: "bug" }];
  state.save();
  fails(state, /introduced findings after report/);
}));

function renderWithExistingHelper(state) {
  const progress = {
    repo: state.input.publication.repository, pr: state.input.publication.prNumber,
    base: state.input.base, head: state.input.head, run_id: "fixture-helper-run",
    status: "reviewing", comments: {}, checklist: "- [x] Review complete\n- [x] Publish results",
  };
  const progressPath = path.join(state.artifacts, "progress.json");
  writeFileSync(progressPath, JSON.stringify(progress));
  const preview = JSON.parse(execFileSync("python3", [
    path.join(packageRoot, "skills/review/scripts/github_progress.py"), "--state", progressPath, "--dry-run", "finish",
    "--summary", path.join(state.artifacts, "summary.md"), "--report", path.join(state.artifacts, "review-report.md"),
    "--inline", path.join(state.artifacts, "inline.json"), "--approval", path.join(state.artifacts, "approval.json"),
  ], { encoding: "utf8", env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } }));
  return { progress, preview, progressPath };
}

test("actual helper dry-run payload validates without external requests", () => scenario({ mode: "dry-run" }, state => {
  state.save();
  const { preview } = renderWithExistingHelper(state);
  writeFileSync(path.join(state.artifacts, "publication-preview.json"), JSON.stringify(preview));
  state.result.publication.status = "rendered";
  state.saveResult();
  succeeds(state);
}));

test("confirmed local receipt requires the same frozen helper payload", () => scenario({ mode: "github" }, state => {
  state.save();
  const { progress, preview, progressPath } = renderWithExistingHelper(state);
  Object.assign(progress, {
    status: "complete", publication_digest: preview.publication_digest,
    approval_decision: state.stages.decision.approval,
    comments: { main: { id: 123, html_url: "https://github.com/fixture/app/pull/1#issuecomment-123" } },
    approval: { status: "approved", id: 456, html_url: "https://github.com/fixture/app/pull/1#pullrequestreview-456" },
  });
  writeFileSync(progressPath, JSON.stringify(progress));
  state.result.publication.status = "confirmed";
  state.saveResult();
  succeeds(state);
  progress.publication_digest = "0".repeat(64);
  writeFileSync(progressPath, JSON.stringify(progress));
  fails(state, /frozen inputs differ/);
}));

test("receipt for another PR cannot confirm this review", () => scenario({ mode: "github" }, state => {
  state.save();
  const { progress, preview, progressPath } = renderWithExistingHelper(state);
  Object.assign(progress, {
    status: "complete", pr: 9, publication_digest: preview.publication_digest,
    approval_decision: state.stages.decision.approval,
    comments: { main: { id: 123, html_url: "https://github.com/fixture/app/pull/9#issuecomment-123" } },
    approval: { status: "approved", id: 456 },
  });
  writeFileSync(progressPath, JSON.stringify(progress));
  state.result.publication.status = "confirmed";
  state.saveResult();
  fails(state, /identity mismatch: pr/);
}));
