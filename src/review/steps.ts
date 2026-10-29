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
import { StageSchemas } from "./schemas.js";
import type {
  ReviewInput,
  ReviewResults,
  ReviewRun,
  StageName,
  StageResult,
  StageResults,
} from "./schemas.js";

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
 * Require a unique rule inventory and a documented exception for oversized full
 * reviews. Split-only reviews retain their shorter route without that exception.
 */
function validateSetup({ setup }: { setup: ReviewResults["setup"] }): void {
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
 * Account for every indexed rule once and keep skipped or unverified work
 * distinct from selected rules supported by evidence.
 */
export function validateRuleCoverage({
  rules,
  expectedPaths,
}: {
  rules: ReviewResults["rules"]["rules"];
  expectedPaths: ReviewResults["setup"]["rulePaths"];
}): void {
  const actual = rules.map((rule) => rule.path);
  if (
    new Set(actual).size !== actual.length ||
    expectedPaths.length !== actual.length ||
    expectedPaths.some((path) => !actual.includes(path))
  ) {
    throw new Error("Rule coverage has missing, duplicate or unexpected paths");
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
 * Account for each input finding exactly once and keep retained finding IDs
 * visible in the accepted report. Exclusions require an explicit decision.
 */
function validateFindingDecisions({
  report,
  prior,
}: {
  report: ReviewResults["report"];
  prior: StageResults;
}): void {
  const expected = Object.entries(prior)
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
        (!decision.reportId || !report.markdown.includes(decision.reportId)),
    )
  ) {
    throw new Error("Retained findings require an ID present in the report");
  }
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
 * Rejects approval answers that contradict the review scope or included findings.
 * Inline comments must resolve to an accepted new bug, never an arbitrary ID.
 */
function validateApproval({
  decision,
  setup,
  report,
  prior,
}: {
  decision: ReviewResults["decision"];
  setup: ReviewResults["setup"];
  report: ReviewResults["report"] | undefined;
  prior: StageResults;
}): void {
  const { approval, inlineComments } = decision;
  if (approval.changed_lines !== setup.addedLines + setup.deletedLines) {
    throw new Error("Approval changed_lines must match the complete diff");
  }
  validateApprovalOutcome(approval);
  if (setup.mode === "split") {
    if (approval.outcome !== "split" || inlineComments.length > 0) {
      throw new Error(
        "Split-only output must not claim implementation approval or inline findings",
      );
    }
    return;
  }
  const checks = approval.checks;
  if (approval.outcome === "split" || !checks) {
    throw new Error("Full review requires all seven approval checks");
  }
  if (!report) {
    throw new Error("Approval requires an accepted report");
  }
  const includedFindings = resolveReportFindings({ report, prior });
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
  validateInlineSources({ comments: inlineComments, includedFindings });
}

function validateApprovalOutcome(
  approval: ReviewResults["decision"]["approval"],
): void {
  const checks = approval.checks;
  const reasons = [
    approval.reason,
    ...approval.next_steps,
    ...Object.values(checks ?? {}).map((check) => check.reason),
  ];
  if (reasons.some((reason) => /[\r\n]/.test(reason))) {
    throw new Error(
      "Approval reasons and next steps must be single-line strings",
    );
  }
  if (approval.outcome !== "approve" && !approval.next_steps.length) {
    throw new Error(
      "Withheld approval requires a concrete next step and owner",
    );
  }
  if (approval.outcome === "split") {
    if (checks !== null) {
      throw new Error("Split approval must use checks null");
    }
    return;
  }
  if (!checks) {
    throw new Error("Full review requires all seven approval checks");
  }
  const allPass = Object.values(checks).every(
    (check) => check.result === "Pass",
  );
  switch (approval.outcome) {
    case "approve":
    case "not_submitted":
      if (!allPass) {
        throw new Error(
          "Passing approval requires every checklist item to pass",
        );
      }
      break;
    case "incomplete":
      if (checks.complete_review.result === "Pass") {
        throw new Error("Incomplete review cannot pass complete_review");
      }
      break;
    case "waiting_checks":
      if (
        checks.verification.result !== "Not verified" ||
        Object.entries(checks).some(
          ([name, check]) => name !== "verification" && check.result !== "Pass",
        )
      ) {
        throw new Error("Waiting for checks requires all other items to pass");
      }
      break;
    case "changes_needed":
      if (
        allPass ||
        [
          checks.focused,
          checks.low_risk,
          checks.no_sensitive_changes,
          checks.complete_review,
        ].some((check) => check.result !== "Pass")
      ) {
        throw new Error(
          "Changes needed requires a completed focused low-risk review and a remaining blocker",
        );
      }
      break;
  }
  if (
    approval.outcome !== "human_review" &&
    [checks.low_risk, checks.no_sensitive_changes].some(
      (check) => check.result === "Fail",
    )
  ) {
    throw new Error(
      "Known risk or sensitive behaviour failures require human review",
    );
  }
}

function resolveReportFindings({
  report,
  prior,
}: {
  report: ReviewResults["report"];
  prior: StageResults;
}) {
  const sources = Object.entries(prior).flatMap(([stage, result]) =>
    result.findings.map((finding) => ({
      sourceId: `${stage}:${finding.id}`,
      finding,
    })),
  );
  return report.decisions
    .filter((reportDecision) => reportDecision.disposition !== "excluded")
    .map((reportDecision) => {
      const source = sources.find(
        (source) => source.sourceId === reportDecision.sourceId,
      );
      if (!source) {
        throw new Error("Report decision refers to an unknown source finding");
      }
      return { finding: source.finding, reportDecision };
    });
}

function validateInlineSources({
  comments,
  includedFindings,
}: {
  comments: ReviewResults["decision"]["inlineComments"];
  includedFindings: ReturnType<typeof resolveReportFindings>;
}): void {
  if (new Set(comments.map((comment) => comment.id)).size !== comments.length) {
    throw new Error("Inline finding IDs must be unique");
  }
  for (const comment of comments) {
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

/**
 * Require pinned revisions, evidence for verified checks and unique finding IDs.
 * These common checks do not depend on the answer's stage or report format.
 */
export function validateAnswer({
  result,
  input,
}: {
  result: Pick<StageResult, "base" | "head" | "checks" | "findings">;
  input: Pick<ReviewInput, "base" | "head">;
}): void {
  if (result.base !== input.base || result.head !== input.head) {
    throw new Error("Assessment revisions differ from pinned inputs");
  }
  if (
    result.checks.some(
      (check) =>
        !check.evidence.length &&
        ![
          "Blocked",
          "Not run",
          "N/A",
          "CI pending",
          "CI skipped",
          "CI cancelled",
        ].includes(check.result),
    )
  ) {
    throw new Error("Verified checks require evidence");
  }
  if (
    new Set(result.findings.map((finding) => finding.id)).size !==
    result.findings.length
  ) {
    throw new Error("Finding IDs must be unique within an assessment");
  }
}
