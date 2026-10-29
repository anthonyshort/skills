/**
 * Own GitHub progress and final submission through Picco's github_comment and
 * github_review host tools. The plugin owns authentication and HTTP.
 */
import * as z from "zod";
import type { WorkflowPlugin } from "../../../workflow/create.js";
import type { ReviewContext } from "../../steps.js";
import { errorMessage } from "../../../workflow/run.js";
import type { ProgressStatuses } from "../progress.js";
import { InlineCommentSchema } from "../../schemas.js";
import type {
  ReviewInput,
  ReviewRun,
  ReviewEvent,
  ReviewResult,
  ReviewPluginResults,
  ReviewResults,
} from "../../schemas.js";
import { reviewProgress, reviewEventProgress } from "../progress.js";

const text = z
  .string()
  .min(1)
  .refine((value) => Boolean(value.trim()), "Expected non-empty text");
// Picco plugin-github receipts. Keep its rejected and uncertain outcomes distinct.
const githubId = text
  .max(32)
  .regex(/^[1-9]\d*$/)
  .refine((value) => Number.isSafeInteger(Number(value)));
const GithubFailureSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("rejected"), reason: text }),
  z.strictObject({ status: z.literal("uncertain"), message: text }),
]);
const GithubCommentReceiptSchema = z.union([
  z.strictObject({ status: z.literal("confirmed"), commentId: githubId }),
  GithubFailureSchema,
]);
const GithubReviewSuccessSchema = z.strictObject({
  status: z.literal("confirmed"),
  reviewId: githubId,
  state: z.enum(["COMMENTED", "APPROVED", "CHANGES_REQUESTED"]),
});
const GithubReviewReceiptSchema = z.union([
  GithubReviewSuccessSchema,
  GithubFailureSchema,
]);
export type PublicationResult = {
  status:
    | "skipped"
    | "pending"
    | z.infer<typeof GithubReviewReceiptSchema>["status"];
  reason: string;
  url: string | null;
  review: z.infer<typeof GithubReviewSuccessSchema> | null;
};

const GithubCommentRequestSchema = z.strictObject({
  repository: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  pullRequest: z.number().int().positive(),
  commentId: githubId.optional(),
  body: text.max(65_536),
});
type GithubCommentRequest = z.infer<typeof GithubCommentRequestSchema>;
const GithubReviewRequestSchema = GithubCommentRequestSchema.omit({
  commentId: true,
}).extend({
  action: z.enum(["comment", "approve"]),
  commitId: z.string().regex(/^[a-f0-9]{40}$/i),
  comments: z
    .array(
      InlineCommentSchema.omit({ id: true }).extend({
        path: text.max(1000),
        body: text.max(65_536),
      }),
    )
    .max(100),
});
type GithubReviewRequest = z.infer<typeof GithubReviewRequestSchema>;

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
  outcome: ReviewResults["decision"]["approval"]["outcome"];
  comments: ReviewResults["decision"]["inlineComments"];
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
 * Subscribe to review events. Comment identity stays in memory; completion
 * submits the accepted report and findings together in one GitHub review.
 */
export const createGithubComment: WorkflowPlugin<
  ReviewContext,
  ReviewEvent,
  ReviewResult,
  ReviewPluginResults["github"]
