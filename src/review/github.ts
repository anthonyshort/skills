/**
 * Own GitHub progress and final submission through Picco's github_comment and
 * github_review host tools. The plugin owns authentication and HTTP.
 */
import * as z from "zod";
import {
  GithubCommentRequestSchema,
  GithubCommentReceiptSchema,
  GithubReviewRequestSchema,
  GithubReviewReceiptSchema,
} from "./contracts.js";
import type {
  GithubCommentRequest,
  GithubReviewRequest,
  PublicationResult,
  ReviewInput,
  ReviewRun,
  GithubComment,
  ReviewEvent,
  ReviewEventEmitter,
  StageSchemas,
} from "./contracts.js";
import {
  errorMessage,
  progressChecklist,
  reviewProgress,
  reviewEventProgress,
} from "./utils.js";

/**
 * Pin accepted findings to the inspected commit. Comment-only output cannot
 * approve; other non-approval outcomes retain the ordinary comment review.
 */
export function githubReviewRequest({
  input,
  outcome,
  comments,
  body,
}: {
  input: Pick<ReviewInput, "github" | "head" | "publication">;
  outcome: z.infer<typeof StageSchemas.decision>["approval"]["outcome"];
  comments: z.infer<typeof StageSchemas.decision>["inlineComments"];
  body: string;
}): GithubReviewRequest {
  if (!input.github) {
    throw new Error("GitHub review requires a pull request");
  }
  return GithubReviewRequestSchema.parse({
    repository: input.github.repository,
    pullRequest: input.github.pr,
    action:
      input.publication === "publish" && outcome === "approve"
        ? "approve"
        : "comment",
    commitId: input.head,
    body,
    comments: comments.map(({ path, line, side, body }) => ({
      path,
      line,
      side,
      body,
    })),
  });
}

/**
 * Distinguish disabled publication from a result that has not arrived yet.
 */
function initialPublication(input: ReviewInput): PublicationResult {
  const enabled = input.github && input.publication !== "local-only";
  return {
    status: enabled ? "pending" : "skipped",
    reason: !input.github
      ? "No pull request supplied"
      : enabled
        ? "Publication has not finished"
        : "Local-only output requested",
    url: null,
    review: null,
  };
}

/**
 * Subscribe to review events. Comment identity stays in memory; completion
 * submits the accepted report and findings together in one GitHub review.
 */
