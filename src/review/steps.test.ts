/**
 * Exercise inline validation through real steps and an injected answer source.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { parseReviewInput } from "./input.js";
import type { ReviewResults } from "./steps.js";
import { researchReview, checkRules, decideReview } from "./steps.js";
import type { ReviewContext } from "./steps.js";

const evidence = {
  base: "a".repeat(40),
  head: "b".repeat(40),
  markdown: "Checked source.",
  checks: [
    {
      guidance: "Evidence",
      item: "Inspect source",
      method: "Source inspection",
      result: "Source checked" as const,
      evidence: ["app.ts:1"],
      reason: "Read the caller.",
    },
  ],
  findings: [],
  gaps: [],
};
const setup: ReviewResults["setup"] = {
  ...evidence,
  mode: "full",
  addedLines: 1,
  deletedLines: 0,
  sizeException: null,
  rulePaths: ["/rules/await-operations.md"],
};
const checkedRule: ReviewResults["rules"]["rules"][number] = {
  path: setup.rulePaths[0],
  selection: "selected",
  result: "Satisfied",
  reason: "The caller awaits the save.",
  evidence: ["app.ts:1"],
};

function context(answer: unknown): ReviewContext {
  return {
    review: parseReviewInput({
      packageRoot: "/skills",
      repository: "/app",
      target: "Review app",
      base: evidence.base,
      head: evidence.head,
      runId: "unit",
      publication: "local-only",
    }),
    attempts: [],
    call: async () => answer,
  };
}

test("worker evidence must match the pinned revisions", async () => {
  const input = context({
    ...evidence,
    head: "c".repeat(40),
  });
  await assert.rejects(
    researchReview({ input, results: {} }),
    /revisions differ from pinned inputs/,
  );
  assert.equal(input.attempts.length, 2);
});

test("descriptive check statuses and unused metadata do not trigger retries", async () => {
  const input = context({
    ...evidence,
    stage: "research",
    checks: [
      { ...evidence.checks[0], result: "Source inspected", evidence: [] },
    ],
    gaps: ["The worker explains its evidence gap in the report."],
  });
  const answer = await researchReview({ input, results: {} });
  assert.equal(answer.checks[0].result, "Source inspected");
  assert.equal("stage" in answer, false);
  assert.deepEqual(input.attempts, []);
});

test("rule coverage rejects a silently omitted rule", async () => {
  const input = context({ ...evidence, rules: [checkedRule] });
  await assert.rejects(
    checkRules({
      input,
      results: {
        setup: {
          ...setup,
          rulePaths: [checkedRule.path, "/rules/shared-state.md"],
        },
      },
    }),
    /missing, duplicate or unexpected paths/,
  );
  assert.equal(input.attempts.length, 2);
});

test("an explicitly skipped rule still counts as accounted for", async () => {
  const skipped = {
    ...checkedRule,
    selection: "skipped" as const,
    result: "Skipped" as const,
    reason: "No relevant asynchronous operation changed.",
    evidence: [],
  };
  const input = context({ ...evidence, rules: [skipped] });
  const answer = await checkRules({ input, results: { setup } });
  assert.deepEqual(answer.rules, [skipped]);
  assert.deepEqual(input.attempts, []);
});

const splitDecision: ReviewResults["decision"] = {
  ...evidence,
  approval: {
    outcome: "split",
    changed_lines: 1,
    checks: null,
    reason: "Split the oversized change.",
    next_steps: ["Author: split the change."],
  },
  summaryMarkdown: "Split the change.",
  inlineComments: [],
};

test("split output cannot bypass the full-review approval checks", async () => {
  const input = context(splitDecision);
  await assert.rejects(
    decideReview({ input, results: { setup } }),
    /Full review requires all seven approval checks/,
  );
});

test("split reviews cannot include inline findings", async () => {
  const input = context({
    ...splitDecision,
    inlineComments: [
      { id: "F1", path: "app.ts", line: 1, side: "RIGHT", body: "Bug" },
    ],
  });
  await assert.rejects(
    decideReview({ input, results: { setup: { ...setup, mode: "split" } } }),
    /Split-only output must not claim implementation approval or inline findings/,
  );
});

test("a split assessment accepts multiline reasons without a full-review report", async () => {
  const reason = "Split the change.\nKeep each review focused.";
  const input = context({
    ...splitDecision,
    approval: { ...splitDecision.approval, reason },
  });
  const answer = await decideReview({
    input,
    results: { setup: { ...setup, mode: "split" } },
  });
  assert.equal(answer.approval.outcome, "split");
  assert.equal(answer.approval.reason, reason);
  assert.deepEqual(input.attempts, []);
});

test("approval still requires every checklist item to pass", async () => {
  const pass = { result: "Pass", reason: "Inspected." };
  const checks = {
    focused: pass,
    low_risk: pass,
    no_sensitive_changes: pass,
    clean_review: pass,
    complete_review: pass,
    verification: pass,
    concerns_resolved: pass,
  };
  for (const result of ["Pass", "Fail", "Not verified"]) {
    const input = context({
      ...splitDecision,
      approval: {
        outcome: "approve",
        changed_lines: 1,
        checks: { ...checks, verification: { ...pass, result } },
        reason: "Ready for review.",
        next_steps: [],
      },
    });
    const answer = decideReview({
      input,
      results: { setup, report: { ...evidence, decisions: [] } },
    });
    if (result === "Pass") {
      assert.equal((await answer).approval.outcome, "approve");
    } else {
      await assert.rejects(answer, /every checklist item to pass/);
    }
  }
});

test("inline findings must resolve to an accepted new bug", async () => {
  const check = {
    result: "Not verified",
    reason: "Requires human inspection.",
  };
  const input = context({
    ...splitDecision,
    approval: {
      outcome: "human_review",
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
      reason: "Requires human inspection.",
      next_steps: ["Owner: inspect the evidence."],
    },
    inlineComments: [
      { id: "unknown", path: "app.ts", line: 1, side: "RIGHT", body: "Bug" },
    ],
  });
  await assert.rejects(
    decideReview({
      input,
      results: {
        setup,
        report: { ...evidence, decisions: [] },
      },
    }),
    /Inline findings must reference an accepted new bug/,
  );
});
