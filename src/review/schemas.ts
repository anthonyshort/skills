/**
 * Review inputs, worker evidence and the in-memory result. Transport schemas
 * and execution mechanics belong to their respective consumers.
 */
import * as z from "zod";
import type { WorkflowEvent } from "../workflow/run.js";
import type { WorkflowCompleted } from "../workflow/create.js";
import type { PublicationResult } from "./plugins/github/index.js";
import type { Notification } from "./plugins/notifications/index.js";

/**
 * Non-blank model text, retaining the worker’s original whitespace.
 */
export const text = z
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
/**
 * Evidence fields shared by every review worker. Steps extend this schema locally.
 */
export const ReviewEvidenceSchema = z.strictObject({
  base: revision,
  head: revision,
  markdown: z.string().min(1),
  checks: z.array(CheckSchema).min(1).max(10_000),
  findings: z.array(FindingSchema).max(10_000),
  gaps: strings,
});
export type ReviewResults = {
  setup: Awaited<ReturnType<typeof import("./steps.js").setupReview>>;
  research: Awaited<ReturnType<typeof import("./steps.js").researchReview>>;
  researchCheck: Awaited<ReturnType<typeof import("./steps.js").checkResearch>>;
  product: Awaited<ReturnType<typeof import("./steps.js").assessProduct>>;
  systemFit: Awaited<ReturnType<typeof import("./steps.js").assessSystemFit>>;
  simplicity: Awaited<ReturnType<typeof import("./steps.js").assessSimplicity>>;
  readability: Awaited<
    ReturnType<typeof import("./steps.js").assessReadability>
  >;
  correctness: Awaited<
    ReturnType<typeof import("./steps.js").assessCorrectness>
  >;
  rules: Awaited<ReturnType<typeof import("./steps.js").checkRules>>;
  consolidation: Awaited<
    ReturnType<typeof import("./steps.js").consolidateReview>
  >;
  draft: Awaited<ReturnType<typeof import("./steps.js").draftReport>>;
  editorial: Awaited<ReturnType<typeof import("./steps.js").editReport>>;
  report: Awaited<ReturnType<typeof import("./steps.js").acceptReport>>;
  splitPlan: Awaited<ReturnType<typeof import("./steps.js").planSplit>>;
  decision: Awaited<ReturnType<typeof import("./steps.js").decideReview>>;
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
export type ReviewResult = ReviewRun & {
  report: string | null;
  approval: ReviewResults["decision"]["approval"] | null;
};
export type ReviewPluginResults = {
  github: { readonly publication: PublicationResult };
  notifications: { readonly receipts: Notification[] };
};
export type ReviewOutput = ReviewResult & {
  notifications: Notification[];
  publication: PublicationResult;
};

export type ReviewEvent =
  | WorkflowEvent<ReviewResults>
  | WorkflowCompleted<ReviewResult, ReviewPluginResults>;
