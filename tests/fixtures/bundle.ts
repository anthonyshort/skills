import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  BundleSchema,
  ReviewResultSchema,
  StageResultsSchema,
  parseReviewInput,
  stageNames,
} from "../../src/review/contracts.js";
import type { ReviewResult } from "../../src/review/contracts.js";
import { coverageMarkdown, fingerprint } from "../../src/review/text.js";

const OptionsSchema = z.object({
  split: z.boolean().default(false),
  mode: z.enum(["local", "dry-run", "github"]).default("local"),
  addedLines: z.number().int().positive().default(1),
});
const packageRoot =
  process.env.REVIEW_PACKAGE_ROOT ??
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const checks = [
  "focused",
  "low_risk",
  "no_sensitive_changes",
  "clean_review",
  "complete_review",
  "verification",
  "concerns_resolved",
];

export function savedBundleFixture(
  options: z.input<typeof OptionsSchema> = {},
) {
  const settings = OptionsSchema.parse(options);
  const root = mkdtempSync(path.join(os.tmpdir(), "review-bundle-"));
  const repository = path.join(root, "repository");
  const artifacts = path.join(root, "artefacts with 'quotes'");
  mkdirSync(repository);
  mkdirSync(artifacts);
  const git = (...args: string[]) =>
    execFileSync("git", ["-c", "core.hooksPath=/dev/null", ...args], {
      cwd: repository,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  git("init", "--quiet");
  writeFileSync(path.join(repository, "base.ts"), "export const base = 1;\n");
  git("add", "base.ts");
  git(
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "base",
  );
  const base = git("rev-parse", "HEAD");
  writeFileSync(
    path.join(repository, "change.ts"),
    "export const change = 2;\n".repeat(settings.addedLines),
  );
  git("add", "change.ts");
  git(
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "change",
  );
  const head = git("rev-parse", "HEAD");
  const skillRoot = path.join(root, "review-skill");
  cpSync(path.join(packageRoot, "skills/review"), skillRoot, {
    recursive: true,
  });
  const rulePaths = [
    ...readFileSync(path.join(skillRoot, "rules/README.md"), "utf8").matchAll(
      /\[[^\]]+\]\(([^)#]+\.md)(?:#[^)]*)?\)/g,
    ),
  ].map((match) => path.resolve(skillRoot, "rules", match[1]));
  const input = parseReviewInput({
    packageRoot,
    skillRoot,
    repository,
    target: "fixture/app#1",
    base,
    head,
    artifacts,
    runId: "fixture-run",
    invocationId: "fixture-invocation",
    publication:
      settings.mode === "local"
        ? { mode: "local" }
        : { mode: settings.mode, repository: "fixture/app", prNumber: 1 },
  });
  const envelope = (stage: string) => ({
    stage,
    base,
    head,
    markdown: `# ${stage}\nPinned source inspected. 🐈\n`,
    checks: [
      {
        guidance: `guidance/${stage}@v1`,
        item: `${stage} check`,
        method: "source",
        result: "Source checked",
        reason: "Caller inspected",
        evidence: ["base.ts:1"],
      },
    ],
    findings: [],
    gaps: [],
  });
  const names = settings.split
    ? ["setup", "split-plan", "decision"]
    : stageNames.filter((name) => name !== "split-plan");
  const stages = StageResultsSchema.parse({
    ...Object.fromEntries(names.map((name) => [name, envelope(name)])),
    setup: {
      ...envelope("setup"),
      mode: settings.split ? "split" : "full",
      addedLines: settings.addedLines,
      deletedLines: 0,
      sizeException: null,
      rulePaths,
    },
    ...(settings.split
      ? {}
      : {
          research: {
            ...envelope("research"),
            gaps: ["Slack unavailable in fixture"],
          },
          rules: {
            ...envelope("rules"),
            rules: rulePaths.map((file) => ({
              path: file,
              selection: "selected",
              result: "Satisfied",
              reason: "Source inspected",
              evidence: ["base.ts:1"],
            })),
          },
          report: { ...envelope("report"), decisions: [] },
        }),
    decision: {
      ...envelope("decision"),
      approval: {
        outcome: settings.split ? "split" : "human_review",
        changed_lines: settings.addedLines,
        checks: settings.split
          ? null
          : Object.fromEntries(
              checks.map((key) => [
                key,
                {
                  result: key === "low_risk" ? "Fail" : "Pass",
                  reason: `Fixture evidence for ${key}.`,
                },
              ]),
            ),
        reason: "Fixture review finished.",
        next_steps: ["A human reviewer should inspect the data consequence."],
      },
      summaryMarkdown: "- **Overall:** Fixture review completed.\n",
      inlineComments: [],
    },
  });
  const headings = settings.split
    ? ["Assessment", "Risk and scope", "Split plan", "CI status"]
    : [
        "Assessment",
        "Risk and scope",
        "Findings",
        "Verification summary",
        "References",
        "Supporting details",
      ];
  const report = stages.report ?? stages["split-plan"];
  if (!report) {
    throw new Error("Fixture has no report");
  }
  report.markdown =
    "# Review: fixture/app#1\n" +
    headings
      .map((name) => `\n## ${name}\nFixture source evidence. 🐈\n`)
      .join("") +
    (settings.split ? "" : coverageMarkdown(stages));
  const bundle = BundleSchema.parse({
    version: 1,
    input,
    status: settings.split ? "split" : "complete",
    stages,
    failures: [],
    attempts: [],
    notifications: [],
  });
  let result: ReviewResult;
  const bundlePath = path.join(artifacts, "bundle.json");
  function saveResult() {
    writeFileSync(path.join(artifacts, "result.json"), JSON.stringify(result));
  }
  function save() {
    const serialized = JSON.stringify(bundle);
    writeFileSync(bundlePath, serialized);
    for (const [name, stage] of Object.entries(bundle.stages)) {
      writeFileSync(path.join(artifacts, `${name}.md`), stage.markdown);
    }
    if (bundle.status === "incomplete") {
      writeFileSync(
        path.join(artifacts, "incomplete.md"),
        JSON.stringify(bundle.failures),
      );
    }
    const canonical = bundle.stages.report ?? bundle.stages["split-plan"];
    if (canonical) {
      writeFileSync(
        path.join(artifacts, "review-report.md"),
        canonical.markdown,
      );
    }
    if (bundle.stages.decision) {
      writeFileSync(
        path.join(artifacts, "approval.json"),
        JSON.stringify(bundle.stages.decision.approval),
      );
      writeFileSync(
        path.join(artifacts, "summary.md"),
        bundle.stages.decision.summaryMarkdown,
      );
      writeFileSync(
        path.join(artifacts, "inline.json"),
        JSON.stringify(bundle.stages.decision.inlineComments),
      );
    }
    result = ReviewResultSchema.parse({
      status: bundle.status,
      runId: input.runId,
      invocationId: input.invocationId,
      base,
      head,
      bundlePath,
      reportPath:
        bundle.status === "incomplete"
          ? null
          : path.join(artifacts, "review-report.md"),
      fingerprint: fingerprint(serialized),
      publication: {
        mode: input.publication.mode,
        status:
          bundle.status === "incomplete" || input.publication.mode === "local"
            ? "not_requested"
            : "pending",
      },
      missingStages: [],
      coverageGaps: [],
    });
    saveResult();
  }
  save();
  return {
    root,
    repository,
    artifacts,
    git,
    bundle,
    bundlePath,
    save,
    saveResult,
    get result() {
      return result;
    },
    close: () => rmSync(root, { recursive: true, force: true }),
  };
}

export type SavedBundleFixture = ReturnType<typeof savedBundleFixture>;
