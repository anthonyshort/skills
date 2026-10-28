/**
 * Command bridge to the copied GitHub helper, with a receipt checked by Pi.
 * The helper remains responsible for transport, publication and recovery.
 */
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual, promisify } from "node:util";
import { z } from "zod";
import {
  GitHubRequestSchema,
  PublicationResultSchema,
} from "../../src/review/publication.js";
import type {
  GitHubRequest,
  PublicationResult,
} from "../../src/review/publication.js";
import { validateBundle } from "../../src/review/validate.js";
import { errorMessage } from "../../src/review/text.js";

const execute = promisify(execFile);
type Command = (file: string, args: string[]) => Promise<string>;
const receiptSchema = z.strictObject({
  request: GitHubRequestSchema,
  result: PublicationResultSchema,
});
const helperApproval = z.object({
  status: z.enum(["approved", "withheld"]),
  reason: z.string().optional(),
  html_url: z.string().url().optional(),
});
const helperOutput = z.object({
  status: z.enum(["reviewing", "interrupted", "complete"]),
  url: z.string().url(),
  approval: helperApproval.nullable().optional(),
});
const helperState = z.object({
  repo: z.string(),
  pr: z.number(),
  base: z.string(),
  head: z.string(),
  status: z.string(),
  comments: z.object({ main: z.object({ html_url: z.string().url() }) }),
  approval: helperApproval.nullable().optional(),
});

/**
 * A checked receipt must match this exact operation and the helper's pinned run.
 * This detects accidental mismatches; it does not sandbox a hostile writer.
 */
export async function checkGitHubReceipt(
  request: GitHubRequest,
): Promise<PublicationResult> {
  const file = `${request.input.artifacts}/github-${request.id}.json`;
  const receipt = receiptSchema.parse(JSON.parse(await readFile(file, "utf8")));
  if (!isDeepStrictEqual(receipt.request, request))
    throw new Error("GitHub receipt belongs to another operation");
  if (request.operation === "finish" && receipt.result.status === "rejected") {
    if (
      receipt.result.url ||
      receipt.result.approval ||
      receipt.result.statePath !== `${request.input.artifacts}/github.json`
    )
      throw new Error("Rejected publication cannot claim remote confirmation");
    await acceptedFinishDecision(request);
    return receipt.result;
  }
  const state = helperState.parse(
    JSON.parse(
      await readFile(`${request.input.artifacts}/github.json`, "utf8"),
    ),
  );
  const { input } = request;
  if (
    state.repo !== input.github?.repository ||
    state.pr !== input.github.pr ||
    state.base !== input.base ||
    state.head !== input.head ||
    state.comments.main.html_url !== receipt.result.url
  )
    throw new Error("GitHub state differs from requested review");
  const expectedState =
    request.operation === "finish"
      ? "complete"
      : request.operation === "interrupt"
        ? "interrupted"
        : "reviewing";
  const expectedResult =
    request.operation === "finish"
      ? "confirmed"
      : request.operation === "interrupt"
        ? "rejected"
        : "pending";
  if (
    state.status !== expectedState ||
    receipt.result.status !== expectedResult ||
    receipt.result.statePath !== `${input.artifacts}/github.json`
  ) {
    throw new Error("GitHub receipt does not confirm this operation");
  }
  if (
    !isDeepStrictEqual(receipt.result.approval, approvalResult(state.approval))
  )
    throw new Error("GitHub approval receipt differs from helper state");
  if (request.operation === "finish") {
    if (!request.fingerprint)
      throw new Error("Finish receipt has no accepted fingerprint");
    await validateBundle(`${input.artifacts}/bundle.json`, request.fingerprint);
  }
  return receipt.result;
}

/**
 * Validate accepted files before invoking the unchanged helper. Tests inject
 * only the subprocess boundary; file validation and receipt checks stay real.
 */
