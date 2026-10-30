/**
 * Named review workers own their prompts, schemas and review-policy checks.
 */
import * as z from "zod";
import { callValidatedAgent } from "../workflow/agent.js";
import type { StepInput } from "../workflow/run.js";
import setupPrompt from "./prompts/setup.md";
import researchPrompt from "./prompts/research.md";
import researchCheckPrompt from "./prompts/researchCheck.md";
import productPrompt from "./prompts/product.md";
import systemFitPrompt from "./prompts/systemFit.md";
import simplicityPrompt from "./prompts/simplicity.md";
import readabilityPrompt from "./prompts/readability.md";
import correctnessPrompt from "./prompts/correctness.md";
import rulesPrompt from "./prompts/rules.md";
import consolidationPrompt from "./prompts/consolidation.md";
import draftPrompt from "./prompts/draft.md";
import editorialPrompt from "./prompts/editorial.md";
import reportPrompt from "./prompts/report.md";
import splitPlanPrompt from "./prompts/splitPlan.md";
import decisionPrompt from "./prompts/decision.md";
import sharedRules from "./prompts/common.md";
import assessmentRules from "./prompts/assessment.md";
import reportingRules from "./prompts/reporting.md";
import reportTemplate from "../../skills/review/templates/review-report.md";
import type { ReviewInput } from "./input.js";

const text = z.string().min(1);
const strings = z.array(text).max(10_000);

/**
 * Shared worker evidence. Check statuses are descriptive; finding kinds and
 * dispositions stay constrained because they affect publication and approval.
 */
const ReviewEvidenceSchema = z.object({
  base: z.string(),
  head: z.string(),
  markdown: text,
  checks: z
    .array(
      z.object({
        guidance: text,
        item: text,
        method: text,
        result: text,
        evidence: strings,
        reason: text,
      }),
    )
    .min(1)
    .max(10_000),
  findings: z
    .array(
      z.object({
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
        evidence: strings.min(1),
        existingThread: z.string().nullable(),
      }),
    )
    .max(10_000),
  gaps: strings,
});

const MAX_ATTEMPTS = 2;

/**
 * Accepted answers are keyed by task name; worker payloads do not repeat it.
 */
export type ReviewResults = {
  setup: Awaited<ReturnType<typeof setupReview>>;
  research: Awaited<ReturnType<typeof researchReview>>;
  researchCheck: Awaited<ReturnType<typeof checkResearch>>;
  product: Awaited<ReturnType<typeof assessProduct>>;
  systemFit: Awaited<ReturnType<typeof assessSystemFit>>;
  simplicity: Awaited<ReturnType<typeof assessSimplicity>>;
  readability: Awaited<ReturnType<typeof assessReadability>>;
  correctness: Awaited<ReturnType<typeof assessCorrectness>>;
  rules: Awaited<ReturnType<typeof checkRules>>;
  consolidation: Awaited<ReturnType<typeof consolidateReview>>;
  draft: Awaited<ReturnType<typeof draftReport>>;
  editorial: Awaited<ReturnType<typeof editReport>>;
  report: Awaited<ReturnType<typeof acceptReport>>;
  splitPlan: Awaited<ReturnType<typeof planSplit>>;
  decision: Awaited<ReturnType<typeof decideReview>>;
};
export type StageResults = Partial<ReviewResults>;
export type StageName = keyof ReviewResults;

/**
 * Review input, diagnostics and optional agent caller shared by this run's workers.
 */
export type ReviewContext = {
  review: ReviewInput;
  attempts: { stage: StageName; attempt: number; reason: string }[];
  call?: typeof agent;
};
type ReviewStepInput = StepInput<ReviewContext, ReviewResults>;

/**
 * Establish the pinned scope, review depth and rule inventory.
 */
