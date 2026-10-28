import type { z } from "zod";
import type {
  ApprovalSchema,
  StageSchemas,
  StageResults,
} from "./contracts.js";
type Approval = z.infer<typeof ApprovalSchema>;
type Decision = z.infer<typeof StageSchemas.decision>;

export function validateApproval(
  decision: Decision,
  prior: StageResults,
): void {
  const setup = prior.setup;
  if (!setup) {
    throw new Error("Approval requires accepted setup");
  }
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
  const report = prior.report;
  if (!report) {
    throw new Error("Approval requires an accepted report");
  }
  const includedFindings = resolveReportFindings(report, prior);
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
  validateInlineSources(inlineComments, includedFindings);
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
  if (["approve", "not_submitted"].includes(approval.outcome) && !allPass) {
    throw new Error("Passing approval requires every checklist item to pass");
  }
  if (
    approval.outcome === "incomplete" &&
    checks.complete_review.result === "Pass"
  ) {
    throw new Error("Incomplete review cannot pass complete_review");
  }
  if (
    approval.outcome === "waiting_checks" &&
    (checks.verification.result !== "Not verified" ||
      Object.entries(checks).some(
        ([name, check]) => name !== "verification" && check.result !== "Pass",
      ))
  ) {
    throw new Error("Waiting for checks requires all other items to pass");
  }
  if (
    approval.outcome === "changes_needed" &&
    (allPass ||
      [
        checks.focused,
        checks.low_risk,
        checks.no_sensitive_changes,
        checks.complete_review,
      ].some((check) => check.result !== "Pass"))
  ) {
    throw new Error(
      "Changes needed requires a completed focused low-risk review and a remaining blocker",
    );
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

function resolveReportFindings(
  report: z.infer<typeof StageSchemas.report>,
  prior: StageResults,
) {
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

function validateInlineSources(
  comments: Decision["inlineComments"],
  includedFindings: ReturnType<typeof resolveReportFindings>,
): void {
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