export function createGithubComment({
  input,
  events,
}: {
  input: ReviewInput;
  events: ReviewEventEmitter;
}): GithubComment {
  const target = input.github;
  const enabled = target && input.publication !== "local-only";
  let sequence = 0;
  let commentId: string | undefined;
  let publication = initialPublication(input);
  let creationFailure: PublicationResult | undefined;

  events.subscribe(async (event: ReviewEvent) => {
    switch (event.type) {
      case "reviewCompleted": {
        publication = await publishToGithub({ review: event.review });

        // Keep the live comment consistent with the actual submission outcome.
        if (
          enabled &&
          event.review.status !== "incomplete" &&
          !creationFailure
        ) {
          const progress = await sendComment({
            body: progressBody(
              progressChecklist({
                ...reviewProgress(event.review),
                publication:
                  publication.status === "confirmed"
                    ? "complete"
                    : publication.status,
              }),
              [publication.reason, publication.url].filter(Boolean).join("\n"),
            ),
          });
          if (progress.status !== "confirmed") {
            publication.reason += ` Progress comment: ${progress.reason}`;
          }
        }
        await events.emit({
          type: "publicationFinished",
          review: event.review,
          publication,
        });
        return;
      }
      case "publicationFinished":
        return;
    }

    // Setup establishes scope before any external progress is sent.
    const progress = reviewEventProgress(event);
    if (enabled && progress && !creationFailure) {
      await sendComment({
        body: progressBody(
          progressChecklist(progress.statuses),
          progress.reason,
        ),
      });
    }
  });

  /**
   * Submit only accepted, complete work. Preparation errors are known rejections;
   * an unconfirmed tool call remains uncertain and is never retried here.
   */
  async function publishToGithub({
    review,
  }: {
    review: ReviewRun;
  }): Promise<PublicationResult> {
    if (!enabled || !target) {
      return initialPublication(input);
    }
    if (creationFailure) {
      return creationFailure;
    }
    if (!review.stages.setup || review.status === "incomplete") {
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
      return {
        ...initialPublication(input),
        status: "rejected",
        reason: "Publication requires an accepted report and decision",
        url: commentUrl(),
      };
    }

    // All publication content comes from accepted evidence, without another review.
    const body = [
      decision.summaryMarkdown,
      report.markdown,
      "### Approval assessment",
      `${decision.approval.outcome}: ${decision.approval.reason}`,
      ...Object.entries(decision.approval.checks ?? {}).map(
        ([name, check]) => `- ${name}: ${check.result}. ${check.reason}`,
      ),
      ...decision.approval.next_steps.map((step) => `- Next step: ${step}`),
    ].join("\n\n");
    let request: GithubReviewRequest;
    try {
      request = githubReviewRequest({
        input,
        outcome: decision.approval.outcome,
        comments: decision.inlineComments,
        body,
      });
    } catch (error) {
      return {
        ...initialPublication(input),
        status: "rejected",
        reason: errorMessage(error),
        url: commentUrl(),
      };
    }
    try {
      const receipt = await callGithubTool({
        name: "github_review",
        request,
        schema: GithubReviewReceiptSchema,
        instructions:
          "Before submitting, use available read tools to confirm the current PR head still matches commitId. For approve, also refresh CI and discussion and confirm the accepted seven-check assessment below still holds. If this cannot be verified or new blockers exist, do not submit; return rejected with the reason. Do not change the requested action or content. Accepted assessment: " +
          JSON.stringify(decision.approval),
      });
      switch (receipt.status) {
        case "rejected":
          return {
            ...initialPublication(input),
            status: "rejected",
            reason: receipt.reason,
            url: commentUrl(),
          };
        case "uncertain":
          return {
            ...initialPublication(input),
            status: "uncertain",
            reason: receipt.message,
            url: commentUrl(),
          };
        case "confirmed":
          if (
            receipt.state !==
            (request.action === "approve" ? "APPROVED" : "COMMENTED")
          ) {
            throw new Error(
              "GitHub returned a different review state than requested",
            );
          }
          return {
            status: "confirmed",
            reason: `GitHub confirmed ${receipt.state} for ${input.head.slice(0, 12)}`,
            url: `https://github.com/${target.repository}/pull/${target.pr}#pullrequestreview-${receipt.reviewId}`,
            review: receipt,
          };
      }
    } catch (error) {
      return {
        ...initialPublication(input),
        status: "uncertain",
        reason: `Review outcome unknown: ${errorMessage(error)}. Inspect GitHub before retrying.`,
        url: commentUrl(),
      };
    }
  }

  /**
   * Keep updates on one comment. An unknown creation outcome disables later
   * writes so another progress event cannot create a duplicate comment.
   */
  async function sendComment({
    body,
  }: {
    body: string;
  }): Promise<PublicationResult> {
    if (!target) {
      return initialPublication(input);
    }
    let result: PublicationResult;
    const request = GithubCommentRequestSchema.safeParse({
      repository: target.repository,
      pullRequest: target.pr,
      ...(commentId === undefined ? {} : { commentId }),
      body,
    });
    if (!request.success) {
      return {
        ...initialPublication(input),
        status: "rejected",
        reason: request.error.message,
        url: commentUrl(),
      };
    }
    try {
      const receipt = await callGithubTool({
        name: "github_comment",
        request: request.data,
        schema: GithubCommentReceiptSchema,
      });
      switch (receipt.status) {
        case "confirmed":
          if (commentId && receipt.commentId !== commentId) {
            throw new Error(
              "GitHub returned a different comment ID for an update",
            );
          }
          commentId = receipt.commentId;
          return {
            ...initialPublication(input),
            status: "confirmed",
            reason: "GitHub comment updated",
            url: commentUrl(),
          };
        case "rejected":
          result = {
            ...initialPublication(input),
            status: "rejected",
            reason: receipt.reason,
            url: commentUrl(),
          };
          break;
        case "uncertain":
          result = {
            ...initialPublication(input),
            status: "uncertain",
            reason: receipt.message,
            url: commentUrl(),
          };
          break;
      }
    } catch (error) {
      result = {
        ...initialPublication(input),
        status: "uncertain",
        reason: `Comment outcome unknown: ${errorMessage(error)}. Inspect GitHub before retrying.`,
        url: commentUrl(),
      };
    }
    if (commentId === undefined) {
      creationFailure = result;
    }
    return result;
  }

  /**
   * The host provides these tools. Preserve their JSON receipts, including
   * rejection or uncertainty, without an HTTP/shell fallback or write retry.
   */
  async function callGithubTool<Result>({
    name,
    request,
    schema,
    instructions = "",
  }: {
    name: "github_comment" | "github_review";
    request: GithubCommentRequest | GithubReviewRequest;
    schema: z.ZodType<Result>;
    instructions?: string;
  }): Promise<Result> {
    const answer = await agent(
      [
        instructions,
        `When the preconditions hold, call Picco's ${name} exactly once with the JSON below. Otherwise return {receipt:{status:'rejected',reason:REASON}} without writing. Keep its arguments unchanged.`,
        "Parse the tool's JSON-string response and return {receipt: RECEIPT} through StructuredOutput with that exact receipt. If the tool is unavailable, return {receipt:{status:'rejected',reason:'Required Picco tool unavailable: TOOL_NAME'}} using the actual name. Do not emulate it through HTTP, shell or Python. Do not retry an uncertain write.",
        JSON.stringify(request),
      ]
        .filter(Boolean)
        .join("\n"),
      {
        label: `github:${name}:${++sequence}`,
        phase: "Publication",
        schema: z.toJSONSchema(z.strictObject({ receipt: schema }), {
          target: "draft-7",
        }),
      },
    );
    return z.strictObject({ receipt: schema }).parse(answer).receipt;
  }

  /**
   * Keep the progress comment accessible even when submission fails.
   */
  function commentUrl(): string | null {
    return target && commentId !== undefined
      ? `https://github.com/${target.repository}/pull/${target.pr}#issuecomment-${commentId}`
      : null;
  }

  /**
   * Identify the inspected commit rather than claiming later commits were reviewed.
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

  return {
    get publication() {
      return publication;
    },
  };
}