export function setupReview(args: ReviewStepInput) {
  return reviewAgent({
    ...args,
    label: "setup",
    outputSchema: ReviewEvidenceSchema.extend({
      mode: z.enum(["full", "split"]),
      addedLines: z.number().int().nonnegative(),
      deletedLines: z.number().int().nonnegative(),
      sizeException: z.string().nullable(),
      rulePaths: z.array(text).max(1000),
    }),
    validate: (setup) => {
      if (new Set(setup.rulePaths).size !== setup.rulePaths.length) {
        throw new Error("Rule inventory paths must be unique");
      }
      if (
        setup.addedLines > 2000 &&
        setup.mode === "full" &&
        !setup.sizeException?.trim()
      ) {
        throw new Error(
          "Oversized full review requires a documented permitted exception",
        );
      }
    },
    prompt: setupPrompt,
  });
}

/**
 * Gather sourced context or validate usable earlier research.
 */
export function researchReview(args: ReviewStepInput) {
  return reviewAgent({
    ...args,
    label: "research",
    outputSchema: ReviewEvidenceSchema,
    prompt: researchPrompt,
  });
}

/**
 * Independently check the brief before assessments use it.
 */
export function checkResearch(args: ReviewStepInput) {
  return reviewAgent({
    ...args,
    label: "researchCheck",
    outputSchema: ReviewEvidenceSchema,
    prompt: researchCheckPrompt,
  });
}

/**
 * Assess the user problem and supported product alternatives.
 */
export function assessProduct(args: ReviewStepInput) {
  return reviewAgent({
    ...args,
    label: "product",
    outputSchema: ReviewEvidenceSchema,
    prompt: [assessmentRules, productPrompt].join("\n\n"),
  });
}

/**
 * Assess ownership, dependencies and architectural fit.
 */
export function assessSystemFit(args: ReviewStepInput) {
  return reviewAgent({
    ...args,
    label: "systemFit",
    outputSchema: ReviewEvidenceSchema,
    prompt: [assessmentRules, systemFitPrompt].join("\n\n"),
  });
}

/**
 * Assess the amount of implementation and scope needed.
 */
export function assessSimplicity(args: ReviewStepInput) {
  return reviewAgent({
    ...args,
    label: "simplicity",
    outputSchema: ReviewEvidenceSchema,
    prompt: [assessmentRules, simplicityPrompt].join("\n\n"),
  });
}

/**
 * Inspect changed bodies and tests for reading difficulties.
 */
export function assessReadability(args: ReviewStepInput) {
  return reviewAgent({
    ...args,
    label: "readability",
    outputSchema: ReviewEvidenceSchema,
    prompt: [assessmentRules, readabilityPrompt].join("\n\n"),
  });
}

/**
 * Trace behaviour, callers, tests and available CI evidence.
 */
export function assessCorrectness(args: ReviewStepInput) {
  return reviewAgent({
    ...args,
    label: "correctness",
    outputSchema: ReviewEvidenceSchema,
    prompt: [assessmentRules, correctnessPrompt].join("\n\n"),
  });
}

/**
 * Account for every indexed rule in one sequential pass.
 */
export function checkRules(args: ReviewStepInput) {
  const setup = args.results.setup;
  if (!setup) {
    throw new Error("Rule coverage requires accepted setup");
  }
  return reviewAgent({
    ...args,
    label: "rules",
    outputSchema: ReviewEvidenceSchema.extend({
      rules: z
        .array(
          z.object({
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
            evidence: z.array(text).max(10_000),
          }),
        )
        .max(1000),
    }),
    validate: ({ rules }) => {
      const actual = rules.map((rule) => rule.path);
      if (
        new Set(actual).size !== actual.length ||
        setup.rulePaths.length !== actual.length ||
        setup.rulePaths.some((path) => !actual.includes(path))
      ) {
        throw new Error(
          "Rule coverage has missing, duplicate or unexpected paths",
        );
      }
      for (const rule of rules) {
        if ((rule.selection === "skipped") !== (rule.result === "Skipped")) {
          throw new Error("Rule selection and result disagree");
        }
        if (
          rule.selection === "selected" &&
          ["Satisfied", "Concern found"].includes(rule.result) &&
          !rule.evidence.length
        ) {
          throw new Error("Selected verified rules require evidence");
        }
      }
    },
    prompt: rulesPrompt,
  });
}

/**
 * Verify claims, resolve disagreements and merge findings.
 */
