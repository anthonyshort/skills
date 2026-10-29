/**
 * Shared wire formats for review inputs, worker answers and in-memory results.
 * Schemas define the data returned by workers and the workflow.
 */
import * as z from "zod";

const text = z
  .string()
  .min(1)
  .refine((value) => Boolean(value.trim()), "Expected non-empty text");
const strings = z.array(text).max(10_000);
const absolutePath = text.refine(
  (value) =>
    value.startsWith("/") &&
    !/[\n\r\0]/.test(value) &&
    !value.split("/").includes(".."),
  "Expected an absolute path without parent traversal or control characters",
);
const revision = z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/);
const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);

export const ReviewInputSchema = z.strictObject({
  packageRoot: absolutePath,
  repository: absolutePath,
  target: text,
  base: revision,
  head: revision,
  skillRoot: absolutePath,
  runId: identifier,
  wrapperSkillRoots: z.array(absolutePath).max(20).default([]),
  contextFiles: z.array(absolutePath).max(20).default([]),
  github: z
    .strictObject({
      repository: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
      pr: z.number().int().positive(),
    })
    .nullable()
    .default(null),
  publication: z
    .enum(["publish", "local-only", "comment-only"])
    .default("publish"),
  notification: z
    .strictObject({ messageKey: text.max(200) })
    .nullable()
    .default(null),
});
export type ReviewInput = z.infer<typeof ReviewInputSchema>;

/**
 * Resolve the review skill location and default notification key before
 * scheduling the first worker.
 */
export function parseReviewInput(value: unknown): ReviewInput {
  const roots = z
    .object({
      packageRoot: absolutePath,
      skillRoot: absolutePath.optional(),
    })
    .parse(value);
  const supplied = z.record(z.string(), z.unknown()).parse(value);
  return ReviewInputSchema.parse({
    ...supplied,
    notification:
      supplied.notification === undefined
        ? { messageKey: `review:${supplied.runId}` }
        : supplied.notification,
    skillRoot: roots.skillRoot ?? `${roots.packageRoot}/skills/review`,
  });
}

