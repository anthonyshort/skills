/**
 * Canned accepted review data for saved-bundle tests.
 * No model or GitHub request runs here. The fixture creates real commits and
 * artefact files so callers can exercise validation against independent disk
 * state. Call close() to remove its temporary checkout, skill copy and output.
 */
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
import type {
  Bundle,
  ReviewInput,
  ReviewResult,
  StageName,
  StageResults,
} from "../../src/review/contracts.js";
import { coverageMarkdown, fingerprint } from "../../src/review/utils.js";

const OptionsSchema = z.object({
  split: z.boolean().default(false),
  addedLines: z.number().int().positive().default(1),
});
type FixtureOptions = z.infer<typeof OptionsSchema>;
type FixtureGit = (...args: string[]) => string;

const packageRoot =
  process.env.REVIEW_PACKAGE_ROOT ??
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const approvalCheckNames = [
  "focused",
  "low_risk",
  "no_sensitive_changes",
  "clean_review",
  "complete_review",
  "verification",
  "concerns_resolved",
];

/**
 * Own the temporary resources and expose mutable bundle data for fault cases.
 * save() rewrites accepted artefacts and resets result metadata. saveResult()
 * writes only the caller-mutated result. The caller must close() after use.
 */
export function savedBundleFixture(
  options: z.input<typeof OptionsSchema> = {},
) {
  const settings = OptionsSchema.parse(options);
  const root = mkdtempSync(path.join(os.tmpdir(), "review-bundle-"));
  try {
    const { repository, base, head, git } = createCommittedRepository(
      root,
      settings.addedLines,
    );
    const { skillRoot, rulePaths } = copyReviewSkill(root);
    const artifacts = path.join(root, "artefacts with 'quotes'");
    mkdirSync(artifacts);
    const input = createFixtureInput({
      repository,
      base,
      head,
      skillRoot,
      artifacts,
    });
    const bundle = createAcceptedBundle(input, rulePaths, settings);
    const bundlePath = path.join(artifacts, "bundle.json");
    let result = writeBundleArtifacts(bundle, input);
    const save = () => {
      result = writeBundleArtifacts(bundle, input);
    };
    const saveResult = () => writeResultMetadata(artifacts, result);

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
  } catch (error) {
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
}

/**
 * Create a clean two-commit checkout with a known count of added source lines.
 * The returned Git command remains bound to this fixture's repository.
 */
function createCommittedRepository(root: string, addedLines: number) {
  const repository = path.join(root, "repository");
  mkdirSync(repository);
  const git: FixtureGit = (...args) =>
    execFileSync("git", ["-c", "core.hooksPath=/dev/null", ...args], {
      cwd: repository,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  git("init", "--quiet");
  writeFileSync(path.join(repository, "base.ts"), "export const base = 1;\n");
  git("add", "base.ts");
  commitFixtureChange(git, "base");
  const base = git("rev-parse", "HEAD");
  writeFileSync(
    path.join(repository, "change.ts"),
    "export const change = 2;\n".repeat(addedLines),
  );
  git("add", "change.ts");
  commitFixtureChange(git, "change");
  return { repository, base, head: git("rev-parse", "HEAD"), git };
}

/**
 * Commit fixture source using a local identity without repository hooks.
 */
function commitFixtureChange(git: FixtureGit, description: string): void {
  git(
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "commit",
    "--quiet",
    "-m",
    description,
  );
}

/**
 * Copy the actual skill so tests can change indexes without changing the package.
 * Read its rule inventory independently of the later bundle validator.
 */
function copyReviewSkill(root: string) {
  const skillRoot = path.join(root, "review-skill");
  cpSync(path.join(packageRoot, "skills/review"), skillRoot, {
    recursive: true,
  });
  const rulePaths = [
    ...readFileSync(path.join(skillRoot, "rules/README.md"), "utf8").matchAll(
      /\[[^\]]+\]\(([^)#]+\.md)(?:#[^)]*)?\)/g,
    ),
  ].map((match) => path.resolve(skillRoot, "rules", match[1]));
  return { skillRoot, rulePaths };
}

/**
 * Pin the committed fixture and its private output paths.
 */
function createFixtureInput(
  source: Pick<
    ReviewInput,
    "repository" | "base" | "head" | "skillRoot" | "artifacts"
  >,
): ReviewInput {
  return parseReviewInput({
    packageRoot,
    ...source,
    target: "fixture/app#1",
    runId: "fixture-run",
    invocationId: "fixture-invocation",
  });
}

/**
 * Supply schema-valid canned worker evidence rather than invoking review agents.
 */
function stageEnvelope(stage: StageName, input: ReviewInput) {
  return {
    stage,
    base: input.base,
    head: input.head,
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
  };
}

/**
 * Assemble the accepted full or split-only review with explicit research limits.
 */
function createAcceptedBundle(
  input: ReviewInput,
  rulePaths: string[],
  settings: FixtureOptions,
): Bundle {
  const stages = createCannedStages(input, rulePaths, settings);
  const report = stages.report ?? stages.splitPlan;
  if (!report) {
    throw new Error("Fixture has no report");
  }
  report.markdown = canonicalReportMarkdown(stages);
  return BundleSchema.parse({
    version: 1,
    input,
    status: settings.split ? "split" : "complete",
    stages,
    failures: [],
    attempts: [],
    notifications: [],
  });
}

/**
 * Make stage-specific coverage and the final human-review decision visible.
 */
function createCannedStages(
  input: ReviewInput,
  rulePaths: string[],
  settings: FixtureOptions,
): StageResults {
  const names: StageName[] = settings.split
    ? ["setup", "splitPlan", "decision"]
    : stageNames.filter((name) => name !== "splitPlan");
  const stages: Record<string, unknown> = Object.fromEntries(
    names.map((name) => [name, stageEnvelope(name, input)]),
  );
  stages.setup = {
    ...stageEnvelope("setup", input),
    mode: settings.split ? "split" : "full",
    addedLines: settings.addedLines,
    deletedLines: 0,
    sizeException: null,
    rulePaths,
  };
  if (!settings.split) {
    stages.research = {
      ...stageEnvelope("research", input),
      gaps: ["Slack unavailable in fixture"],
    };
    stages.rules = {
      ...stageEnvelope("rules", input),
      rules: rulePaths.map((file) => ({
        path: file,
        selection: "selected",
        result: "Satisfied",
        reason: "Source inspected",
        evidence: ["base.ts:1"],
      })),
    };
    stages.report = { ...stageEnvelope("report", input), decisions: [] };
  }
  stages.decision = cannedApprovalDecision(input, settings);
  return StageResultsSchema.parse(stages);
}

/**
 * Default to a human-review assessment, never a claim of remote approval.
 */
function cannedApprovalDecision(input: ReviewInput, settings: FixtureOptions) {
  return {
    ...stageEnvelope("decision", input),
    approval: {
      outcome: settings.split ? "split" : "human_review",
      changed_lines: settings.addedLines,
      checks: settings.split
        ? null
        : Object.fromEntries(
            approvalCheckNames.map((key) => [
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
  };
}

/**
 * Render a complete canned report with the same individual coverage as its stages.
 */
function canonicalReportMarkdown(stages: StageResults): string {
  const split = stages.setup?.mode === "split";
  const headings = split
    ? ["Assessment", "Risk and scope", "Split plan", "CI status"]
    : [
        "Assessment",
        "Risk and scope",
        "Findings",
        "Verification summary",
        "References",
        "Supporting details",
      ];
  return (
    "# Review: fixture/app#1\n" +
    headings
      .map((name) => `\n## ${name}\nFixture source evidence. 🐈\n`)
      .join("") +
    (split ? "" : coverageMarkdown(stages))
  );
}

/**
 * Rewrite the real saved files from the current mutable bundle for validation.
 * Fault cases can then alter files separately from their accepted in-memory data.
 */
function writeBundleArtifacts(
  bundle: Bundle,
  input: ReviewInput,
): ReviewResult {
  const artifacts = input.artifacts;
  const serialized = JSON.stringify(bundle);
  writeFileSync(path.join(artifacts, "bundle.json"), serialized);
  for (const [name, stage] of Object.entries(bundle.stages)) {
    writeFileSync(path.join(artifacts, `${name}.md`), stage.markdown);
  }
  if (bundle.status === "incomplete") {
    writeFileSync(
      path.join(artifacts, "incomplete.md"),
      JSON.stringify(bundle.failures),
    );
  }
  const canonical = bundle.stages.report ?? bundle.stages.splitPlan;
  if (canonical) {
    writeFileSync(path.join(artifacts, "review-report.md"), canonical.markdown);
  }
  const decision = bundle.stages.decision;
  if (decision) {
    writeFileSync(
      path.join(artifacts, "approval.json"),
      JSON.stringify(decision.approval),
    );
    writeFileSync(path.join(artifacts, "summary.md"), decision.summaryMarkdown);
    writeFileSync(
      path.join(artifacts, "inline.json"),
      JSON.stringify(decision.inlineComments),
    );
  }
  const result = createResultMetadata(bundle, input, serialized);
  writeResultMetadata(artifacts, result);
  return result;
}

/**
 * Describe structural completion separately from pending or absent delivery.
 */
function createResultMetadata(
  bundle: Bundle,
  input: ReviewInput,
  serialized: string,
): ReviewResult {
  const { status } = bundle;
  return ReviewResultSchema.parse({
    status,
    runId: input.runId,
    invocationId: input.invocationId,
    base: input.base,
    head: input.head,
    bundlePath: path.join(input.artifacts, "bundle.json"),
    reportPath:
      status === "incomplete"
        ? null
        : path.join(input.artifacts, "review-report.md"),
    fingerprint: fingerprint(serialized),
    missingStages: [],
    coverageGaps: [],
  });
}

/**
 * Persist caller-mutated result metadata without recomputing the accepted bundle.
 */
function writeResultMetadata(artifacts: string, result: ReviewResult): void {
  writeFileSync(path.join(artifacts, "result.json"), JSON.stringify(result));
}

export type SavedBundleFixture = ReturnType<typeof savedBundleFixture>;
