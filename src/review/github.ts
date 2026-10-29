/**
 * Publish through the existing GitHub helper and retain its delivery receipts.
 * The coordinator owns progress timing and never retries a review for delivery.
 */
import { z } from "zod";
import { PublicationResultSchema } from "./contracts.js";
import type {
  GitHubRequest,
  GitHubSendInput,
  PublicationResult,
  ReviewInput,
  ReviewPublicationInput,
} from "./contracts.js";
import { errorMessage, progressChecklist, quote } from "./utils.js";

/**
 * Distinguish disabled GitHub output from publication still to do.
 */
export function initialPublication(input: ReviewInput): PublicationResult {
  const enabled = githubEnabled(input);
  let reason = "Publication has not finished";
  if (!input.github) {
    reason = "No pull request supplied";
  } else if (!enabled) {
    reason = `${input.publication} output requested`;
  }
  return {
    status: enabled ? "pending" : "skipped",
    reason,
    url: null,
    approval: null,
    statePath: enabled ? `${input.artifacts}/github.json` : null,
    newerCommits: false,
  };
}

/**
 * Respect caller restrictions before scheduling a GitHub worker.
 */
export function githubEnabled(input: ReviewInput): boolean {
  switch (input.publication) {
    case "local-only":
    case "staged":
      return false;
    default:
      return Boolean(input.github);
  }
}

/**
 * Publish accepted saved files, or interrupt an incomplete review. The Node
 * bridge independently validates files before publishing the final result.
 */
export async function publishAcceptedReview({
  input,
  state,
  bundle,
  result,
}: ReviewPublicationInput): Promise<PublicationResult> {
  if (!state.started) {
    state.publication = {
      ...state.publication,
      status: "skipped",
      reason: "Setup was not accepted; no external delivery started",
    };
    return state.publication;
  }
  if (!githubEnabled(input)) {
    return state.publication;
  }
  switch (bundle.status) {
    case "incomplete": {
      const reason = bundle.failures
        .map((failure) => `${failure.stage}: ${failure.reason}`)
        .join("; ");
      await sendGitHub({
        input,
        state,
        operation: "interrupt",
        checklist: progressChecklist(state),
        reason,
      });
      break;
    }
    case "complete":
    case "split": {
      if (!result.reportPath) {
        throw new Error("Publication requires validated saved output");
      }
      // The helper unchecks this final row until publication succeeds.
      const checklist = progressChecklist(state).replace(
        /^- \[[ x]\] publication: .+$/m,
        "- [x] publication: complete",
      );
      await sendGitHub({
        input,
        state,
        operation: "finish",
        checklist,
        fingerprint: result.fingerprint,
      });
      break;
    }
  }
  return state.publication;
}

/**
 * Keep one helper state file and one receipt per scheduled worker. Unknown
 * delivery is recorded once and recovered later through the existing helper.
 */
export async function sendGitHub({
  input,
  state,
  operation,
  checklist,
  reason = "",
  fingerprint = null,
}: GitHubSendInput): Promise<void> {
  const request: GitHubRequest = {
    input,
    operation,
    id: `${input.invocationId}-${++state.githubSequence}`,
    checklist,
    reason,
    fingerprint,
  };
  const command = [
    "node",
    "--import",
    quote(input.tsxLoader),
    quote(`${input.supportRoot}/github.ts`),
    quote(JSON.stringify(request)),
  ].join(" ");
  let instructions = "Do not review source or change the assessment.";
  switch (operation) {
    case "finish":
      instructions = `Before publishing, refresh discussion and relevant CI as required by ${input.skillRoot}/criteria.md#step-6-publish-results. If new facts invalidate the accepted assessment, execute the command with --reject followed by one shell-quoted reason instead. This records refusal without publishing. Return its actual rejected result and request a refreshed assessment. Never change the saved decision to force publication.`;
      break;
  }
  try {
    const answer = await agent(
      [
        "Execute this exact review delivery command once. Do not modify accepted files or publish through any other tool.",
        instructions,
        "Return the command's actual JSON result through StructuredOutput. If it fails or its outcome is unknown, report uncertain with the error and saved state path. Do not retry.",
        `State path: ${input.artifacts}/github.json`,
        `GitHub request: ${JSON.stringify(request)}`,
        command,
      ].join("\n"),
      {
        label: `github:${operation}:${state.githubSequence}`,
        phase: "Publication",
        schema: z.toJSONSchema(PublicationResultSchema, { target: "draft-7" }),
        gate: `${command} --check`,
      },
    );
    if (answer === null) {
      throw new Error(
        "GitHub worker failed or was skipped; delivery may have completed",
      );
    }
    state.publication = PublicationResultSchema.parse(answer);
  } catch (error) {
    state.publication = {
      ...state.publication,
      status: "uncertain",
      reason: `${errorMessage(error)}. Inspect ${input.artifacts}/github.json before retrying publication.`,
    };
  }
}