export function consolidateReview(args: ReviewStepInput) {
  return reviewAgent({
    ...args,
    label: "consolidation",
    outputSchema: ReviewEvidenceSchema,
    prompt: [reportingRules, consolidationPrompt].join("\n\n"),
  });
}

/**
 * Write the complete report from accepted review evidence.
 */
export function draftReport(args: ReviewStepInput) {
  return reviewAgent({
    ...args,
    label: "draft",
    outputSchema: ReviewEvidenceSchema,
    prompt: [reportingRules, draftPrompt, reportTemplate].join("\n\n"),
  });
}

/**
 * Shorten the draft while preserving evidence and findings.
 */
export function editReport(args: ReviewStepInput) {
  return reviewAgent({
    ...args,
    results: { draft: args.results.draft },
    label: "editorial",
    outputSchema: ReviewEvidenceSchema,
    prompt: [reportingRules, editorialPrompt, reportTemplate].join("\n\n"),
  });
}

/**
 * Compare the edit and draft, restore detail and accept the report.
 */
export function acceptReport(args: ReviewStepInput) {
  return reviewAgent({
    ...args,
    label: "report",
    outputSchema: ReviewEvidenceSchema.extend({
      decisions: z
        .array(
          z.object({
            sourceId: text,
            disposition: z.enum(["retained", "merged", "excluded", "open"]),
            reportId: z.string().nullable(),
            reason: text,
          }),
        )
        .max(10_000),
    }),
    validate: (report) => {
      const expected = Object.entries(args.results)
        .filter(([name]) => !["report", "decision"].includes(name))
        .flatMap(([stage, result]) =>
          result.findings.map((finding) => `${stage}:${finding.id}`),
        );
      const actual = report.decisions.map((decision) => decision.sourceId);
      if (
        new Set(actual).size !== actual.length ||
        actual.length !== expected.length ||
        expected.some((id) => !actual.includes(id))
      ) {
        throw new Error(
          "Final report must account for every input finding exactly once",
        );
      }
      if (
        report.decisions.some(
          (decision) =>
            ["retained", "merged"].includes(decision.disposition) &&
            (!decision.reportId ||
              !report.markdown.includes(decision.reportId)),
        )
      ) {
        throw new Error(
          "Retained findings require an ID present in the report",
        );
      }
    },
    prompt: [reportingRules, reportPrompt, reportTemplate].join("\n\n"),
  });
}

/**
 * Propose useful review boundaries without a full implementation review.
 */
export function planSplit(args: ReviewStepInput) {
  return reviewAgent({
    ...args,
    label: "splitPlan",
    outputSchema: ReviewEvidenceSchema,
    prompt: splitPlanPrompt,
  });
}

/**
 * Assess approval and prepare publication material without submitting it.
 */
