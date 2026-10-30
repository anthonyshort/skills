/**
 * Exercise the shared runner with ordinary tasks, without a Pi runtime.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import {
  createWorkflowRun,
  WorkflowEvents,
  WorkflowTaskFailure,
} from "./run.js";
import type { WorkflowEvent } from "./run.js";

test("a batch shares prior results, starts together and accepts in declaration order", async () => {
  type Results = { seed: number; left: number; right: string };
  const events = new WorkflowEvents<WorkflowEvent<Results>>();
  const steps = createWorkflowRun<{ offset: number }, Results>({
    input: { offset: 2 },
    events,
  });
  const [seed] = await steps.run([{ name: "seed", execute: async () => 0 }]);
  const numericSeed: number = seed;
  assert.equal(numericSeed, 0);
  const earlier = steps.result();
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started: string[] = [];
  const batch = steps.run([
    {
      name: "left",
      execute: async ({ input, results }) => {
        started.push("left");
        await held;
        assert.deepEqual(results, { seed: 0 });
        return (results.seed ?? 0) + input.offset;
      },
    },
    {
      name: "right",
      execute: async ({ results }) => {
        started.push("right");
        assert.deepEqual(results, { seed: 0 });
        return "done";
      },
    },
  ]);
  await setImmediate();
  try {
    assert.deepEqual(started, ["left", "right"]);
    assert.deepEqual(steps.result().results, { seed: 0 });
  } finally {
    release();
  }
  assert.deepEqual(await batch, [2, "done"]);
  assert.deepEqual(Object.keys(steps.result().results), [
    "seed",
    "left",
    "right",
  ]);
  assert.deepEqual(earlier.results, { seed: 0 });
});

test("a failed batch retains successful siblings before reporting failure", async () => {
  type Results = { failed: string; accepted: boolean };
  const events = new WorkflowEvents<WorkflowEvent<Results>>();
  const seen: WorkflowEvent<Results>[] = [];
  events.subscribe((event) => {
    seen.push(event);
  });
  const steps = createWorkflowRun<null, Results>({ input: null, events });
  await assert.rejects(
    steps.run([
      {
        name: "failed",
        execute: async () => {
          throw new Error("Task exhausted");
        },
      },
      { name: "accepted", execute: async () => false },
    ]),
    WorkflowTaskFailure,
  );
  assert.deepEqual(steps.result(), {
    results: { accepted: false },
    failures: [{ name: "failed", reason: "Task exhausted" }],
  });
  assert.equal(seen.length, 2);
  assert.equal(seen[1].type, "tasksFinished");
  assert.deepEqual(seen[1].snapshot.results, { accepted: false });
  assert.deepEqual(seen[0].snapshot, { results: {}, failures: [] });
});

test("observer errors propagate after sibling results and failures are recorded", async () => {
  type Results = { failed: string; accepted: number };
  const events = new WorkflowEvents<WorkflowEvent<Results>>();
  const observerError = new Error("Observer failed");
  events.subscribe((event) => {
    if (event.type === "tasksFinished") {
      throw observerError;
    }
  });
  const steps = createWorkflowRun<null, Results>({ input: null, events });
  await assert.rejects(
    steps.run([
      {
        name: "failed",
        execute: async () => {
          throw new Error("Task failed");
        },
      },
      { name: "accepted", execute: async () => 42 },
    ]),
    (error) => error === observerError,
  );
  assert.deepEqual(steps.result().results, { accepted: 42 });
  assert.deepEqual(steps.result().failures, [
    { name: "failed", reason: "Task failed" },
  ]);
});

test("emit awaits nested observers registered before their producer", async () => {
  const events = new WorkflowEvents<"started" | "accepted">();
  const calls: string[] = [];
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  events.subscribe(async (event) => {
    if (event === "accepted") {
      await held;
      calls.push("observer finished");
    }
  });
  events.subscribe(async (event) => {
    if (event === "started") {
      await events.emit("accepted");
      calls.push("producer finished");
    }
  });
  const emitting = events.emit("started");
  await setImmediate();
  try {
    assert.deepEqual(calls, []);
  } finally {
    release();
  }
  await emitting;
  assert.deepEqual(calls, ["observer finished", "producer finished"]);
});
