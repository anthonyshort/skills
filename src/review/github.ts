/**
 * Own one live GitHub comment and publish accepted content through Picco tools.
 * The workflow retains the comment ID; the plugin owns authentication and HTTP.
 */
import * as z from "zod";
import { GithubCommentAnswerSchema } from "./contracts.js";
import type {
  GithubCommentRequest,
  PublicationResult,
  ReviewInput,
  ReviewRun,
  GithubComment,
  ReviewEvent,
  ReviewEventEmitter,
} from "./contracts.js";
import {
  errorMessage,
  progressChecklist,
  reviewProgress,
  reviewEventProgress,
} from "./utils.js";

/**
 * Distinguish disabled publication from a result that has not arrived yet.
 */
function initialPublication(input: ReviewInput): PublicationResult {
  const enabled =
    input.github && ["publish", "comment-only"].includes(input.publication);
  return {
    status: enabled ? "pending" : "skipped",
    reason: !input.github
      ? "No pull request supplied"
      : enabled
        ? "Publication has not finished"
        : `${input.publication} output requested`,
    url: null,
  };
}

/**
 * Subscribe to review events. The comment ID stays in memory, and publication
 * receives accepted Markdown and JSON directly rather than reading files.
 */
export function createGithubComment({
  input,
  events,
}: {
  input: ReviewInput;
  events: ReviewEventEmitter;
}): GithubComment {
  const target = input.github;
  const enabled =
    target && ["publish", "comment-only"].includes(input.publication);
  let sequence = 0;
  let commentId: string | undefined;
  let publication = initialPublication(input);
  let creationFailure: PublicationResult | undefined;

  /**
   * Events update the live comment; only accepted completion publishes a report.
   */
  async function onEvent(event: ReviewEvent): Promise<void> {
    switch (event.type) {
      case "reviewCompleted": {
        publication = await publishToGithub({ review: event.review });
        const finished: ReviewEvent = {
          type: "publicationFinished",
          review: event.review,
          publication,
        };
        await events.emit(finished);
        return;
      }
      case "publicationFinished":
        return;
    }
    await updateComment(event);
  }

  /**
   * Keep later events on the same comment. An unknown create outcome disables
   * further writes instead of risking another comment on the next event.
   */
  async function updateComment(event: ReviewEvent): Promise<void> {
    if (!enabled || !target || creationFailure) {
      return;
    }
    const progress = reviewEventProgress(event);
    if (!progress) {
      return;
    }
    const operation =
      progress.status === "blocked"
        ? "interrupt"
        : commentId === undefined
          ? "start"
          : "update";
    await sendComment({
      operation,
      body: progressBody(progressChecklist(progress.statuses), progress.reason),
    });
  }

  /**
   * Build the final comment from the accepted report and approval assessment.
   */
  async function publishToGithub({
    review,
  }: {
    review: ReviewRun;
  }): Promise<PublicationResult> {
    if (!review.stages.setup) {
      return {
        ...initialPublication(input),
        status: "skipped",
        reason: "Setup was not accepted",
      };
    }
    if (!enabled || !target) {
      return initialPublication(input);
    }
    if (creationFailure) {
      return creationFailure;
    }
    if (review.status === "incomplete") {
      return {
        ...initialPublication(input),
        status: "rejected",
        reason: "Final publication withheld because the review is incomplete",
        url: commentUrl(),
      };
    }
    const decision = review.stages.decision;
    const report = review.stages.report ?? review.stages.splitPlan;
    if (!decision || !report) {
      throw new Error("Publication requires an accepted report and decision");
    }
    const checklist = progressChecklist({
      ...reviewProgress({
        stages: review.stages,
        failures: review.failures,
      }),
      publication: "complete",
    });
    const approval = [
      "### Approval assessment",
      `${decision.approval.outcome}: ${decision.approval.reason}`,
      ...Object.entries(decision.approval.checks ?? {}).map(
        ([name, check]) => `- ${name}: ${check.result}. ${check.reason}`,
      ),
    ].join("\n");
    const nextSteps = decision.approval.next_steps.length
      ? `#### Next steps\n\n${decision.approval.next_steps.map((step) => `- ${step}`).join("\n")}`
      : "";
    return sendComment({
      operation: "finish",
      body: [
        progressBody(checklist),
        "### Result",
        decision.summaryMarkdown,
        nextSteps,
        "<details>\n<summary>Full report</summary>\n",
        report.markdown,
        approval,
        "</details>",
      ]
        .filter(Boolean)
        .join("\n\n"),
    });
  }

  /**
   * Give the agent the comment ID and exact body. Its configured GitHub tool
   * owns authentication and HTTP; it returns actual IDs and outcomes.
   */
  async function sendComment({
    operation,
    body,
  }: {
    operation: "start" | "update" | "interrupt" | "finish";
    body: string;
  }): Promise<PublicationResult> {
    if (!target) {
      return initialPublication(input);
    }
    const request: GithubCommentRequest = {
      repository: target.repository,
      pullRequest: target.pr,
      ...(commentId === undefined ? {} : { commentId }),
      body,
    };
    try {
      const answer = await agent(
        [
          "Call the Picco github_comment tool exactly once with the JSON below. Omit commentId to create a comment; when supplied, update that exact comment. Do not change the body.",
          "Return the actual string commentId and error:null through StructuredOutput. If the tool is unavailable or fails, return commentId:null and the error. Do not emulate the tool with HTTP, shell commands or a Python helper. Do not retry an uncertain write.",
          JSON.stringify(request),
        ].join("\n"),
        {
          label: `github:${operation}:${++sequence}`,
          phase: "Publication",
          schema: z.toJSONSchema(GithubCommentAnswerSchema, {
            target: "draft-7",
          }),
        },
      );
      const result = GithubCommentAnswerSchema.parse(answer);
      if (!result.commentId || result.error) {
        throw new Error(result.error ?? "GitHub tool returned no comment ID");
      }
      if (commentId && result.commentId !== commentId) {
        throw new Error(
          "GitHub tool returned a different comment ID for an update",
        );
      }
      commentId = result.commentId;
      return {
        ...initialPublication(input),
        status:
          operation === "finish"
            ? "confirmed"
            : operation === "interrupt"
              ? "rejected"
              : "pending",
        reason:
          operation === "finish"
            ? "GitHub confirmed the review comment"
            : "GitHub comment updated",
        url: commentUrl(),
      };
    } catch (error) {
      const result: PublicationResult = {
        ...initialPublication(input),
        status: "uncertain",
        url: commentUrl(),
        reason: `GitHub outcome unknown: ${errorMessage(error)}. Inspect the PR before retrying.`,
      };
      if (commentId === undefined) {
        creationFailure = result;
      }
      return result;
    }
  }

  /**
   * Keep the known live comment accessible even when final publication fails.
   */
  function commentUrl(): string | null {
    return target && commentId !== undefined
      ? `https://github.com/${target.repository}/pull/${target.pr}#issuecomment-${commentId}`
      : null;
  }

  /**
   * Identify the reviewed commit rather than implying later commits were checked.
   */
  function progressBody(checklist: string, reason = ""): string {
    return [
      `🤖 Review of [${input.head.slice(0, 12)}](https://github.com/${target?.repository}/commit/${input.head})`,
      "### Review progress",
      checklist,
      reason,
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  events.subscribe(onEvent);
  return {
    get publication() {
      return publication;
    },
  };
}
