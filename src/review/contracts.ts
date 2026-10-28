/**
 * Shared wire formats for review inputs, worker answers and saved results.
 * The Pi workflow and the filesystem validator parse the same Zod contracts.
 */
import { z } from "zod";

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

export const ReviewInputSchema = z
  .strictObject({
    workflowEnabled: z.literal(true).default(true),
    packageRoot: absolutePath,
    repository: absolutePath,
    target: text,
    base: revision,
    head: revision,
    skillRoot: absolutePath,
    supportRoot: absolutePath,
    tsxLoader: absolutePath,
    artifacts: absolutePath,
    runId: identifier,
    invocationId: identifier,
    wrapperSkillRoots: z.array(absolutePath).max(20).default([]),
    contextFiles: z.array(absolutePath).max(20).default([]),
    notification: z
      .strictObject({ destination: text, messageKey: text })
      .nullable()
      .default(null),
  })
  .superRefine((input, context) => {
    for (const source of [
      input.repository,
      input.skillRoot,
      input.supportRoot,
    ]) {
      const root = source.replace(/\/+$/, "");
      if (input.artifacts === root || input.artifacts.startsWith(`${root}/`)) {
        context.addIssue({
          code: "custom",
          path: ["artifacts"],
          message:
            "Artefacts must be outside source and workflow support directories",
        });
      }
    }
  });
export type ReviewInput = z.infer<typeof ReviewInputSchema>;

/**
 * Resolves package-relative resource defaults and rejects unsafe output paths
 * before the workflow schedules its first worker.
 */
export function parseReviewInput(value: unknown): ReviewInput {
  const roots = z
    .object({
      packageRoot: absolutePath,
      skillRoot: absolutePath.optional(),
      supportRoot: absolutePath.optional(),
      tsxLoader: absolutePath.optional(),
    })
    .parse(value);
  return ReviewInputSchema.parse({
    ...z.record(z.string(), z.unknown()).parse(value),
    skillRoot: roots.skillRoot ?? `${roots.packageRoot}/skills/review`,
    supportRoot: roots.supportRoot ?? `${roots.packageRoot}/scripts/review`,
    tsxLoader:
      roots.tsxLoader ??
      `${roots.packageRoot}/node_modules/tsx/dist/loader.mjs`,
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
  "system-fit",
  "simplicity",
  "readability",
  "correctness",
] as const;
export const stageNames = [
  "setup",
  "research",
  ...assessmentNames,
  "rules",
  "consolidation",
  "draft",
  "editorial",
  "report",
  "split-plan",
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
  product: z.strictObject({ ...envelope, stage: z.literal("product") }),
  "system-fit": z.strictObject({ ...envelope, stage: z.literal("system-fit") }),
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
  "split-plan": z.strictObject({ ...envelope, stage: z.literal("split-plan") }),
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
  StageSchemas.product,
  StageSchemas["system-fit"],
  StageSchemas.simplicity,
  StageSchemas.readability,
  StageSchemas.correctness,
  StageSchemas.rules,
  StageSchemas.consolidation,
  StageSchemas.draft,
  StageSchemas.editorial,
  StageSchemas.report,
  StageSchemas["split-plan"],
  StageSchemas.decision,
]);
export type StageResult = z.infer<typeof StageSchema>;
export type StageResults = {
  [Name in StageName]?: z.infer<(typeof StageSchemas)[Name]>;
};
export const StageResultsSchema = z.strictObject({
  setup: StageSchemas.setup.optional(),
  research: StageSchemas.research.optional(),
  product: StageSchemas.product.optional(),
  "system-fit": StageSchemas["system-fit"].optional(),
  simplicity: StageSchemas.simplicity.optional(),
  readability: StageSchemas.readability.optional(),
  correctness: StageSchemas.correctness.optional(),
  rules: StageSchemas.rules.optional(),
  consolidation: StageSchemas.consolidation.optional(),
  draft: StageSchemas.draft.optional(),
  editorial: StageSchemas.editorial.optional(),
  report: StageSchemas.report.optional(),
  "split-plan": StageSchemas["split-plan"].optional(),
  decision: StageSchemas.decision.optional(),
});
export const FailureSchema = z.strictObject({ stage: text, reason: text });
export const AttemptSchema = z.strictObject({
  stage: StageNameSchema,
  attempt: z.number().int().positive(),
  reason: text,
});
export const NotificationReceiptSchema = z.strictObject({
  status: z.enum(["confirmed", "rejected", "uncertain"]),
  reason: text,
});
export const NotificationSchema = z.strictObject({
  stage: text,
  status: text,
  receipt: NotificationReceiptSchema,
});
export const ReviewStatusSchema = z.enum(["complete", "split", "incomplete"]);
export const BundleSchema = z.strictObject({
  version: z.literal(1),
  input: ReviewInputSchema,
  status: ReviewStatusSchema,
  stages: StageResultsSchema,
  failures: z.array(FailureSchema).max(100),
  attempts: z.array(AttemptSchema).max(100),
  notifications: z.array(NotificationSchema).max(1000),
});
export type Bundle = z.infer<typeof BundleSchema>;
export const ReviewResultSchema = z.strictObject({
  status: ReviewStatusSchema,
  runId: identifier,
  invocationId: identifier,
  base: revision,
  head: revision,
  bundlePath: absolutePath,
  reportPath: absolutePath.nullable(),
  fingerprint: z.string().regex(/^[a-f0-9]{16}$/),
  missingStages: z.array(StageNameSchema).max(20),
  coverageGaps: z.array(FailureSchema).max(10_000),
});
export type ReviewResult = z.infer<typeof ReviewResultSchema>;

/**
 * Capabilities supplied by pi-subagents to the generated workflow entry point.
 * The VM can schedule workers but cannot import Node or access the filesystem.
 */
export type WorkflowHost = {
  agent(
    prompt: string,
    options: { label: string; phase: string; schema: unknown; gate?: string },
  ): Promise<unknown>;
  parallel<T>(tasks: (() => Promise<T>)[]): Promise<(T | null)[]>;
  phase(name: string): void;
};