export const CheckSchema = z.strictObject({
  guidance: text,
  item: text,
  method: text,
  result: z.enum([
    "Source checked",
    "CI passed",
    "CI failed",
    "CI pending",
    "CI skipped",
    "CI cancelled",
    "Concern found",
    "Blocked",
    "Not run",
    "N/A",
  ]),
  evidence: strings,
  reason: text,
});
export const FindingSchema = z.strictObject({
  id: text,
  kind: z.enum([
    "bug",
    "readability",
    "question",
    "convention",
    "preference",
    "opportunity",
  ]),
  disposition: z.enum(["required", "optional", "open"]),
  title: text,
  location: text,
  trigger: text,
  effect: text,
  action: text,
  evidence: z.array(text).min(1).max(10_000),
  existingThread: z.string().nullable(),
});
export const RuleSchema = z.strictObject({
  path: text,
  selection: z.enum(["selected", "skipped"]),
  result: z.enum([
    "Satisfied",
    "Concern found",
    "Not applicable",
    "Not verified",
    "Skipped",
  ]),
  reason: text,
  evidence: strings,
});
export const FindingDecisionSchema = z.strictObject({
  sourceId: text,
  disposition: z.enum(["retained", "merged", "excluded", "open"]),
  reportId: z.string().nullable(),
  reason: text,
});
const approvalCheck = z.strictObject({
  result: z.enum(["Pass", "Fail", "Not verified"]),
  reason: text,
});
export const ApprovalSchema = z.strictObject({
  outcome: z.enum([
    "split",
    "human_review",
    "incomplete",
    "changes_needed",
    "waiting_checks",
    "not_submitted",
    "approve",
  ]),
  changed_lines: z.number().int().nonnegative(),
  checks: z
    .strictObject({
      focused: approvalCheck,
      low_risk: approvalCheck,
      no_sensitive_changes: approvalCheck,
      clean_review: approvalCheck,
      complete_review: approvalCheck,
      verification: approvalCheck,
      concerns_resolved: approvalCheck,
    })
    .nullable(),
  reason: text,
  next_steps: strings,
});
export const InlineCommentSchema = z.strictObject({
  id: text,
  path: text,
  line: z.number().int().positive(),
  side: z.enum(["LEFT", "RIGHT"]),
  body: text,
});
export const assessmentNames = [
  "product",
  "systemFit",
  "simplicity",
  "readability",
  "correctness",
] as const;
export const stageNames = [
  "setup",
  "research",
  "researchCheck",
  ...assessmentNames,
  "rules",
  "consolidation",
  "draft",
  "editorial",
  "report",
  "splitPlan",
  "decision",
] as const;
export const StageNameSchema = z.enum(stageNames);
export type StageName = z.infer<typeof StageNameSchema>;
const envelope = {
  base: revision,
  head: revision,
  markdown: z.string().min(1),
  checks: z.array(CheckSchema).min(1).max(10_000),
  findings: z.array(FindingSchema).max(10_000),
  gaps: strings,
};
export const StageSchemas = {
  setup: z.strictObject({
    ...envelope,
    stage: z.literal("setup"),
    mode: z.enum(["full", "split"]),
    addedLines: z.number().int().nonnegative(),
    deletedLines: z.number().int().nonnegative(),
    sizeException: z.string().nullable(),
    rulePaths: z.array(text).max(1000),
  }),
  research: z.strictObject({ ...envelope, stage: z.literal("research") }),
  researchCheck: z.strictObject({
    ...envelope,
    stage: z.literal("researchCheck"),
  }),
  product: z.strictObject({ ...envelope, stage: z.literal("product") }),
  systemFit: z.strictObject({ ...envelope, stage: z.literal("systemFit") }),
  simplicity: z.strictObject({ ...envelope, stage: z.literal("simplicity") }),
  readability: z.strictObject({ ...envelope, stage: z.literal("readability") }),
  correctness: z.strictObject({ ...envelope, stage: z.literal("correctness") }),
  rules: z.strictObject({
    ...envelope,
    stage: z.literal("rules"),
    rules: z.array(RuleSchema).max(1000),
  }),
  consolidation: z.strictObject({
    ...envelope,
    stage: z.literal("consolidation"),
  }),
  draft: z.strictObject({ ...envelope, stage: z.literal("draft") }),
  editorial: z.strictObject({ ...envelope, stage: z.literal("editorial") }),
  report: z.strictObject({
    ...envelope,
    stage: z.literal("report"),
    decisions: z.array(FindingDecisionSchema).max(10_000),
  }),
  splitPlan: z.strictObject({ ...envelope, stage: z.literal("splitPlan") }),
  decision: z.strictObject({
    ...envelope,
    stage: z.literal("decision"),
    findings: z.array(FindingSchema).max(0),
    approval: ApprovalSchema,
    summaryMarkdown: z.string().min(1),
    inlineComments: z.array(InlineCommentSchema).max(100),
  }),
};
export const StageSchema = z.discriminatedUnion("stage", [
  StageSchemas.setup,
  StageSchemas.research,
  StageSchemas.researchCheck,
  StageSchemas.product,
  StageSchemas.systemFit,
  StageSchemas.simplicity,
  StageSchemas.readability,
  StageSchemas.correctness,
  StageSchemas.rules,
  StageSchemas.consolidation,
  StageSchemas.draft,
  StageSchemas.editorial,
  StageSchemas.report,
  StageSchemas.splitPlan,
  StageSchemas.decision,
]);
export type StageResult = z.infer<typeof StageSchema>;
export type StageResults = {
  [Name in StageName]?: z.infer<(typeof StageSchemas)[Name]>;
};
export const StageResultsSchema = z.strictObject({
  setup: StageSchemas.setup.optional(),
  research: StageSchemas.research.optional(),
  researchCheck: StageSchemas.researchCheck.optional(),
  product: StageSchemas.product.optional(),
  systemFit: StageSchemas.systemFit.optional(),
  simplicity: StageSchemas.simplicity.optional(),
  readability: StageSchemas.readability.optional(),
  correctness: StageSchemas.correctness.optional(),
  rules: StageSchemas.rules.optional(),
  consolidation: StageSchemas.consolidation.optional(),
  draft: StageSchemas.draft.optional(),
  editorial: StageSchemas.editorial.optional(),
  report: StageSchemas.report.optional(),
  splitPlan: StageSchemas.splitPlan.optional(),
  decision: StageSchemas.decision.optional(),
});
export const FailureSchema = z.strictObject({ stage: text, reason: text });
export const AttemptSchema = z.strictObject({
  stage: StageNameSchema,
  attempt: z.number().int().positive(),
  reason: text,
});
/**
 * Receipt returned by the host's keyed notification broadcast. The host chooses
 * destinations from the authenticated session; callers supply no recipient.
 */
