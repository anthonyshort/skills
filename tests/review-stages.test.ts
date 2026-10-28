/**
 * Pure regression tests for answers that must be rejected before stage acceptance.
 * Covers finding-to-approval consistency, inline provenance and template excerpts.
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
import { validateStage } from "../src/review/stages.js";

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
test("default resources select the experimental skill without redirecting the original", () => {
  assert.equal(input.skillRoot, "/package/skills/review-workflow");
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
  const prior: StageResults = {
    setup: StageSchemas.setup.parse({
      ...common,
      stage: "setup",
      mode: "full",
      addedLines: 1,
      deletedLines: 0,
      rulePaths: [],
      sizeException: null,
    }),
    report: StageSchemas.report.parse({
      ...common,
      stage: "report",
      markdown:
        "## Assessment\n## Risk and scope\n## Findings\nF1\n## Verification summary\n## References\n## Supporting details",
      decisions: [],
    }),
  };
  return { prior, decision };
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

for (const disposition of ["retained", "merged", "open"] as const) {
  test(`${disposition} required finding cannot pass clean_review without inline comments`, () => {
    const { prior, decision } = assessment();
    prior.correctness = StageSchemas.correctness.parse({
      ...common,
      stage: "correctness",
      findings: [bug],
    });
    prior.report!.decisions.push({
      sourceId: "correctness:source-bug",
      disposition,
      reportId: "F1",
      reason: "Verified caller trace",
    });
    assert.throws(
      () => validateStage(decision, prior, input),
      /retained required or unresolved/,
    );
    decision.approval.outcome = "changes_needed";
    decision.approval.next_steps = ["Author: fix F1"];
    decision.approval.checks!.clean_review.result = "Fail";
    assert.doesNotThrow(() => validateStage(decision, prior, input));
  });
}

test("inline comments must reference an accepted new bug by exact report ID", () => {
  const { prior, decision } = assessment();
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
    () => validateStage(decision, prior, input),
    /accepted new bug/,
  );
  prior.correctness = StageSchemas.correctness.parse({
    ...common,
    stage: "correctness",
    findings: [bug],
  });
  prior.report!.decisions.push({
    sourceId: "correctness:source-bug",
    disposition: "retained",
    reportId: "F1",
    reason: "Caller trace verified",
  });
  decision.inlineComments[0].id = "F1";
  assert.doesNotThrow(() => validateStage(decision, prior, input));
  prior.correctness.findings[0].existingThread =
    "https://github.com/example/app/pull/1#discussion_r1";
  assert.throws(
    () => validateStage(decision, prior, input),
    /accepted new bug/,
  );
  prior.correctness.findings[0].existingThread = null;
  prior.correctness.findings[0].kind = "readability";
  assert.throws(
    () => validateStage(decision, prior, input),
    /accepted new bug/,
  );
});

test("legitimate template source excerpts are accepted as review evidence", () => {
  const result = StageSchemas.correctness.parse({
    ...common,
    stage: "correctness",
    markdown:
      "The template renders `{{ user.name }}`.\n```handlebars\n{{ target }}\n```",
  });
  assert.doesNotThrow(() => validateStage(result, {}, input));
});

test("invalid approval semantics fail before the writer gate", () => {
  const { prior, decision } = assessment();
  decision.approval.checks!.verification.result = "Fail";
  assert.throws(
    () => validateStage(decision, prior, input),
    /every checklist item/,
  );
});

test("an open optional concern cannot be hidden behind a passing approval", () => {
  const { prior, decision } = assessment();
  prior.correctness = StageSchemas.correctness.parse({
    ...common,
    stage: "correctness",
    findings: [{ ...bug, disposition: "optional" }],
  });
  prior.report!.decisions.push({
    sourceId: "correctness:source-bug",
    disposition: "open",
    reportId: null,
    reason: "Not yet resolved",
  });
  assert.throws(() => validateStage(decision, prior, input), /unresolved/);
});

test("the unfilled report target scaffold is rejected outside quoted source", () => {
  const result = StageSchemas.correctness.parse({
    ...common,
    stage: "correctness",
    markdown: "# Review: {{ target }}",
  });
  assert.throws(() => validateStage(result, {}, input), /target scaffold/);
});
