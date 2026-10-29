/**
 * Pure review-policy checks: evidence, rule coverage, finding accounting and
 * approval consistency. Both the workflow and saved-file gate reuse these
 * functions. They check consistency, not the truth of a model's evidence.
 */
import type { z } from "zod";
import type {
  ApprovalSchema,
  StageSchemas,
  StageResults,
  StageResult,
  ReviewInput,
} from "./contracts.js";
type Approval = z.infer<typeof ApprovalSchema>;
type Decision = z.infer<typeof StageSchemas.decision>;
type Setup = z.infer<typeof StageSchemas.setup>;
type Report = z.infer<typeof StageSchemas.report>;
type Rules = z.infer<typeof StageSchemas.rules>;

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

/**
 * Require a unique rule inventory and a documented exception for oversized full
 * reviews. Split-only reviews retain their shorter route without that exception.
 */
export function validateSetup({ setup }: { setup: Setup }): void {
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
 * Account for every indexed rule once and keep skipped or unverified work
 * distinct from selected rules supported by evidence.
 */
export function validateRuleCoverage({
  rules,
  expectedPaths,
}: {
  rules: Rules["rules"];
  expectedPaths: Setup["rulePaths"];
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
 * Account for each input finding exactly once and keep retained finding IDs
 * visible in the accepted report. Exclusions require an explicit decision.
 */
export function validateFindingDecisions({
  report,
  prior,
}: {
  report: Report;
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
 * Rejects approval answers that contradict the review scope or included findings.
 * Inline comments must resolve to an accepted new bug, never an arbitrary ID.
 */
export function validateApproval({
  decision,
  setup,
  report,
  prior,
}: {
  decision: Decision;
  setup: Setup;
  report: Report | undefined;
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

function validateApprovalOutcome(approval: Approval): void {
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
  report: Report;
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
  comments: Decision["inlineComments"];
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
