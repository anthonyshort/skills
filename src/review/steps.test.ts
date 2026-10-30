/**
 * Exercise exported review steps through their injected agent-call boundary.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseReviewInput } from "./input.js";
import {
  acceptReport,
  researchReview,
  checkRules,
  decideReview,
} from "./steps.js";
import type { ReviewContext, ReviewResults } from "./steps.js";

const evidence = {
  base: "a".repeat(40),
  head: "b".repeat(40),
  markdown: "Checked source.",
  checks: [
    {
      guidance: "Evidence",
      item: "Inspect source",
      method: "Source inspection",
      result: "Source checked",
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
const sourceFinding: ReviewResults["product"]["findings"][number] = {
  id: "source",
  kind: "bug",
  disposition: "required",
  title: "Await the save",
  location: "app.ts:1",
  trigger: "The caller closes before saving finishes.",
  effect: "The change can be lost.",
  action: "Await the save before closing.",
  evidence: ["app.ts:1"],
  existingThread: null,
};
const retainedDecision: ReviewResults["report"]["decisions"][number] = {
  sourceId: "product:source",
  disposition: "retained",
  reportId: "F1",
  reason: "Keep the verified finding.",
};
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

function approvalChecks(
  result: "Pass" | "Fail" | "Not verified" = "Pass",
): NonNullable<ReviewResults["decision"]["approval"]["checks"]> {
  const check = { result, reason: "Inspected the evidence." };
  return {
    focused: check,
    low_risk: check,
    no_sensitive_changes: check,
    clean_review: check,
    complete_review: check,
    verification: check,
    concerns_resolved: check,
  };
}

function fullDecision(
  approval: Partial<ReviewResults["decision"]["approval"]> = {},
): ReviewResults["decision"] {
  return {
    ...evidence,
    approval: {
      outcome: "approve",
      changed_lines: 1,
      checks: approvalChecks(),
      reason: "Ready for review.",
      next_steps: [],
      ...approval,
    },
    summaryMarkdown: "Reviewed the change.",
    inlineComments: [],
  };
}

function reportAnswer(
  overrides: Partial<ReviewResults["report"]> = {},
): ReviewResults["report"] {
  return { ...evidence, decisions: [], ...overrides };
}

describe("review steps", () => {
  describe("worker evidence", () => {
    it("should reject evidence from a different pinned revision", async () => {
      const input = context({ ...evidence, head: "c".repeat(40) });
      await assert.rejects(
        researchReview({ input, results: {} }),
        /revisions differ from pinned inputs/,
      );
      assert.equal(input.attempts.length, 2);
    });

    it("should accept descriptive statuses and discard unused metadata", async () => {
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
  });

  describe("rule accounting", () => {
    it("should reject a silently omitted rule", async () => {
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

    it("should count an explicitly skipped rule as accounted for", async () => {
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
  });

  describe("report accounting", () => {
    it("should accept a report that accounts for an earlier finding", async () => {
      const report = reportAnswer({
        markdown: "F1: Await the save.",
        decisions: [retainedDecision],
      });
      const input = context(report);
      const answer = await acceptReport({
        input,
        results: { product: { ...evidence, findings: [sourceFinding] } },
      });
      assert.deepEqual(answer.decisions, [retainedDecision]);
      assert.equal(answer.markdown, report.markdown);
      assert.deepEqual(input.attempts, []);
    });

    it("should reject a report that omits an earlier finding", async () => {
      const input = context(reportAnswer());
      await assert.rejects(
        acceptReport({
          input,
          results: { product: { ...evidence, findings: [sourceFinding] } },
        }),
        /account for every input finding exactly once/,
      );
      assert.equal(input.attempts.length, 2);
    });

    it("should reject a retained finding missing from the report text", async () => {
      const input = context(reportAnswer({ decisions: [retainedDecision] }));
      await assert.rejects(
        acceptReport({
          input,
          results: { product: { ...evidence, findings: [sourceFinding] } },
        }),
        /Retained findings require an ID present in the report/,
      );
    });
  });

  describe("split decisions", () => {
    it("should accept multiline reasons without a full-review report", async () => {
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

    it("should require full-review checks when setup selected a full review", async () => {
      const input = context(splitDecision);
      await assert.rejects(
        decideReview({ input, results: { setup } }),
        /Full review requires all seven approval checks/,
      );
    });

    it("should reject inline findings in a split review", async () => {
      const input = context({
        ...splitDecision,
        inlineComments: [
          { id: "F1", path: "app.ts", line: 1, side: "RIGHT", body: "Bug" },
        ],
      });
      await assert.rejects(
        decideReview({
          input,
          results: { setup: { ...setup, mode: "split" } },
        }),
        /Split-only output must not claim implementation approval or inline findings/,
      );
    });
  });

  describe("full-review decisions", () => {
    it("should approve when all seven checks pass", async () => {
      const input = context(fullDecision());
      const answer = await decideReview({
        input,
        results: { setup, report: reportAnswer() },
      });
      assert.equal(answer.approval.outcome, "approve");
      assert.deepEqual(input.attempts, []);
    });

    it("should reject approval when verification fails", async () => {
      const checks: ReturnType<typeof approvalChecks> = {
        ...approvalChecks(),
        verification: { result: "Fail", reason: "CI failed." },
      };
      const input = context(fullDecision({ checks }));
      await assert.rejects(
        decideReview({ input, results: { setup, report: reportAnswer() } }),
        /every checklist item to pass/,
      );
    });

    it("should reject approval when verification is not verified", async () => {
      const checks: ReturnType<typeof approvalChecks> = {
        ...approvalChecks(),
        verification: { result: "Not verified", reason: "CI is pending." },
      };
      const input = context(fullDecision({ checks }));
      await assert.rejects(
        decideReview({ input, results: { setup, report: reportAnswer() } }),
        /every checklist item to pass/,
      );
    });

    for (const disposition of ["required", "open"] as const) {
      it(`should reject a clean review with a retained ${disposition} finding`, async () => {
        const input = context(fullDecision());
        await assert.rejects(
          decideReview({
            input,
            results: {
              setup,
              product: {
                ...evidence,
                findings: [{ ...sourceFinding, disposition }],
              },
              report: reportAnswer({
                markdown: "F1: Await the save.",
                decisions: [retainedDecision],
              }),
            },
          }),
          /Clean review cannot pass with retained required or unresolved findings/,
        );
      });
    }

    it("should reject an inline finding without an accepted new-bug source", async () => {
      const input = context({
        ...fullDecision({
          outcome: "human_review",
          checks: approvalChecks("Not verified"),
          reason: "Requires human inspection.",
          next_steps: ["Owner: inspect the evidence."],
        }),
        inlineComments: [
          {
            id: "unknown",
            path: "app.ts",
            line: 1,
            side: "RIGHT",
            body: "Bug",
          },
        ],
      });
      await assert.rejects(
        decideReview({ input, results: { setup, report: reportAnswer() } }),
        /Inline findings must reference an accepted new bug/,
      );
    });
  });
});
