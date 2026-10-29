/**
 * Check parallel progress directly, without Pi or delivery simulation.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { StageResults } from "./schemas.js";
import { reviewEventProgress } from "./utils.js";

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
    stage: "setup",
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
      results: { ...stages, product: { ...evidence, stage: "product" } },
      failures: [{ name: "correctness", reason: "Attempts exhausted." }],
    },
  });
  assert.deepEqual(progress?.statuses, {
    setup: "complete",
    product: "complete",
    correctness: "blocked",
  });
});
