/**
 * Check workflow lifecycle and plugin isolation with ordinary in-memory tasks.
 */
import assert from "node:assert/strict";
import test from "node:test";
import * as z from "zod";
import { createWorkflow } from "./create.js";
import type { WorkflowCompleted } from "./create.js";
import type {
  WorkflowEvent,
  WorkflowEvents,
  WorkflowSnapshot,
  WorkflowSteps,
} from "./run.js";

type Input = { value: number };
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
  const workflow = createWorkflow({
    input: z.strictObject({ value: z.number() }),
    plugins: {
      receipt: async ({ input, events }) => {
        initialisations++;
        let value = 0;
        // Async setup must finish before tasks or completion can reach this plugin.
        await Promise.resolve();
        events.subscribe((event) => {
          if (event.type === "workflowCompleted") {
            value = event.result;
          }
        });
        return {
          input,
          get value() {
            return value;
          },
        };
      },
    },
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
  assert.equal(first.result, 3);
  assert.equal(first.plugins.receipt.value, 3);
  assert.equal(second.result, 7);
  assert.equal(second.plugins.receipt.value, 7);
  assert.notEqual(first.plugins.receipt, second.plugins.receipt);
});

test("nested publication completes final notifications with either plugin order", async () => {
  type Event =
    | WorkflowEvent<Results>
    | WorkflowCompleted<number>
    | { type: "published"; receipt: string };
  type PluginInput = { input: Input; events: WorkflowEvents<Event> };
  function notifications({ events }: PluginInput) {
    const receipts: string[] = [];
    events.subscribe(async (event) => {
      if (event.type === "published") {
        await Promise.resolve();
        receipts.push(event.receipt);
      }
    });
    return { receipts };
  }
  function publication({ events }: PluginInput) {
    let receipt = "pending";
    events.subscribe(async (event) => {
      if (event.type === "workflowCompleted") {
        receipt = "confirmed";
        await events.emit({ type: "published", receipt });
      }
    });
    return {
      get receipt() {
        return receipt;
      },
    };
  }
  for (const plugins of [
    { notifications, publication },
    { publication, notifications },
  ]) {
    const workflow = createWorkflow<
      Input,
      Results,
      number,
      {
        notifications: ReturnType<typeof notifications>;
        publication: ReturnType<typeof publication>;
      },
      { type: "published"; receipt: string }
    >({
      input: z.strictObject({ value: z.number() }),
      plugins,
      execute,
      finalize,
    });
    const result = await workflow.run({ value: 1 });
    assert.equal(result.plugins.publication.receipt, "confirmed");
    assert.deepEqual(result.plugins.notifications.receipts, ["confirmed"]);
  }
});

test("task failure stops dependents and finalises successful siblings", async () => {
  type Results = { failed: string; accepted: number };
  let dependentRan = false;
  let completed = false;
  const workflow = createWorkflow({
    input: z.strictObject({ value: z.number() }),
    plugins: {
      progress: ({ events }) => {
        events.subscribe((event) => {
          if (event.type === "workflowCompleted") {
            completed = true;
          }
        });
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
  assert.equal(completed, true);
  assert.deepEqual(result, {
    results: { accepted: 5 },
    failures: [{ name: "failed", reason: "Exhausted" }],
  });
});

test("unexpected execution, finalisation and completion errors propagate", async () => {
  for (const boundary of ["execute", "finalize", "complete"]) {
    const failure = new Error(boundary);
    const workflow = createWorkflow({
      input: z.strictObject({ value: z.number() }),
      plugins: {
        observer: ({ events }) => {
          events.subscribe((event) => {
            if (event.type === "workflowCompleted" && boundary === "complete") {
              throw failure;
            }
          });
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
  }
});