export async function runGitHubOperation(
  request: GitHubRequest,
  command: Command = async (file, args) => {
    const result = await execute(file, args, {
      encoding: "utf8",
      timeout: 60_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    return result.stdout;
  },
): Promise<PublicationResult> {
  const { input, operation } = request;
  if (!input.github || ["local-only", "staged"].includes(input.publication))
    throw new Error("GitHub delivery is disabled for this review");
  const statePath = `${input.artifacts}/github.json`;
  const checklistPath = `${input.artifacts}/github-checklist.md`;
  const helper = `${input.skillRoot}/scripts/github_progress.py`;
  const finishArgs =
    operation === "finish" ? await validatedFinishArguments(request) : [];
  await mkdir(input.artifacts, { recursive: true });
  await writeFile(checklistPath, request.checklist);
  const startArgs = [
    "start",
    "--repo",
    input.github.repository,
    "--pr",
    String(input.github.pr),
    "--base",
    input.base,
    "--head",
    input.head,
    "--checklist",
    checklistPath,
  ];
  const invoke = (args: string[]) =>
    command("python3", [helper, "--state", statePath, ...args]);
  // Start recovers this run's comment if an earlier response was lost.
  if (operation === "finish") await invoke(startArgs);
  if (operation === "interrupt")
    await invoke(["update", "--checklist", checklistPath]);
  const args =
    operation === "start"
      ? startArgs
      : operation === "interrupt"
        ? [operation, "--reason", request.reason]
        : [operation, "--checklist", checklistPath, ...finishArgs];
  const output = helperOutput.parse(JSON.parse(await invoke(args)));
  const expected =
    operation === "finish"
      ? "complete"
      : operation === "interrupt"
        ? "interrupted"
        : "reviewing";
  if (output.status !== expected)
    throw new Error(`Expected GitHub ${expected}, received ${output.status}`);
  let newerCommits = false;
  if (operation === "finish") {
    const pull = z
      .object({
        head: z.object({ sha: z.string() }),
        base: z.object({ sha: z.string() }),
      })
      .parse(
        JSON.parse(
          await command("gh", [
            "api",
            `repos/${input.github.repository}/pulls/${input.github.pr}`,
          ]),
        ),
      );
    newerCommits = pull.head.sha !== input.head || pull.base.sha !== input.base;
  }
  const result: PublicationResult = {
    status:
      operation === "finish"
        ? "confirmed"
        : operation === "interrupt"
          ? "rejected"
          : "pending",
    reason:
      operation === "finish"
        ? newerCommits
          ? "Published the pinned review; newer revisions remain unreviewed"
          : "GitHub confirmed publication"
        : operation === "interrupt"
          ? `Review interrupted: ${request.reason}`
          : "GitHub progress updated",
    url: output.url,
    approval: approvalResult(output.approval),
    statePath,
    newerCommits,
  };
  await writeFile(
    `${input.artifacts}/github-${request.id}.json`,
    JSON.stringify({ request, result }),
  );
  return checkGitHubReceipt(request);
}

/**
 * Prepare a publication-only decision after independently checking accepted files.
 * Comment-only delivery never changes the immutable approval assessment.
 */
async function validatedFinishArguments(
  request: GitHubRequest,
): Promise<string[]> {
  const { input } = request;
  let approval = (await acceptedFinishDecision(request)).approval;
  if (input.publication === "comment-only" && approval.outcome === "approve") {
    approval = {
      ...approval,
      outcome: "not_submitted",
      reason: "Comment-only review requested",
      next_steps: ["A reviewer may submit approval separately if requested."],
    };
  }
  const approvalPath = `${input.artifacts}/publication-approval.json`;
  await writeFile(approvalPath, JSON.stringify(approval));
  return [
    "--summary",
    `${input.artifacts}/summary.md`,
    "--report",
    `${input.artifacts}/review-report.md`,
    "--inline",
    `${input.artifacts}/inline.json`,
    "--approval",
    approvalPath,
  ];
}

/**
 * Establish the accepted review identity before either publishing or refusing it.
 */
async function acceptedFinishDecision(request: GitHubRequest) {
  if (!request.fingerprint)
    throw new Error("Finish requires an accepted fingerprint");
  const bundle = await validateBundle(
    `${request.input.artifacts}/bundle.json`,
    request.fingerprint,
  );
  if (
    !isDeepStrictEqual(bundle.input, request.input) ||
    bundle.status === "incomplete" ||
    !bundle.stages.decision
  )
    throw new Error("Finish requires this run's complete accepted output");
  return bundle.stages.decision;
}

/**
 * Preserve a freshness refusal as a checked result without touching GitHub.
 */
export async function rejectGitHubPublication(
  request: GitHubRequest,
  reason: string,
): Promise<PublicationResult> {
  if (request.operation !== "finish")
    throw new Error("Only final publication can record a freshness refusal");
  await acceptedFinishDecision(request);
  const result: PublicationResult = {
    status: "rejected",
    reason: z.string().trim().min(1).parse(reason),
    url: null,
    approval: null,
    statePath: `${request.input.artifacts}/github.json`,
    newerCommits: false,
  };
  await writeFile(
    `${request.input.artifacts}/github-${request.id}.json`,
    JSON.stringify({ request, result }),
  );
  return checkGitHubReceipt(request);
}

/**
 * Preserve the helper's distinction between assessed and submitted approval.
 */
function approvalResult(
  value: z.infer<typeof helperApproval> | null | undefined,
): PublicationResult["approval"] {
  return value
    ? {
        status: value.status,
        reason: value.reason ?? "GitHub confirmed approval",
        url: value.html_url ?? null,
      }
    : null;
}

/**
 * Execute once, or check an existing operation receipt without remote writes.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (
    !args[0] ||
    !(
      args.length === 1 ||
      (args.length === 2 && args[1] === "--check") ||
      (args.length === 3 && args[1] === "--reject")
    )
  )
    throw new Error(
      "Usage: github.ts REQUEST_JSON [--check | --reject REASON]",
    );
  const request = GitHubRequestSchema.parse(JSON.parse(args[0]));
  const result =
    args[1] === "--check"
      ? await checkGitHubReceipt(request)
      : args[1] === "--reject"
        ? await rejectGitHubPublication(request, args[2])
        : await runGitHubOperation(request);
  process.stdout.write(JSON.stringify(result) + "\n");
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    process.stderr.write(
      `GitHub delivery incomplete: ${errorMessage(error)}\n`,
    );
    process.exitCode = 1;
  });
}