export function decideReview(args: ReviewStepInput) {
  const setup = args.results.setup;
  if (!setup) {
    throw new Error("Approval requires accepted setup");
  }
  const approvalCheck = z.object({
    result: z.enum(["Pass", "Fail", "Not verified"]),
    reason: text,
  });
  return reviewAgent({
    ...args,
    label: "decision",
    outputSchema: ReviewEvidenceSchema.extend({
      findings: ReviewEvidenceSchema.shape.findings.max(0),
      approval: z.object({
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
        next_steps: z.array(text).max(10_000),
      }),
      summaryMarkdown: z.string().min(1),
      inlineComments: z
        .array(
          z.object({
            id: text,
            path: text,
            line: z.number().int().positive(),
            side: z.enum(["LEFT", "RIGHT"]),
            body: text,
          }),
        )
        .max(100),
    }),
    validate: (decision) => {
      const { approval, inlineComments } = decision;
      const report = args.results.report;
      if (approval.changed_lines !== setup.addedLines + setup.deletedLines) {
        throw new Error("Approval changed_lines must match the complete diff");
      }
      const checks = approval.checks;
      if (approval.outcome !== "approve" && !approval.next_steps.length) {
        throw new Error(
          "Withheld approval requires a concrete next step and owner",
        );
      }
      if (setup.mode === "split") {
        if (approval.outcome !== "split" || inlineComments.length > 0) {
          throw new Error(
            "Split-only output must not claim implementation approval or inline findings",
          );
        }
        if (checks !== null) {
          throw new Error("Split approval must use checks null");
        }
        return;
      }
      if (approval.outcome === "split" || !checks) {
        throw new Error("Full review requires all seven approval checks");
      }
      if (!report) {
        throw new Error("Approval requires an accepted report");
      }
      if (
        ["approve", "not_submitted"].includes(approval.outcome) &&
        Object.values(checks).some((check) => check.result !== "Pass")
      ) {
        throw new Error(
          "Passing approval requires every checklist item to pass",
        );
      }
      const sources = Object.entries(args.results).flatMap(([stage, result]) =>
        result.findings.map((finding) => ({
          sourceId: `${stage}:${finding.id}`,
          finding,
        })),
      );
      const includedFindings = report.decisions
        .filter((reportDecision) => reportDecision.disposition !== "excluded")
        .map((reportDecision) => {
          const source = sources.find(
            (source) => source.sourceId === reportDecision.sourceId,
          );
          if (!source) {
            throw new Error(
              "Report decision refers to an unknown source finding",
            );
          }
          return { finding: source.finding, reportDecision };
        });
      const hasUnresolvedFindings =
        report.findings.some((finding) =>
          ["required", "open"].includes(finding.disposition),
        ) ||
        includedFindings.some(
          (item) =>
            ["required", "open"].includes(item.finding.disposition) ||
            item.reportDecision.disposition === "open",
        );
      if (
        (hasUnresolvedFindings || inlineComments.length > 0) &&
        checks.clean_review.result === "Pass"
      ) {
        throw new Error(
          "Clean review cannot pass with retained required or unresolved findings",
        );
      }
      if (
        new Set(inlineComments.map((comment) => comment.id)).size !==
        inlineComments.length
      ) {
        throw new Error("Inline finding IDs must be unique");
      }
      for (const comment of inlineComments) {
        const isAcceptedNewBug = includedFindings.some(
          ({ finding, reportDecision }) =>
            reportDecision.reportId === comment.id &&
            ["retained", "merged"].includes(reportDecision.disposition) &&
            finding.kind === "bug" &&
            finding.existingThread === null,
        );
        if (!isAcceptedNewBug) {
          throw new Error(
            "Inline findings must reference an accepted new bug by exact report ID",
          );
        }
      }
    },
    prompt: decisionPrompt,
  });
}

/**
 * Add review guidance and evidence checks to the shared validated agent call.
 */
function reviewAgent<Result extends z.infer<typeof ReviewEvidenceSchema>>({
  input: { review: input, attempts, call },
  results,
  label,
  outputSchema,
  prompt,
  validate,
}: ReviewStepInput & {
  label: StageName;
  outputSchema: z.ZodType<Result>;
  prompt: string;
  validate?: (result: Result) => void;
}): Promise<Result> {
  return callValidatedAgent({
    call: call ?? agent,
    label,
    outputSchema,
    maxAttempts: MAX_ATTEMPTS,
    prompt: [
      sharedRules,
      `Wrapper guidance: ${JSON.stringify(input.wrapperSkillRoots.map((root) => `${root}/SKILL.md`))}.`,
      `Read supplied scope and requirements files: ${JSON.stringify(input.contextFiles)}. Record unavailable external context rather than inventing sources.`,
      `Pinned inputs: ${JSON.stringify(input)}`,
      `Prior accepted results: ${JSON.stringify(results)}`,
      prompt,
    ].join("\n"),
    validate: (result) => {
      if (result.base !== input.base || result.head !== input.head) {
        throw new Error("Assessment revisions differ from pinned inputs");
      }
      if (
        new Set(result.findings.map((finding) => finding.id)).size !==
        result.findings.length
      ) {
        throw new Error("Finding IDs must be unique within an assessment");
      }
      validate?.(result);
    },
    onAttemptFailed: ({ attempt, reason }) => {
      attempts.push({ stage: label, attempt, reason });
    },
  });
}
