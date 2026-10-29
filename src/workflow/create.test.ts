/**
 * Check workflow lifecycle and plugin isolation with ordinary in-memory tasks.
 */
import assert from "node:assert/strict";
import test from "node:test";
import * as z from "zod";
import { createWorkflow } from "./create.js";
import type { WorkflowCompleted, WorkflowPlugin } from "./create.js";
import type { WorkflowEvent, WorkflowSnapshot, WorkflowSteps } from "./run.js";

const inputSchema = z.strictObject({ value: z.number() });
type Input = z.infer<typeof inputSchema>;
type Results = { value: number };
type FinalizeInput = { input: Input; execution: WorkflowSnapshot<Results> };

async function execute({ steps }: { steps: WorkflowSteps<Input, Results> }) {
  await steps.run([
    { name: "value", execute: async ({ input }) => input.value },
  ]);
}

function finalize({ execution }: FinalizeInput) {
  return execution.results.value ?? 0;
}

test("parsing precedes plugins, which initialise afresh for concurrent runs", async () => {
  let initialisations = 0;
  type State = { input: Input; value: number; observed: boolean };
  type States = { receipt: State };
  type Event = WorkflowEvent<Results> | WorkflowCompleted<number, States>;
  const receipt: WorkflowPlugin<Input, Event, number, State> = async ({
    input,
    events,
  }) => {
    initialisations++;
    const state = { input, value: 0, observed: false };
    // Async setup must finish before tasks or completion reach this plugin.
    await Promise.resolve();
    events.subscribe((event) => {
      if (event.type === "workflowCompleted") {
        state.observed = true;
      }
    });
    return {
      state,
      complete: ({ result }) => {
        state.value = result;
      },
    };
  };
  const workflow = createWorkflow({
    input: inputSchema,
    plugins: { receipt },
    execute,
    finalize: async (args: FinalizeInput) => finalize(args),
  });
  await assert.rejects(workflow.run({ value: "invalid" }));
  assert.equal(initialisations, 0);
  const [first, second] = await Promise.all([
    workflow.run({ value: 3 }),
    workflow.run({ value: 7 }),
  ]);
  assert.equal(initialisations, 2);
  assert.deepEqual(first.plugins.receipt, {
    input: { value: 3 },
    value: 3,
    observed: true,
  });
  assert.deepEqual(second.plugins.receipt, {
    input: { value: 7 },
    value: 7,
    observed: true,
  });
  assert.equal(first.result, 3);
  assert.equal(second.result, 7);
  assert.notEqual(first.plugins.receipt, second.plugins.receipt);
});

test("completion observers see confirmed, rejected and uncertain outcomes in either plugin order", async () => {
  type Receipt = "pending" | "confirmed" | "rejected" | "uncertain";
  type States = {
    notifications: { receipts: Receipt[] };
    publication: { receipt: Receipt };
  };
  type Event = WorkflowEvent<Results> | WorkflowCompleted<number, States>;

  const notifications: WorkflowPlugin<
    Input,
    Event,
    number,
    States["notifications"]
  > = ({ events }) => {
    const state: States["notifications"] = { receipts: [] };
    events.subscribe(async (event) => {
      if (event.type === "workflowCompleted") {
        await Promise.resolve();
        state.receipts.push(event.plugins.publication.receipt);
      }
    });
    return { state };
  };

  for (const receipt of ["confirmed", "rejected", "uncertain"] as const) {
    const publication: WorkflowPlugin<
      Input,
      Event,
      number,
      States["publication"]
    > = () => {
      const state: States["publication"] = { receipt: "pending" };
      return {
        state,
        complete: async () => {
          await Promise.resolve();
          state.receipt = receipt;
        },
      };
    };
    for (const plugins of [
      { notifications, publication },
      { publication, notifications },
    ]) {
      const workflow = createWorkflow({
        input: inputSchema,
        plugins,
        execute,
        finalize,
      });
      const result = await workflow.run({ value: 1 });
      assert.equal(result.plugins.publication.receipt, receipt);
      assert.deepEqual(result.plugins.notifications.receipts, [receipt]);
    }
  }
});

test("completion waits for delayed hooks in declaration order before notifying", async () => {
  const calls: string[] = [];
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let entered = () => {};
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const workflow = createWorkflow({
    input: inputSchema,
    plugins: {
      first: ({ events }) => {
        events.subscribe((event) => {
          if (event.type === "workflowCompleted") {
            calls.push("notified");
          }
        });
        return {
          state: null,
          complete: async () => {
            calls.push("first started");
            entered();
            await held;
            calls.push("first finished");
          },
        };
      },
      second: () => ({
        state: null,
        complete: () => {
          calls.push("second finished");
        },
      }),
    },
    execute,
    finalize,
  });
  const running = workflow.run({ value: 1 });
  await started;
  try {
    assert.deepEqual(calls, ["first started"]);
  } finally {
    release();
  }
  await running;
  assert.deepEqual(calls, [
    "first started",
    "first finished",
    "second finished",
    "notified",
  ]);
});

test("task failure stops dependents and finalises successful siblings", async () => {
  type Results = { failed: string; accepted: number };
  let dependentRan = false;
  let completed = false;
  let hookSawPartialWork = false;
  const workflow = createWorkflow({
    input: inputSchema,
    plugins: {
      progress: ({ events }) => {
        events.subscribe((event) => {
          if (event.type === "workflowCompleted") {
            completed = true;
          }
        });
        return {
          state: null,
          complete: ({ result }: { result: WorkflowSnapshot<Results> }) => {
            hookSawPartialWork =
              result.results.accepted === 5 && result.failures.length === 1;
          },
        };
      },
    },
    execute: async ({ steps }: { steps: WorkflowSteps<Input, Results> }) => {
      await steps.run([
        {
          name: "failed",
          execute: async () => {
            throw new Error("Exhausted");
          },
        },
        { name: "accepted", execute: async ({ input }) => input.value },
      ]);
      dependentRan = true;
    },
    finalize: ({ execution }: { execution: WorkflowSnapshot<Results> }) =>
      execution,
  });
  const { result } = await workflow.run({ value: 5 });
  assert.equal(dependentRan, false);
  assert.equal(hookSawPartialWork, true);
  assert.equal(completed, true);
  assert.deepEqual(result, {
    results: { accepted: 5 },
    failures: [{ name: "failed", reason: "Exhausted" }],
  });
});

test("unexpected setup, execution, finalisation, hook and observer errors propagate", async () => {
  for (const boundary of ["setup", "execute", "finalize", "hook", "observer"]) {
    const failure = new Error(boundary);
    let completed = false;
    const workflow = createWorkflow({
      input: inputSchema,
      plugins: {
        observer: ({ events }) => {
          if (boundary === "setup") {
            throw failure;
          }
          events.subscribe((event) => {
            if (event.type === "workflowCompleted") {
              completed = true;
              if (boundary === "observer") {
                throw failure;
              }
            }
          });
          return {
            state: null,
            complete: () => {
              if (boundary === "hook") {
                throw failure;
              }
            },
          };
        },
      },
      execute: async (args: { steps: WorkflowSteps<Input, Results> }) => {
        if (boundary === "execute") {
          throw failure;
        }
        await execute(args);
      },
      finalize: (args: FinalizeInput) => {
        if (boundary === "finalize") {
          throw failure;
        }
        return finalize(args);
      },
    });
    await assert.rejects(
      workflow.run({ value: 1 }),
      (error) => error === failure,
    );
    assert.equal(completed, boundary === "observer");
  }
});
