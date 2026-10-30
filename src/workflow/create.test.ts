/**
 * Check workflow lifecycle and plugin isolation with ordinary in-memory tasks.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as z from "zod";
import { createWorkflow } from "./create.js";
import type { WorkflowCompleted, WorkflowPlugin } from "./create.js";
import type { WorkflowEvent, WorkflowSnapshot, WorkflowSteps } from "./run.js";

const inputSchema = z.strictObject({ value: z.number() });
type Input = z.infer<typeof inputSchema>;
type Results = { value: number };
type FinalizeInput = { input: Input; execution: WorkflowSnapshot<Results> };

/**
 * Hold a test operation until the scenario explicitly releases it.
 */
function gate() {
  let release = () => {};
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { wait, release };
}

async function execute({ steps }: { steps: WorkflowSteps<Input, Results> }) {
  await steps.run([
    { name: "value", execute: async ({ input }) => input.value },
  ]);
}

function finalize({ execution }: FinalizeInput) {
  return execution.results.value ?? 0;
}

describe("createWorkflow", () => {
  describe("input and plugin setup", () => {
    it("rejects invalid input before plugin setup", async () => {
      let initialised = false;
      const workflow = createWorkflow({
        input: inputSchema,
        plugins: {
          receipt: () => {
            initialised = true;
            return { state: null };
          },
        },
        execute,
        finalize,
      });

      await assert.rejects(workflow.run({ value: "invalid" }), z.ZodError);
      assert.equal(initialised, false);
    });

    it("isolates plugin state across concurrent runs", async () => {
      let initialisations = 0;
      const ready = new Set<Input>();
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
        ready.add(input);
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
        execute: async (args: {
          input: Input;
          steps: WorkflowSteps<Input, Results>;
        }) => {
          assert.equal(ready.has(args.input), true);
          await execute(args);
        },
        finalize: async (args: FinalizeInput) => finalize(args),
      });
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
  });

  describe("task execution and finalisation", () => {
    it("waits for sequential and parallel tasks before finalising", async () => {
      type Results = {
        seed: number;
        left: number;
        right: number;
        total: number;
      };
      const seedStarted = gate();
      const seed = gate();
      const leftStarted = gate();
      const batch = gate();
      const calls: string[] = [];
      let finalisations = 0;
      const workflow = createWorkflow({
        input: inputSchema,
        plugins: {
          progress: ({ events }) => {
            events.subscribe((event) => {
              if (event.type === "workflowCompleted") {
                calls.push("completed");
              }
            });
            return { state: null };
          },
        },
        execute: async ({
          steps,
        }: {
          steps: WorkflowSteps<Input, Results>;
        }) => {
          await steps.run([
            {
              name: "seed",
              execute: async ({ input }) => {
                calls.push("seed started");
                seedStarted.release();
                await seed.wait;
                calls.push("seed finished");
                return input.value;
              },
            },
          ]);
          await steps.run([
            {
              name: "left",
              execute: async ({ results }) => {
                calls.push("left started");
                leftStarted.release();
                await batch.wait;
                return (results.seed ?? 0) * 2;
              },
            },
            {
              name: "right",
              execute: async ({ results }) => {
                calls.push("right started");
                await batch.wait;
                return (results.seed ?? 0) + 3;
              },
            },
          ]);
          await steps.run([
            {
              name: "total",
              execute: async ({ results }) => {
                calls.push("total");
                return (results.left ?? 0) + (results.right ?? 0);
              },
            },
          ]);
        },
        finalize: async ({
          execution,
        }: {
          execution: WorkflowSnapshot<Results>;
        }) => {
          finalisations++;
          calls.push("finalised");
          return execution.results.total;
        },
      });

      const running = workflow.run({ value: 3 });
      await seedStarted.wait;
      try {
        assert.deepEqual(calls, ["seed started"]);
        seed.release();
        await leftStarted.wait;
        assert.deepEqual(calls, [
          "seed started",
          "seed finished",
          "left started",
          "right started",
        ]);
        assert.equal(finalisations, 0);
      } finally {
        seed.release();
        batch.release();
      }
      const { result } = await running;
      assert.equal(result, 12);
      assert.equal(finalisations, 1);
      assert.deepEqual(calls.slice(-3), ["total", "finalised", "completed"]);
    });
  });

  describe("plugin completion", () => {
    it("notifies with final delivery outcomes in either plugin order", async () => {
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

    it("awaits completion hooks in declaration order before notifying", async () => {
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
  });

  describe("error handling", () => {
    it("task failure stops dependents and finalises successful siblings", async () => {
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
        execute: async ({
          steps,
        }: {
          steps: WorkflowSteps<Input, Results>;
        }) => {
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

    it("propagates plugin setup failures before execution", async () => {
      const failure = new Error("Plugin setup failed");
      let executed = false;
      const workflow = createWorkflow({
        input: inputSchema,
        plugins: {
          broken: async () => {
            throw failure;
          },
        },
        execute: async () => {
          executed = true;
        },
        finalize,
      });

      await assert.rejects(
        workflow.run({ value: 1 }),
        (error) => error === failure,
      );
      assert.equal(executed, false);
    });

    it("propagates execution errors without finalising", async () => {
      const failure = new Error("Execution failed");
      let finalised = false;
      const workflow = createWorkflow({
        input: inputSchema,
        plugins: {},
        execute: async () => {
          throw failure;
        },
        finalize: () => {
          finalised = true;
        },
      });

      await assert.rejects(
        workflow.run({ value: 1 }),
        (error) => error === failure,
      );
      assert.equal(finalised, false);
    });

    it("propagates finalisation errors without completing plugins", async () => {
      const failure = new Error("Finalisation failed");
      let completed = false;
      const workflow = createWorkflow({
        input: inputSchema,
        plugins: {
          receipt: () => ({
            state: null,
            complete: () => {
              completed = true;
            },
          }),
        },
        execute,
        finalize: () => {
          throw failure;
        },
      });

      await assert.rejects(
        workflow.run({ value: 1 }),
        (error) => error === failure,
      );
      assert.equal(completed, false);
    });

    it("propagates completion hook errors without notifying observers", async () => {
      const failure = new Error("Completion hook failed");
      let notified = false;
      const workflow = createWorkflow({
        input: inputSchema,
        plugins: {
          receipt: ({ events }) => {
            events.subscribe((event) => {
              if (event.type === "workflowCompleted") {
                notified = true;
              }
            });
            return {
              state: null,
              complete: async () => {
                throw failure;
              },
            };
          },
        },
        execute,
        finalize,
      });

      await assert.rejects(
        workflow.run({ value: 1 }),
        (error) => error === failure,
      );
      assert.equal(notified, false);
    });

    it("propagates completion observer errors to the caller", async () => {
      const failure = new Error("Completion observer failed");
      const workflow = createWorkflow({
        input: inputSchema,
        plugins: {
          receipt: ({ events }) => {
            events.subscribe((event) => {
              if (event.type === "workflowCompleted") {
                throw failure;
              }
            });
            return { state: null };
          },
        },
        execute,
        finalize,
      });

      await assert.rejects(
        workflow.run({ value: 1 }),
        (error) => error === failure,
      );
    });
  });
});
