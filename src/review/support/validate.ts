import { lstat, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { BundleSchema, ReviewResultSchema, stageNames } from "../contracts.js";
import type {
  Bundle,
  ReviewInput,
  ReviewResult,
  StageResults,
} from "../contracts.js";
import { validateStage } from "../stages.js";
import { fingerprint } from "../text.js";
import { runCommand } from "./commands.js";
import {
  digest,
  readArtifact,
  readJson,
  requireCondition,
  within,
} from "./files.js";
import { PreviewSchema, ProgressStateSchema } from "./publication-models.js";

const fullStages = stageNames.filter((name) => name !== "split-plan");

export async function indexedRules(input: ReviewInput): Promise<Set<string>> {
  const paths: string[] = [];
  for (const root of [input.skillRoot, ...input.wrapperSkillRoots]) {
    const directory = await realpath(path.join(root, "rules"));
    const contents = await readFile(path.join(directory, "README.md"), "utf8");
    for (const match of contents.matchAll(
      /\[[^\]]+\]\(([^)#]+\.md)(?:#[^)]*)?\)/g,
    )) {
      const file = await realpath(path.resolve(directory, match[1]));
      requireCondition(
        within(directory, file),
        `Rule escapes its collection: ${file}`,
      );
      requireCondition(
        (await stat(file)).isFile(),
        `Indexed rule is not a file: ${file}`,
      );
      paths.push(file);
    }
  }
  requireCondition(
    paths.length === new Set(paths).size,
    "Rule indexes contain duplicate rule paths",
  );
  return new Set(paths);
}

export async function diffCounts(
  input: ReviewInput,
): Promise<{ added: number; deleted: number }> {
  const git = (...args: string[]) =>
    runCommand("git", [
      "-C",
      input.repository,
      "-c",
      "core.fsmonitor=false",
      ...args,
    ]);
  requireCondition(
    (await git("rev-parse", "HEAD")).trim() === input.head,
    "Checkout HEAD differs from reviewed head",
  );
  requireCondition(
    !(await git("status", "--porcelain", "--untracked-files=all")).trim(),
    "Reviewed checkout contains uncommitted changes",
  );
  const statistics = await git(
    "diff",
    "--no-ext-diff",
    "--no-textconv",
    "--numstat",
    input.base,
    input.head,
    "--",
  );
  let added = 0;
  let deleted = 0;
  for (const line of statistics.trim().split("\n").filter(Boolean)) {
    const values = line.split("\t");
    requireCondition(values.length >= 3, "Unexpected git diff statistics");
    if (values[0] === "-") {
      continue;
    }
    const numbers = z
      .tuple([
        z.coerce.number().int().nonnegative(),
        z.coerce.number().int().nonnegative(),
      ])
      .parse([values[0], values[1]]);
    added += numbers[0];
    deleted += numbers[1];
  }
  return { added, deleted };
}

export function publicationDigest(
  stages: StageResults,
  checklist: string,
): string {
  requireCondition(
    stages.decision,
    "Publication requires an accepted decision",
  );
  const report = stages.report ?? stages["split-plan"];
  requireCondition(report, "Publication requires an accepted report");
  return digest({
    summary: stages.decision.summaryMarkdown,
    report: report.markdown,
    inline: stages.decision.inlineComments,
    checklist,
    approval: stages.decision.approval,
  });
}

function validateReportCoverage(bundle: Bundle): string {
  const { stages, status } = bundle;
  const report = status === "split" ? stages["split-plan"] : stages.report;
  requireCondition(report, "Review has no canonical report");
  if (status === "split") {
    return report.markdown;
  }
  for (const [name, result] of Object.entries(stages)) {
    if (name === "decision") {
      continue;
    }
    for (const check of result.checks) {
      requireCondition(
        report.markdown.includes(check.item) &&
          report.markdown.includes(check.guidance),
        "Final report lost individual check coverage",
      );
    }
    for (const gap of result.gaps) {
      requireCondition(
        report.markdown.includes(gap),
        "Final report lost an evidence gap",
      );
    }
  }
  requireCondition(stages.rules, "Full review has no rule assessment");
  for (const rule of stages.rules.rules) {
    requireCondition(
      report.markdown.includes(rule.path),
      "Final report lost a rule result",
    );
  }
  return report.markdown;
}

async function validateDecisionFiles(
  root: string,
  bundle: Bundle,
): Promise<void> {
  const decision = bundle.stages.decision;
  requireCondition(decision, "Review has no final decision");
  requireCondition(
    isDeepStrictEqual(await readJson(root, "approval.json"), decision.approval),
    "Saved approval differs from accepted decision",
  );
  requireCondition(
    (await readArtifact(root, "summary.md")) === decision.summaryMarkdown,
    "Saved summary differs from accepted decision",
  );
  requireCondition(
    isDeepStrictEqual(
      await readJson(root, "inline.json"),
      decision.inlineComments,
    ),
    "Saved inline findings differ from accepted decision",
  );
}

async function validatePublicationReceipt(
  root: string,
  bundle: Bundle,
  result: ReviewResult,
): Promise<void> {
  const { input, stages, status } = bundle;
  const publication = result.publication;
  requireCondition(
    publication.mode === input.publication.mode,
    "Publication mode mismatch",
  );
  const allowed =
    status === "incomplete"
      ? ["not_requested", "failed"]
      : {
          local: ["not_requested"],
          "dry-run": ["pending", "rendered", "failed"],
          github: ["pending", "confirmed", "failed"],
        }[publication.mode];
  requireCondition(
    allowed.includes(publication.status),
    "Publication status is incompatible with review completion",
  );
  if (publication.status === "rendered") {
    const preview = PreviewSchema.parse(
      await readJson(root, "publication-preview.json"),
    );
    requireCondition(stages.decision, "Preview requires an accepted decision");
    requireCondition(
      isDeepStrictEqual(preview.inline, stages.decision.inlineComments) &&
        isDeepStrictEqual(preview.approval_decision, stages.decision.approval),
      "Preview differs from accepted decision",
    );
    const progress = ProgressStateSchema.parse(
      await readJson(root, "progress.json"),
    );
    requireCondition(
      preview.publication_digest ===
        publicationDigest(stages, progress.checklist),
      "Preview inputs changed",
    );
  }
  if (publication.status !== "confirmed") {
    return;
  }
  requireCondition(
    input.publication.mode === "github",
    "Only GitHub publication has a confirmed receipt",
  );
  const progress = ProgressStateSchema.parse(
    await readJson(root, "progress.json"),
  );
  for (const [key, expected] of Object.entries({
    repo: input.publication.repository,
    pr: input.publication.prNumber,
    base: input.base,
    head: input.head,
  })) {
    requireCondition(
      progress[key] === expected,
      `Publication receipt identity mismatch: ${key}`,
    );
  }
  requireCondition(
    progress.status === "complete",
    "Publication receipt is incomplete",
  );
  requireCondition(stages.decision, "Publication receipt requires a decision");
  requireCondition(
    isDeepStrictEqual(progress.approval_decision, stages.decision.approval),
    "Publication receipt decision mismatch",
  );
  requireCondition(
    progress.publication_digest ===
      publicationDigest(stages, progress.checklist),
    "Publication frozen inputs differ from accepted artefacts",
  );
  requireCondition(
    progress.comments.main,
    "Publication receipt lacks a confirmed comment",
  );
  if (stages.decision.approval.outcome === "approve") {
    requireCondition(
      progress.approval?.status === "approved",
      "Approval receipt is not confirmed",
    );
  }
  if (stages.decision.inlineComments.length) {
    requireCondition(
      progress.inline_review,
      "Inline review receipt is missing",
    );
  }
}

async function validateSavedResult(
  root: string,
  bundle: Bundle,
  expectedFingerprint: string,
): Promise<ReviewResult> {
  const raw = await readJson(root, "result.json");
  const claims = z
    .object({
      published: z.boolean().optional(),
      readyForParent: z.boolean().optional(),
    })
    .parse(raw);
  const result = ReviewResultSchema.parse(raw);
  requireCondition(
    !claims.published || result.publication.status === "confirmed",
    "Result claims publication without confirmation",
  );
  requireCondition(
    bundle.status !== "incomplete" || !claims.readyForParent,
    "Incomplete review cannot claim publication readiness",
  );
  for (const key of ["runId", "invocationId", "base", "head"] as const) {
    requireCondition(
      result[key] === bundle.input[key],
      `Result identity mismatch: ${key}`,
    );
  }
  requireCondition(
    result.status === bundle.status,
    "Result identity mismatch: status",
  );
  requireCondition(
    result.fingerprint === expectedFingerprint,
    "Result fingerprint mismatch",
  );
  requireCondition(
    result.bundlePath === path.join(root, "bundle.json"),
    "Result bundle path mismatch",
  );
  requireCondition(
    result.reportPath ===
      (bundle.status === "incomplete"
        ? null
        : path.join(root, "review-report.md")),
    "Result report path mismatch",
  );
  await validatePublicationReceipt(root, bundle, result);
  return result;
}

export async function validateBundle(
  file: string,
  expectedFingerprint: string,
): Promise<Bundle> {
  requireCondition(
    !(await lstat(file)).isSymbolicLink(),
    "bundle.json must not be a symlink",
  );
  const raw = (await readFile(file, "utf8")).trim();
  requireCondition(
    fingerprint(raw) === expectedFingerprint,
    "Saved bundle differs from accepted workflow output",
  );
  const unknownBundle: unknown = JSON.parse(raw);
  const bundle = BundleSchema.parse(unknownBundle);
  const root = await realpath(bundle.input.artifacts);
  requireCondition(
    (await realpath(file)) === path.join(root, "bundle.json"),
    "Bundle is outside the selected artefact directory",
  );
  requireCondition(
    Boolean(bundle.failures.length) === (bundle.status === "incomplete"),
    "Failures and completion status disagree",
  );
  for (const [name, result] of Object.entries(bundle.stages)) {
    requireCondition(result.stage === name, `Stage identity mismatch: ${name}`);
    validateStage(result, bundle.stages, bundle.input);
    requireCondition(
      (await readArtifact(root, `${name}.md`)) === result.markdown,
      `Saved assessment differs: ${name}`,
    );
  }
  if (bundle.stages.setup) {
    const rules = await indexedRules(bundle.input);
    requireCondition(
      bundle.stages.setup.rulePaths.length === rules.size &&
        bundle.stages.setup.rulePaths.every((rule) => rules.has(rule)),
      "Setup rule inventory differs from supplied indexes",
    );
    const counts = await diffCounts(bundle.input);
    requireCondition(
      bundle.stages.setup.addedLines === counts.added &&
        bundle.stages.setup.deletedLines === counts.deleted,
      "Setup counts do not match the complete pinned diff",
    );
  }
  if (bundle.status === "incomplete") {
    requireCondition(
      (await readArtifact(root, "incomplete.md")).trim(),
      "Incomplete output needs a failure explanation",
    );
  } else {
    const expected =
      bundle.status === "split"
        ? ["setup", "split-plan", "decision"]
        : fullStages;
    const actual = Object.keys(bundle.stages);
    requireCondition(
      expected.length === actual.length &&
        expected.every((name) => actual.includes(name)),
      "Review has missing or unexpected stages",
    );
    requireCondition(
      bundle.stages.setup?.mode ===
        (bundle.status === "split" ? "split" : "full"),
      "Review scope mode mismatch",
    );
    requireCondition(
      (await readArtifact(root, "review-report.md")) ===
        validateReportCoverage(bundle),
      "Canonical report differs from accepted result",
    );
    await validateDecisionFiles(root, bundle);
  }
  await validateSavedResult(root, bundle, expectedFingerprint);
  return bundle;
}

export async function loadValidatedReview(
  file: string,
): Promise<{ bundle: Bundle; result: ReviewResult }> {
  const root = path.dirname(file);
  const result = ReviewResultSchema.parse(await readJson(root, "result.json"));
  const bundle = await validateBundle(file, result.fingerprint);
  return { bundle, result };
}
