/**
 * Review inputs, worker evidence and the in-memory result. Transport schemas
 * and execution mechanics belong to their respective consumers.
 */
import * as z from "zod";
import type { WorkflowEvent, WorkflowEvents } from "../workflow/run.js";
import type { PublicationResult } from "./github.js";
import type { Notification } from "./notifications.js";

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
export type StageName = (typeof stageNames)[number];
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
export type ReviewResults = {
  [Name in StageName]: z.infer<(typeof StageSchemas)[Name]>;
};
export type StageResults = Partial<ReviewResults>;
export type StageResult = ReviewResults[StageName];

/**
 * Computed review output. Worker and transport responses are parsed at their
 * boundaries; this object contains the values already accepted by the workflow.
 */
export type ReviewRun = {
  input: ReviewInput;
  status: "complete" | "split" | "incomplete";
  stages: StageResults;
  failures: { stage: StageName; reason: string }[];
  attempts: { stage: StageName; attempt: number; reason: string }[];
};
export type ReviewOutput = ReviewRun & {
  report: string | null;
  notifications: Notification[];
  approval: z.infer<typeof ApprovalSchema> | null;
  publication: PublicationResult;
};

export type ReviewEvent =
  | WorkflowEvent<ReviewResults>
  | { type: "reviewCompleted"; review: ReviewRun }
  | {
      type: "publicationFinished";
      review: ReviewRun;
      publication: PublicationResult;
    };
export type ReviewEventEmitter = Pick<
  WorkflowEvents<ReviewEvent>,
  "subscribe" | "emit"
>;
