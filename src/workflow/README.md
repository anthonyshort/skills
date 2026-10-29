# Workflow helpers

These helpers run an explicit sequence of named tasks, retain accepted results and let per-run plugins observe progress and completion. Review prompts, review policy and delivery remain in [`../review/`](../review/).

## Define a workflow

`createWorkflow` accepts an input parser, named plugin functions, an `execute` function and a `finalize` function. This example uses ordinary in-memory tasks and can run with `node --import tsx` from a TypeScript file beside this README.

```typescript
import * as z from "zod";
import { createWorkflow } from "./create.js";
import type { WorkflowCompleted, WorkflowPlugin } from "./create.js";
import type { WorkflowEvent } from "./run.js";

const inputSchema = z.strictObject({ count: z.number() });
type Input = z.infer<typeof inputSchema>;
type Results = { doubled: number };
type Output = { value: number | null; failed: boolean };
type Event = WorkflowEvent<Results> | WorkflowCompleted<Output>;
type Completion = { readonly value: number | null };
```

A plugin receives parsed input and the run’s event emitter. It may initialise asynchronously; it must register its observers before resolving. Its returned object belongs to that run and remains available after completion.

```typescript
const completion: WorkflowPlugin<Input, Event, Completion> = ({ events }) => {
  let value: number | null = null;
  events.subscribe((event) => {
    if (event.type === "workflowCompleted") {
      value = event.result.value;
    }
  });
  return { get value() { return value; } };
};
```

The task name determines its result key and return type. A call to `steps.run` starts every supplied task in parallel. Await a singleton array when the next step depends on its result.

```typescript
const workflow = createWorkflow<Input, Results, Output, { completion: Completion }>({
  input: inputSchema,
  plugins: { completion },
  execute: async ({ steps }) => {
    await steps.run([{
      name: "doubled",
      execute: async ({ input }) => input.count * 2,
    }]);
  },
  finalize: ({ execution }) => ({
    value: execution.results.doubled ?? null,
    failed: execution.failures.length > 0,
  }),
});

const { result, plugins } = await workflow.run({ count: 3 });
console.log(result.value, plugins.completion.value); // 6, 6
```

The type parameters are parsed input, task-result map, final result, plugin-state map and optional extra events. Named parser, execution and finalisation functions often provide enough information for inference. Declare the parameters explicitly when plugins emit domain-specific events, so their event union includes `WorkflowEvent<Results>`, `WorkflowCompleted<Output>` and those extra events.

Review’s GitHub and notification functions are explicitly typed as `WorkflowPlugin<ReviewInput, ReviewEvent, State>` in their own modules. The plugin-state map contains resolved states; use `Awaited<ReturnType<typeof plugin>>` when deriving one from a plugin function that may return a promise. The review workflow adapts its worker context to those plugins by passing `input.review` as their input. Delivery state and additional events belong to the plugins.

## Lifecycle and failures

Each `workflow.run(args)`:

1. Parses input before any plugin initialises.
2. Creates fresh events, task results and plugin states, awaiting plugin setup in declaration order.
3. Runs `execute`, which chooses the task order.
4. Calls `finalize` with accepted results and recorded failures, awaiting its result.
5. Emits `workflowCompleted`, awaits its observers and returns `{ result, plugins }`.

A batch emits `tasksStarted`, runs its tasks against one prior-results snapshot, accepts successful results in declaration order and emits `tasksFinished`. Failed tasks do not cancel their siblings. After recording all outcomes, the runner throws `WorkflowTaskFailure`; `createWorkflow` catches that error so finalisation receives partial work. Later statements in `execute` do not run after an awaited failed batch.

Input parsing, plugin setup, finalisation and event-observer errors propagate. Observers run in subscription order. A nested emission finishes before its parent continues, so a publication plugin can emit its delivery outcome and await final notifications before the workflow returns. Keep plugin objects intact when returning their state; copying a getter’s value during setup would capture its initial state.

Snapshots copy only the result and failure containers. Tasks and observers must treat nested accepted values as immutable. `createWorkflowRun` is available directly when the caller needs the runner without parsing, plugin setup or finalisation.

## Validated agent calls

`callValidatedAgent` requires an explicit `call` function, a Zod `outputSchema` and a positive integer `maxAttempts`. It converts the output schema for the agent call, parses the returned answer and applies an optional domain check. Rejected calls, null answers and validation failures receive bounded retries with the previous failure added to the prompt. An optional `onAttemptFailed` callback records diagnostics; errors from that callback propagate without another call.

This standalone example supplies an in-memory call. In Pi, the review worker supplies `call: agent`; the helper has no default global agent dependency.

```typescript
import { callValidatedAgent } from "./agent.js";

const answer = await callValidatedAgent({
  call: async () => ({ count: 3 }),
  label: "count",
  prompt: "Count the items.",
  outputSchema: z.strictObject({ count: z.number().positive() }),
  maxAttempts: 2,
});
console.log(answer.count); // 3
```

The runner does not retry tasks or delivery. These in-memory examples and the colocated unit tests do not establish live model or delivery behaviour.
