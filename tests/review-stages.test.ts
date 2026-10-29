/**
 * Pure regressions for answer evidence, finding accounting and approval policy.
 * Covers inline provenance and report consistency without policing Markdown style.
 * No agents, subprocesses or filesystem fixtures are involved.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  parseReviewInput,
  StageSchemas,
  ApprovalSchema,
  FindingSchema,
} from "../src/review/contracts.js";
import type { StageResults } from "../src/review/contracts.js";
import {
  validateAnswer,
  validateApproval,
  validateFindingDecisions,
} from "../src/review/validation.js";

const input = parseReviewInput({
  packageRoot: "/package",
  repository: "/source",
  artifacts: "/artefacts",
  base: "a".repeat(40),
  head: "b".repeat(40),
  target: "example/app#1",
  runId: "test",
  invocationId: "test",
});
test("default resources reuse the original review skill", () => {
  assert.equal(input.skillRoot, "/package/skills/review");
  assert.equal(input.supportRoot, "/package/scripts/review");
  assert.deepEqual(input.notification, { messageKey: "review:test" });
});

const common = {
  base: input.base,
  head: input.head,
  markdown: "Source inspected.",
  checks: [
    {
      guidance: "review#correctness",
      item: "Caller trace",
      method: "source inspection",
      result: "Source checked",
      evidence: ["example.ts:1"],
      reason: "Traced caller",
    },
  ],
  findings: [],
  gaps: [],
};
const check = { result: "Pass", reason: "Source supports this assessment" };
function assessment() {
  const approval = ApprovalSchema.parse({
    outcome: "approve",
    changed_lines: 1,
    checks: {
      focused: check,
      low_risk: check,
      no_sensitive_changes: check,
      clean_review: check,
      complete_review: check,
      verification: check,
      concerns_resolved: check,
    },
    reason: "All checks passed",
    next_steps: [],
  });
  const decision = StageSchemas.decision.parse({
    ...common,
    stage: "decision",
    approval,
    summaryMarkdown: "Review complete",
    inlineComments: [],
  });
  const setup = StageSchemas.setup.parse({
    ...common,
    stage: "setup",
    mode: "full",
    addedLines: 1,
    deletedLines: 0,
    rulePaths: [],
    sizeException: null,
  });
  const report = StageSchemas.report.parse({
    ...common,
    stage: "report",
    markdown: "F1: Persist the updated value.",
    decisions: [],
  });
  const prior: StageResults = { setup, report };
  return { prior, decision, setup, report };
}
const bug = FindingSchema.parse({
  id: "source-bug",
  kind: "bug",
  disposition: "required",
  title: "Caller loses update",
  location: "example.ts:1",
  trigger: "Updating an existing row",
  effect: "Saved value stays stale",
  action: "Persist the updated value",
  evidence: ["example.ts:1"],
  existingThread: null,
});

test("verified checks require evidence while blocked checks remain explicit gaps", () => {
  const result = StageSchemas.correctness.parse({
    ...common,
    stage: "correctness",
  });
  result.checks[0].evidence = [];
  assert.throws(
    () => validateAnswer({ result, input }),
    /Verified checks require evidence/,
  );
  result.checks[0].result = "Blocked";
  result.checks[0].reason = "CI is unavailable";
  result.gaps = ["CI is unavailable"];
  assert.doesNotThrow(() => validateAnswer({ result, input }));
});

for (const disposition of ["retained", "merged", "open"] as const) {
  test(`${disposition} required finding cannot pass clean_review without inline comments`, () => {
    const { prior, decision, setup, report } = assessment();
    prior.correctness = StageSchemas.correctness.parse({
      ...common,
      stage: "correctness",
      findings: [bug],
    });
    report.decisions.push({
      sourceId: "correctness:source-bug",
      disposition,
      reportId: "F1",
      reason: "Verified caller trace",
    });
    assert.throws(
      () => validateApproval({ decision, setup, report, prior }),
      /retained required or unresolved/,
    );
    decision.approval.outcome = "changes_needed";
    decision.approval.next_steps = ["Author: fix F1"];
    decision.approval.checks!.clean_review.result = "Fail";
    assert.doesNotThrow(() =>
      validateApproval({ decision, setup, report, prior }),
    );
  });
}

test("inline comments must reference an accepted new bug by exact report ID", () => {
  const { prior, decision, setup, report } = assessment();
  decision.approval.outcome = "human_review";
  decision.approval.next_steps = ["Reviewer: inspect concern"];
  decision.approval.checks!.clean_review.result = "Fail";
  decision.inlineComments.push({
    id: "Assessment",
    path: "example.ts",
    line: 1,
    side: "RIGHT",
    body: "Unreviewed claim",
  });
  assert.throws(
    () => validateApproval({ decision, setup, report, prior }),
    /accepted new bug/,
  );
  prior.correctness = StageSchemas.correctness.parse({
    ...common,
    stage: "correctness",
    findings: [bug],
  });
  report.decisions.push({
    sourceId: "correctness:source-bug",
    disposition: "retained",
    reportId: "F1",
    reason: "Caller trace verified",
  });
  decision.inlineComments[0].id = "F1";
  assert.doesNotThrow(() =>
    validateApproval({ decision, setup, report, prior }),
  );
  prior.correctness.findings[0].existingThread =
    "https://github.com/example/app/pull/1#discussion_r1";
  assert.throws(
    () => validateApproval({ decision, setup, report, prior }),
    /accepted new bug/,
  );
  prior.correctness.findings[0].existingThread = null;
  prior.correctness.findings[0].kind = "readability";
  assert.throws(
    () => validateApproval({ decision, setup, report, prior }),
    /accepted new bug/,
  );
});

test("invalid approval semantics fail before the writer gate", () => {
  const { prior, decision, setup, report } = assessment();
  decision.approval.checks!.verification.result = "Fail";
  assert.throws(
    () => validateApproval({ decision, setup, report, prior }),
    /every checklist item/,
  );
});

test("an open optional concern cannot be hidden behind a passing approval", () => {
  const { prior, decision, setup, report } = assessment();
  prior.correctness = StageSchemas.correctness.parse({
    ...common,
    stage: "correctness",
    findings: [{ ...bug, disposition: "optional" }],
  });
  report.decisions.push({
    sourceId: "correctness:source-bug",
    disposition: "open",
    reportId: null,
    reason: "Not yet resolved",
  });
  assert.throws(
    () => validateApproval({ decision, setup, report, prior }),
    /unresolved/,
  );
});

test("custom report headings preserve the requirement to account for findings", () => {
  const report = StageSchemas.report.parse({
    ...common,
    stage: "report",
    markdown: "# Review outcome\n\nF1: Persist the updated value.",
    decisions: [
      {
        sourceId: "correctness:source-bug",
        disposition: "retained",
        reportId: "F1",
        reason: "Caller trace verified",
      },
    ],
  });
  const prior = {
    correctness: StageSchemas.correctness.parse({
      ...common,
      stage: "correctness",
      findings: [bug],
    }),
  };
  assert.doesNotThrow(() => validateFindingDecisions({ report, prior }));
  report.decisions = [];
  assert.throws(
    () => validateFindingDecisions({ report, prior }),
    /account for every input finding/,
  );
});
