/**
 * Named review workers own their prompts, schemas and review-policy checks.
 */
import type * as z from "zod";
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
import { StageSchemas } from "./contracts.js";
import type {
  ReviewInput,
  ReviewResults,
  ReviewRun,
  StageName,
  StageResult,
} from "./contracts.js";
import {
  validateAnswer,
  validateSetup,
  validateRuleCoverage,
  validateFindingDecisions,
  validateApproval,
} from "./validation.js";

const MAX_ATTEMPTS = 2;

/**
 * Review input and failed-attempt diagnostics shared by this run's workers.
 */
export type ReviewContext = {
  review: ReviewInput;
  attempts: ReviewRun["attempts"];
};
type ReviewStepInput = StepInput<ReviewContext, ReviewResults>;

/**
 * Establish the pinned scope, review depth and rule inventory.
 */
export function setupReview(args: ReviewStepInput) {
  return reviewAgent({
    ...args,
    label: "setup",
    schema: StageSchemas.setup,
    validate: (setup) => validateSetup({ setup }),
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
    schema: StageSchemas.research,
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
    schema: StageSchemas.researchCheck,
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
    schema: StageSchemas.product,
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
    schema: StageSchemas.systemFit,
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
    schema: StageSchemas.simplicity,
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
    schema: StageSchemas.readability,
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
    schema: StageSchemas.correctness,
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
    schema: StageSchemas.rules,
    validate: (assessment) =>
      validateRuleCoverage({
        rules: assessment.rules,
        expectedPaths: setup.rulePaths,
      }),
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
    schema: StageSchemas.consolidation,
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
    schema: StageSchemas.draft,
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
    schema: StageSchemas.editorial,
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
    schema: StageSchemas.report,
    validate: (report) =>
      validateFindingDecisions({ report, prior: args.results }),
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
    schema: StageSchemas.splitPlan,
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
  return reviewAgent({
    ...args,
    label: "decision",
    schema: StageSchemas.decision,
    validate: (decision) =>
      validateApproval({
        decision,
        setup,
        report: args.results.report,
        prior: args.results,
      }),
    prompt: decisionPrompt,
  });
}

/**
 * Add review guidance and evidence checks to the shared validated agent call.
 */
function reviewAgent<Result extends StageResult>({
  input: { review: input, attempts },
  results,
  label,
  schema,
  prompt,
  validate,
}: ReviewStepInput & {
  label: StageName;
  schema: z.ZodType<Result>;
  prompt: string;
  validate?: (result: Result) => void;
}): Promise<Result> {
  return callValidatedAgent({
    call: agent,
    label,
    schema,
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
      validateAnswer({ result, input });
      validate?.(result);
    },
    onAttemptFailed: ({ attempt, reason }) => {
      attempts.push({ stage: label, attempt, reason });
    },
  });
}
