#!/usr/bin/env node
/**
 * Check saved local review output against the accepted bundle and pinned source.
 * The workflow's stage guards own assessment and approval consistency.
 */
import { execFile } from "node:child_process";
import { lstat, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual, promisify } from "node:util";
import {
  BundleSchema,
  ReviewResultSchema,
  stageNames,
} from "../../src/review/contracts.js";
import type { Bundle, ReviewInput } from "../../src/review/contracts.js";
import { validateStage } from "../../src/review/validation.js";
import { errorMessage, fingerprint } from "../../src/review/utils.js";

const execute = promisify(execFile);

function requireCondition(
  condition: unknown,
  reason: string,
): asserts condition {
  if (!condition) {
    throw new Error(reason);
  }
}

function inside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}

async function readArtifact(root: string, name: string): Promise<string> {
  const file = path.join(root, name);
  const info = await lstat(file).catch((error) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error(`Missing artefact: ${name}`);
    }
    throw error;
  });
  requireCondition(
    !info.isSymbolicLink() &&
      info.isFile() &&
      inside(root, await realpath(file)),
    `Artefact escapes directory or is not a file: ${name}`,
  );
  return readFile(file, "utf8");
}

async function readJson(root: string, name: string): Promise<unknown> {
  const value: unknown = JSON.parse(await readArtifact(root, name));
  return value;
}

/**
 * Read every supplied rule index independently of the setup agent's inventory.
 */
async function indexedRules(input: ReviewInput): Promise<Set<string>> {
  const paths: string[] = [];
  for (const root of [input.skillRoot, ...input.wrapperSkillRoots]) {
    const directory = await realpath(path.join(root, "rules"));
    const index = await readFile(path.join(directory, "README.md"), "utf8");
    for (const match of index.matchAll(
      /\[[^\]]+\]\(([^)#]+\.md)(?:#[^)]*)?\)/g,
    )) {
      const file = await realpath(path.resolve(directory, match[1]));
      requireCondition(
        inside(directory, file),
        `Indexed rule escapes its collection: ${file}`,
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

/**
 * Verify the inspected checkout and the complete base-to-head change counts.
 */
async function validateScope(bundle: Bundle): Promise<void> {
  const { input, stages } = bundle;
  if (!stages.setup) {
    return;
  }
  const git = async (...args: string[]) => {
    const result = await execute(
      "git",
      ["-C", input.repository, "-c", "core.fsmonitor=false", ...args],
      { encoding: "utf8", timeout: 30_000, maxBuffer: 16 * 1024 * 1024 },
    );
    return result.stdout.trim();
  };
  requireCondition(
    (await git("rev-parse", "HEAD")) === input.head,
    "Checkout HEAD differs from reviewed head",
  );
  requireCondition(
    !(await git("status", "--porcelain", "--untracked-files=all")),
    "Reviewed checkout contains uncommitted changes",
  );
  const changes = await git(
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
  for (const line of changes.split("\n").filter(Boolean)) {
    const [additions, deletions] = line.split("\t");
    if (additions === "-") {
      continue;
    }
    requireCondition(
      /^\d+$/.test(additions) && /^\d+$/.test(deletions),
      "Unexpected git diff statistics",
    );
    added += Number(additions);
    deleted += Number(deletions);
  }
  requireCondition(
    stages.setup.addedLines === added && stages.setup.deletedLines === deleted,
    "Setup counts do not match the complete pinned diff",
  );
  const rules = await indexedRules(input);
  requireCondition(
    stages.setup.rulePaths.length === rules.size &&
      stages.setup.rulePaths.every((rule) => rules.has(rule)),
    "Setup rule inventory differs from supplied indexes",
  );
}

/**
 * Keep the canonical report self-contained without losing individual outcomes.
 */
function reportMarkdown(bundle: Bundle): string {
  const { stages, status } = bundle;
  const report = status === "split" ? stages.splitPlan : stages.report;
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

async function validateResult(
  root: string,
  bundle: Bundle,
  acceptedFingerprint: string,
): Promise<void> {
  const result = ReviewResultSchema.parse(await readJson(root, "result.json"));
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
    result.fingerprint === acceptedFingerprint,
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
}

/**
 * Validate the exact accepted snapshot before returning local review artefacts.
 * Hashing catches accidental writer changes, not deliberately hostile output.
 */
export async function validateBundle(
  file: string,
  acceptedFingerprint: string,
): Promise<Bundle> {
  requireCondition(
    !(await lstat(file)).isSymbolicLink(),
    "bundle.json must not be a symlink",
  );
  const raw = (await readFile(file, "utf8")).trim();
  requireCondition(
    fingerprint(raw) === acceptedFingerprint,
    "Saved bundle differs from accepted workflow output",
  );
  const value: unknown = JSON.parse(raw);
  const bundle = BundleSchema.parse(value);
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
    validateStage({
      result,
      prior: bundle.stages,
      input: bundle.input,
    });
    requireCondition(
      (await readArtifact(root, `${name}.md`)) === result.markdown,
      `Saved assessment differs: ${name}`,
    );
  }
  await validateScope(bundle);
  if (bundle.status === "incomplete") {
    requireCondition(
      (await readArtifact(root, "incomplete.md")).trim(),
      "Incomplete output needs a failure explanation",
    );
  } else {
    const expected =
      bundle.status === "split"
        ? ["setup", "splitPlan", "decision"]
        : stageNames.filter((name) => name !== "splitPlan");
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
      (await readArtifact(root, "review-report.md")) === reportMarkdown(bundle),
      "Canonical report differs from accepted result",
    );
    await validateDecisionFiles(root, bundle);
  }
  await validateResult(root, bundle, acceptedFingerprint);
  return bundle;
}

/**
 * Validate a writer's saved bundle against the fingerprint accepted by the VM.
 * The gate succeeds only when validation returns; errors produce a non-zero exit.
 */
export async function main(args = process.argv.slice(2)): Promise<void> {
  if (args.length !== 3 || args[1] !== "--fingerprint") {
    throw new Error("Usage: validate-bundle.ts BUNDLE --fingerprint VALUE");
  }
  const bundle = await validateBundle(args[0], args[2]);
  process.stdout.write(
    JSON.stringify({
      status: bundle.status,
      head: bundle.input.head,
      validated: true,
    }) + "\n",
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    process.stderr.write(
      `Review artefact validation failed: ${errorMessage(error)}\n`,
    );
    process.exitCode = 1;
  });
}