> = ({ input: { review: input }, events }) => {
  const target = input.github;
  const enabled = target && input.publication !== "local-only";
  let sequence = 0;
  let commentId: string | undefined;
  let publication: PublicationResult = {
    status: enabled ? "pending" : "skipped",
    reason: !target
      ? "No pull request supplied"
      : enabled
        ? "Publication has not finished"
        : "Local-only output requested",
    url: null,
    review: null,
  };
  let creationFailure: z.infer<typeof GithubFailureSchema> | undefined;

  events.subscribe(async (event: ReviewEvent) => {
    if (event.type === "workflowCompleted") {
      return;
    }

    // Setup establishes scope before any external progress is sent.
    const progress = reviewEventProgress(event);
    if (enabled && progress && !creationFailure) {
      await updateProgress({
        statuses: progress.statuses,
        reason: progress.reason,
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
      return publication;
    }
    if (creationFailure) {
      return {
        status: creationFailure.status,
        reason:
          creationFailure.status === "rejected"
            ? creationFailure.reason
            : creationFailure.message,
        url: commentUrl(),
        review: null,
      };
    }
    const decision = review.stages.decision;
    const report = review.stages.report ?? review.stages.splitPlan;
    if (
      !review.stages.setup ||
      review.status === "incomplete" ||
      !decision ||
      !report
    ) {
      return {
        status: "rejected",
        reason:
          "Final publication requires a complete review, report and decision",
        url: commentUrl(),
        review: null,
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
        status: "rejected",
        reason: errorMessage(error),
        url: commentUrl(),
        review: null,
      };
    }
    let receipt = await callGithubTool({
      name: "github_review",
      request,
      schema: GithubReviewReceiptSchema,
      instructions:
        "Before submitting, use available read tools to confirm the current PR head still matches commitId. For approve, also refresh CI and discussion and confirm the accepted seven-check assessment below still holds. If this cannot be verified or new blockers exist, do not submit; return rejected with the reason. Do not change the requested action or content. Accepted assessment: " +
        JSON.stringify(decision.approval),
    });
    if (receipt.status === "confirmed") {
      if (
        receipt.state ===
        (request.action === "approve" ? "APPROVED" : "COMMENTED")
      ) {
        return {
          status: "confirmed",
          reason: `GitHub confirmed ${receipt.state} for ${input.head.slice(0, 12)}`,
          url: `https://github.com/${target.repository}/pull/${target.pr}#pullrequestreview-${receipt.reviewId}`,
          review: receipt,
        };
      }
      receipt = {
        status: "uncertain",
        message:
          "GitHub returned a different review state than requested. Inspect GitHub before retrying.",
      };
    }
    return {
      status: receipt.status,
      reason: receipt.status === "rejected" ? receipt.reason : receipt.message,
      url: commentUrl(),
      review: null,
    };
  }

  /**
   * Keep updates on one comment. An unknown creation outcome disables later
   * writes so another progress event cannot create a duplicate comment.
   */
  async function updateProgress({
    statuses,
    reason = "",
  }: {
    statuses: ProgressStatuses;
    reason?: string;
  }): Promise<z.infer<typeof GithubCommentReceiptSchema>> {
    const request = GithubCommentRequestSchema.safeParse({
      repository: target?.repository,
      pullRequest: target?.pr,
      ...(commentId === undefined ? {} : { commentId }),
      body: [
        `🤖 Review of [${input.head.slice(0, 12)}](https://github.com/${target?.repository}/commit/${input.head})`,
        "### Review progress",
        progressChecklist(statuses),
        reason,
      ]
        .filter(Boolean)
        .join("\n\n"),
    });
    if (!request.success) {
      return { status: "rejected", reason: request.error.message };
    }
    let receipt = await callGithubTool({
      name: "github_comment",
      request: request.data,
      schema: GithubCommentReceiptSchema,
    });
    if (receipt.status === "confirmed") {
      if (!commentId || receipt.commentId === commentId) {
        commentId = receipt.commentId;
        return receipt;
      }
      receipt = {
        status: "uncertain",
        message:
          "GitHub returned a different comment ID for an update. Inspect GitHub before retrying.",
      };
    }
    if (commentId === undefined) {
      creationFailure = receipt;
    }
    return receipt;
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
  }): Promise<Result | z.infer<typeof GithubFailureSchema>> {
    const outputSchema = z.strictObject({ receipt: schema });
    try {
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
          schema: z.toJSONSchema(outputSchema, {
            target: "draft-7",
          }),
        },
      );
      return outputSchema.parse(answer).receipt;
    } catch (error) {
      return {
        status: "uncertain",
        message: `${name} outcome unknown: ${errorMessage(error)}. Inspect GitHub before retrying.`,
      };
    }
  }

  /**
   * Keep the progress comment accessible even when submission fails.
   */
  function commentUrl(): string | null {
    return target && commentId !== undefined
      ? `https://github.com/${target.repository}/pull/${target.pr}#issuecomment-${commentId}`
      : null;
  }

  return {
    state: {
      get publication() {
        return publication;
      },
    },
    complete: async ({ result: review }) => {
      publication = await publishToGithub({ review });

      // Keep the live comment consistent with the actual submission outcome.
      if (enabled && review.status !== "incomplete" && !creationFailure) {
        const progress = await updateProgress({
          statuses: {
            ...reviewProgress(review),
            publication:
              publication.status === "confirmed"
                ? "complete"
                : publication.status,
          },
          reason: [publication.reason, publication.url]
            .filter(Boolean)
            .join("\n"),
        });
        if (progress.status !== "confirmed") {
          publication.reason += ` Progress comment: ${progress.status === "rejected" ? progress.reason : progress.message}`;
        }
      }
    },
  };
};
/**
 * Describe actual work status without treating completed review work as passing.
 */
function progressChecklist(statuses: ProgressStatuses): string {
  return Object.entries(statuses)
    .map(
      ([name, value]) =>
        `- [${value === "complete" ? "x" : " "}] ${name}: ${value}`,
    )
    .join("\n");
}
