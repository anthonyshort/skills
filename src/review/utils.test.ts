/**
 * Check awaited nested events directly, without Pi or delivery simulation.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { ReviewEvents } from "./utils.js";

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
      await events.emit({ type: "stepAccepted", step: "setup", snapshot });
      calls.push("producer finished");
    }
  });

  const emitting = events.emit({
    type: "stepStarted",
    step: "setup",
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