export const NotificationBroadcastSchema = z.object({
  scope: text,
  messageKey: text.optional(),
  deliveries: z
    .array(
      z.object({
        deliveryId: text,
        destination: text,
        status: z.enum(["in-flight", "confirmed", "rejected", "uncertain"]),
        externalId: z.string().nullable(),
        duplicate: z.boolean(),
      }),
    )
    .max(100),
});
export const NotificationReceiptSchema = z.strictObject({
  status: z.enum(["confirmed", "rejected", "uncertain"]),
  reason: text,
  broadcast: NotificationBroadcastSchema.nullable().default(null),
});
export const NotificationSchema = z.strictObject({
  stage: text,
  status: text,
  receipt: NotificationReceiptSchema,
});
export const ReviewStatusSchema = z.enum(["complete", "split", "incomplete"]);
export const ReviewRunSchema = z.strictObject({
  input: ReviewInputSchema,
  status: ReviewStatusSchema,
  stages: StageResultsSchema,
  failures: z.array(FailureSchema).max(100),
  attempts: z.array(AttemptSchema).max(100),
});
export type ReviewRun = z.infer<typeof ReviewRunSchema>;

/**
 * Review-specific response shape for notification workers.
 * Pi supplies StructuredOutput; these response fields belong to our workflow.
 */
export const NotificationAnswerSchema = z.strictObject({
  broadcast: NotificationBroadcastSchema.nullable(),
  reason: z.string().min(1),
});

// Pi's restricted VM has no URL global for Zod's URL validator.
const githubUrl = z
  .string()
  .max(4096)
  .regex(/^https:\/\/github\.com\/[^\s]+$/);
export const PublicationResultSchema = z.strictObject({
  status: z.enum(["skipped", "pending", "confirmed", "uncertain", "rejected"]),
  reason: z.string().min(1),
  url: githubUrl.nullable(),
});
export type PublicationResult = z.infer<typeof PublicationResultSchema>;

export const GithubCommentRequestSchema = z.strictObject({
  repository: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  pullRequest: z.number().int().positive(),
  commentId: text.optional(),
  body: text,
});
export type GithubCommentRequest = z.infer<typeof GithubCommentRequestSchema>;
export const GithubCommentAnswerSchema = z.strictObject({
  commentId: text.nullable(),
  error: text.nullable(),
});

/**
 * Return accepted evidence and the final report directly to the caller.
 * Delivery outcomes are separate from the review's approval assessment.
 */
export const ReviewOutputSchema = ReviewRunSchema.extend({
  report: z.string().nullable(),
  notifications: z.array(NotificationSchema).max(1000),
  approval: ApprovalSchema.nullable(),
  publication: PublicationResultSchema,
});
export type ReviewOutput = z.infer<typeof ReviewOutputSchema>;

/**
 * Review stages share progress names with the assessment barrier and
 * delivery. Statuses reuse the review and publication outcomes where applicable.
 */
