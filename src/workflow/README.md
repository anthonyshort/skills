# Workflow helpers

These helpers run an explicit sequence of named tasks, retain accepted results and let per-run plugins observe progress and completion. Review prompts, review policy and delivery remain in [`../review/`](../review/).

## Define a workflow

`createWorkflow` accepts an input parser, named plugin functions, an `execute` function and a `finalize` function. This example uses ordinary in-memory tasks and can run with `node --import tsx` from a TypeScript file beside this README.

```typescript
import * as z from "zod";
import { createWorkflow } from "./create.js";
import type { WorkflowCompleted, WorkflowPlugin } from "./create.js";
import type { WorkflowEvent, WorkflowSnapshot, WorkflowSteps } from "./run.js";

const inputSchema = z.strictObject({ count: z.number() });
type Input = z.infer<typeof inputSchema>;
type Results = { doubled: number };
type Output = { value: number | null; failed: boolean };
type Completion = { value: number | null };
type States = { completion: Completion };
type Event = WorkflowEvent<Results> | WorkflowCompleted<Output, States>;
```

A plugin receives parsed input and event subscription access. It returns `{ state, complete? }`, optionally after asynchronous setup. Register observers before resolving. The optional `complete({ result })` hook receives the finalised result and finishes before final observers run. Plugins observe lifecycle events; they do not emit them.

```typescript
const completion: WorkflowPlugin<Input, Event, Output, Completion> = ({ events }) => {
  const state: Completion = { value: null };
  events.subscribe((event) => {
    if (event.type === "workflowCompleted") {
      console.log(event.plugins.completion.value);
    }
  });
  return {
    state,
    complete: ({ result }) => { state.value = result.value; },
  };
};
```

The task name determines its result key and return type. A call to `steps.run` starts every supplied task in parallel. Await a singleton array when the next step depends on its result.

```typescript
const workflow = createWorkflow({
  input: inputSchema,
  plugins: { completion },
  execute: async ({ steps }: { steps: WorkflowSteps<Input, Results> }) => {
    await steps.run([{
      name: "doubled",
      execute: async ({ input }) => input.count * 2,
    }]);
  },
  finalize: ({ execution }: { execution: WorkflowSnapshot<Results> }): Output => ({
    value: execution.results.doubled ?? null,
    failed: execution.failures.length > 0,
  }),
});

const { result, plugins } = await workflow.run({ count: 3 });
console.log(result.value, plugins.completion.value); // 6, 6
```

`createWorkflow` infers parsed input, task results, final output and plugin states from the named functions. Its four type parameters describe those same types. `WorkflowPlugin<Input, Event, Output, State>` names a plugin’s input, standard event union, final output and returned state. Plugins share `WorkflowEvent<Results> | WorkflowCompleted<Output, States>`; the final event includes all resolved plugin states.

Review’s GitHub and notification functions use `WorkflowPlugin<ReviewContext, ReviewEvent, ReviewResult, State>`. They read the parsed review input from `input.review`. GitHub publishes in its completion hook; final notifications read the resulting publication state from `event.plugins.github`. A plugin instance’s `state` becomes `plugins[name]` in both the final event and the returned object; the completion hook stays private to the lifecycle.

## Lifecycle and failures

Each `workflow.run(args)`:

1. Parses input before any plugin initialises.
2. Creates fresh events, task results and plugin states, awaiting plugin setup in declaration order.
3. Runs `execute`, which chooses the task order.
4. Calls `finalize` with accepted results and recorded failures, awaiting its result.
5. Awaits each plugin’s optional `complete({ result })` hook in declaration order.
6. Emits `workflowCompleted` with the result and plugin states, awaits its observers and returns `{ result, plugins }`.

A batch emits `tasksStarted`, runs its tasks against one prior-results snapshot, accepts successful results in declaration order and emits `tasksFinished`. Failed tasks do not cancel their siblings. After recording all outcomes, the runner throws `WorkflowTaskFailure`; `createWorkflow` catches that error so finalisation receives partial work. Later statements in `execute` do not run after an awaited failed batch.

Input parsing, plugin setup, finalisation, completion-hook and event-observer errors propagate. An unexpected completion-hook error stops the remaining hooks and prevents `workflowCompleted`. Expected delivery outcomes such as rejected or uncertain receipts belong in plugin state, so final observers can still report them. Observers run in subscription order and are awaited before the workflow returns. Completion hooks always finish before those final observers, regardless of the plugins’ declaration order.

Plugin state objects are retained directly. Update their fields during completion, or use getters for closure-held state. Copying a getter’s value during setup would capture its initial state.

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
