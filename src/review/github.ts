/**
 * Publish through the existing GitHub helper and retain its delivery receipts.
 * The coordinator owns progress timing and never retries a review for delivery.
 */
import * as z from "zod";
import publicationInstructions from "./prompts/publication.md";
import { PublicationResultSchema } from "./contracts.js";
import type {
  GitHubRequest,
  GitHubSendInput,
  PublicationResult,
  ReviewInput,
  SavedReview,
  GithubComment,
  GithubCommentEvent,
} from "./contracts.js";
import {
  errorMessage,
  progressChecklist,
  quote,
  reviewProgress,
} from "./utils.js";

/**
 * Distinguish disabled GitHub output from publication still to do.
 */
function initialPublication(input: ReviewInput): PublicationResult {
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
function githubEnabled(input: ReviewInput): boolean {
  switch (input.publication) {
    case "local-only":
    case "staged":
      return false;
    default:
      return Boolean(input.github);
  }
}

/**
 * Own the live GitHub comment for one review invocation. Only the request
 * sequence lives in memory; github.json stores comment identity and recovery.
 */
export function createGithubComment({
  input,
}: {
  input: ReviewInput;
}): GithubComment {
  let sequence = 0;

  /**
   * Translate events into comment operations without rebuilding review state.
   * Successful final publication has already updated the comment via finish.
   */
  async function handleEvent({
    event,
    checklist,
    reason,
  }: GithubCommentEvent): Promise<void> {
    if (!githubEnabled(input)) {
      return;
    }
    let operation: GitHubRequest["operation"];
    switch (event.type) {
      case "stepStarted":
      case "stepAccepted":
        if (!event.snapshot.stages.setup) {
          return;
        }
        operation = sequence === 0 ? "start" : "update";
        break;
      case "stepFailed":
        if (!event.snapshot.stages.setup) {
          return;
        }
        operation = "interrupt";
        break;
      case "runFailed":
        if (!event.review.stages.setup) {
          return;
        }
        operation = "interrupt";
        break;
      case "runFinished":
        if (
          !event.saved.bundle.stages.setup ||
          event.saved.bundle.status === "incomplete" ||
          event.publication.status !== "rejected"
        ) {
          return;
        }
        // A refused final report must not leave the live comment running.
        operation = "interrupt";
        reason = event.publication.reason;
        break;
    }
    await sendGitHub({ operation, checklist, reason });
  }

  /**
   * Publish accepted saved files and withhold incomplete reviews. The Node bridge
   * independently validates files before publishing the final result.
   */
  async function publishToGithub({
    saved,
  }: {
    saved: SavedReview;
  }): Promise<PublicationResult> {
    const { bundle, result } = saved;
    if (!bundle.stages.setup) {
      return {
        ...initialPublication(input),
        status: "skipped",
        reason: "Setup was not accepted; no external delivery started",
      };
    }
    if (!githubEnabled(input)) {
      return initialPublication(input);
    }
    switch (bundle.status) {
      case "incomplete": {
        const reason = bundle.failures
          .map((failure) => `${failure.stage}: ${failure.reason}`)
          .join("; ");
        return {
          ...initialPublication(input),
          status: "rejected",
          reason: `Final publication withheld because review is incomplete${reason ? `: ${reason}` : ""}`,
        };
      }
      case "complete":
      case "split": {
        if (!result.reportPath) {
          throw new Error("Publication requires validated saved output");
        }
        const statuses = reviewProgress({
          stages: bundle.stages,
          failures: bundle.failures,
          saved: true,
        });
        // The helper unchecks this final row until publication succeeds.
        const checklist = progressChecklist({
          ...statuses,
          publication: "complete",
        });
        return sendGitHub({
          operation: "finish",
          checklist,
          fingerprint: result.fingerprint,
        });
      }
    }
  }

  /**
   * Keep one helper state file and one receipt per scheduled worker. Unknown
   * delivery is recorded once and recovered later through the existing helper.
   */
  async function sendGitHub({
    operation,
    checklist,
    reason = "",
    fingerprint = null,
  }: GitHubSendInput): Promise<PublicationResult> {
    const request: GitHubRequest = {
      input,
      operation,
      id: `${input.invocationId}-${++sequence}`,
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
        instructions = publicationInstructions;
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
          label: `github:${operation}:${sequence}`,
          phase: "Publication",
          schema: z.toJSONSchema(PublicationResultSchema, {
            target: "draft-7",
          }),
          gate: `${command} --check`,
        },
      );
      if (answer === null) {
        throw new Error(
          "GitHub worker failed or was skipped; delivery may have completed",
        );
      }
      return PublicationResultSchema.parse(answer);
    } catch (error) {
      return {
        ...initialPublication(input),
        status: "uncertain",
        reason: `${errorMessage(error)}. Inspect ${input.artifacts}/github.json before retrying publication.`,
      };
    }
  }

  return { handleEvent, publishToGithub };
}