export type ReviewStep = StageName | "assessments";
export type ProgressStep = ReviewStep | "publication" | "review";
export type ProgressStatus =
  | z.infer<typeof ReviewStatusSchema>
  | PublicationResult["status"]
  | "running"
  | "blocked";

/**
 * A rendered progress snapshot, derived from accepted work and recorded failures.
 * It is sent to delivery workers without being retained as review state.
 */
export type ProgressStatuses = Partial<Record<ProgressStep, ProgressStatus>>;
export type ReviewProgressInput = {
  stages: Readonly<StageResults>;
  failures: readonly ReviewRun["failures"][number][];
};

/**
 * Host notification receipts and the latch that stops sends after a missing
 * tool or changed session scope. Review and GitHub state live elsewhere.
 */
export type NotificationState = {
  receipts: z.infer<typeof NotificationSchema>[];
  enabled: boolean;
};

/**
 * Explicit inputs shared by the named review steps. No scheduling methods or
 * prompt selection are attached to this data.
 */
export type ReviewStepInput = {
  input: ReviewInput;
  context: StageResults;
  attempts: ReviewRun["attempts"];
};

/**
 * Inputs to our agent wrapper. The caller supplies the task and schema; the
 * wrapper adds common rules, revision pins, validation and bounded retries.
 */
export type ReviewAgentInput<Result extends StageResult> = ReviewStepInput & {
  label: StageName;
  schema: z.ZodType<Result>;
  prompt: string;
  validate?: (result: Result) => void;
};

/**
 * Events expose a stable view of accepted evidence. The workflow owns these
 * results; observers use the view for display rather than accumulating copies.
 */
export type ReviewSnapshot = {
  readonly stages: Readonly<StageResults>;
  readonly failures: readonly ReviewRun["failures"][number][];
};
export type ReviewStepEvent = {
  readonly step: ReviewStep;
  readonly snapshot: ReviewSnapshot;
} & (
  | { readonly type: "stepStarted" }
  | { readonly type: "stepAccepted" }
  | { readonly type: "stepFailed"; readonly reason: string }
);
export type ReviewEvent =
  | ReviewStepEvent
  | { type: "reviewCompleted"; review: ReviewRun }
  | {
      type: "publicationFinished";
      review: ReviewRun;
      publication: PublicationResult;
    };

export type ReviewWorkflowInput = {
  input: ReviewInput;
  events: Pick<ReviewEventEmitter, "emit">;
};
export type ReviewStepTask<Result extends StageResult | void> = {
  step: ReviewStep;
  run: (args: ReviewStepInput) => Promise<Result>;
};
/**
 * Coordinate acceptance and lifecycle events without choosing the review order.
 */
export type StepCoordinator = {
  runStep: <Result extends StageResult | void>(
    args: ReviewStepTask<Result>,
  ) => Promise<Result>;
  runAssessments: () => Promise<void>;
  readonly hasFailures: boolean;
  finish: () => ReviewRun;
};
/**
 * A per-run emitter awaits every observer, including nested emissions.
 */
export type ReviewEventHandler = (event: ReviewEvent) => void | Promise<void>;
export type ReviewEventEmitter = {
  subscribe: (handler: ReviewEventHandler) => void;
  emit: (event: ReviewEvent) => Promise<void>;
};
export type ReviewEventProgress = {
  statuses: ProgressStatuses;
  stage: ProgressStep;
  status: ProgressStatus;
  reason: string;
};
export type ReviewNotifications = {
  readonly receipts: z.infer<typeof NotificationSchema>[];
};

export type NotificationUpdateInput = {
  input: ReviewInput;
  state: NotificationState;
  statuses: ProgressStatuses;
  stage: ProgressStep;
  status: ProgressStatus;
  reason?: string;
};

/**
 * One GitHub comment owns its request sequencing and event operations. The
 * workflow keeps its comment identity in memory for this run.
 */
export type GithubComment = {
  readonly publication: PublicationResult;
};

export type RequestHostNotificationInput = {
  input: ReviewInput;
  label: string;
  text: string;
};
