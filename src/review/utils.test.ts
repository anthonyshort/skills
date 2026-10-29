/**
 * Check awaited nested events directly, without Pi or delivery simulation.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import type { StageResults } from "./contracts.js";
import { ReviewEvents, reviewEventProgress } from "./utils.js";

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
    type: "stepStarted",
    steps: ["product", "correctness"],
    snapshot: { stages, failures: [] },
  });
  assert.deepEqual(progress?.statuses, {
    setup: "complete",
    product: "running",
    correctness: "running",
  });
});

test("a failed batch keeps accepted siblings complete in progress", () => {
  const progress = reviewEventProgress({
    type: "stepFailed",
    steps: ["product", "correctness"],
    reason: "Correctness exhausted its attempts.",
    snapshot: {
      stages: { ...stages, product: { ...evidence, stage: "product" } },
      failures: [{ stage: "correctness", reason: "Attempts exhausted." }],
    },
  });
  assert.deepEqual(progress?.statuses, {
    setup: "complete",
    product: "complete",
    correctness: "blocked",
  });
});

test("emit waits for a nested observer registered before its producer", async () => {
  const events = new ReviewEvents();
  const snapshot = { stages: {}, failures: [] };
  const calls: string[] = [];
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });

  events.subscribe(async (event) => {
    if (event.type === "stepAccepted") {
      await held;
      calls.push("observer finished");
    }
  });
  events.subscribe(async (event) => {
    if (event.type === "stepStarted") {
      await events.emit({ type: "stepAccepted", steps: ["setup"], snapshot });
      calls.push("producer finished");
    }
  });

  const emitting = events.emit({
    type: "stepStarted",
    steps: ["setup"],
    snapshot,
  });
  await setImmediate();
  try {
    assert.deepEqual(calls, []);
  } finally {
    release();
  }
  await emitting;
  assert.deepEqual(calls, ["observer finished", "producer finished"]);
});
