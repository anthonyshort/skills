/**
 * Check parallel progress directly, without Pi or delivery simulation.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { parseReviewInput } from "../input.js";
import type { StageResults } from "../steps.js";
import { reviewEventProgress } from "./progress.js";

const evidence = {
  base: "a".repeat(40),
  head: "b".repeat(40),
  markdown: "Inspected scope.",
  checks: [],
  findings: [],
  gaps: [],
};
const stages: StageResults = {
  setup: {
    ...evidence,
    mode: "full",
    addedLines: 1,
    deletedLines: 0,
    sizeException: null,
    rulePaths: [],
  },
};

test("parallel starts show every task running in one progress update", () => {
  const progress = reviewEventProgress({
    type: "tasksStarted",
    names: ["product", "correctness"],
    snapshot: { results: stages, failures: [] },
  });
  assert.deepEqual(progress?.statuses, {
    setup: "complete",
    product: "running",
    correctness: "running",
  });
});

test("a failed batch keeps accepted siblings complete in progress", () => {
  const progress = reviewEventProgress({
    type: "tasksFinished",
    names: ["product", "correctness"],
    snapshot: {
      results: { ...stages, product: { ...evidence } },
      failures: [{ name: "correctness", reason: "Attempts exhausted." }],
    },
  });
  assert.deepEqual(progress?.statuses, {
    setup: "complete",
    product: "complete",
    correctness: "blocked",
  });
});

test("workflow completion includes the resolved publication outcome", () => {
  const progress = reviewEventProgress({
    type: "workflowCompleted",
    result: {
      input: parseReviewInput({
        packageRoot: "/skills",
        repository: "/app",
        target: "Review app",
        base: evidence.base,
        head: evidence.head,
        runId: "progress",
      }),
      status: "incomplete",
      stages,
      failures: [{ stage: "correctness", reason: "Attempts exhausted." }],
      attempts: [],
      report: null,
      approval: null,
    },
    plugins: {
      github: {
        publication: {
          status: "uncertain",
          reason: "Inspect GitHub.",
          url: null,
          review: null,
        },
      },
      notifications: { receipts: [] },
    },
  });
  assert.equal(progress?.statuses.review, "incomplete");
  assert.equal(progress?.statuses.publication, "uncertain");
  assert.match(progress?.reason ?? "", /GitHub: uncertain\. Inspect GitHub\./);
});
