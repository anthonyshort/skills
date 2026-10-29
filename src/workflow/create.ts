/**
 * Compose parsing, per-run plugins, execution and domain-specific finalisation.
 */
import {
  createWorkflowRun,
  WorkflowEvents,
  WorkflowTaskFailure,
} from "./run.js";
import type { WorkflowEvent, WorkflowSnapshot, WorkflowSteps } from "./run.js";

/**
 * Emitted after finalisation, including when task failures produced partial work.
 */
export type WorkflowCompleted<Result> = {
  readonly type: "workflowCompleted";
  readonly result: Result;
};

/**
 * Initialise one plugin for a run. Register observers before resolving; the
 * returned state remains available after completion observers finish.
 */
export type WorkflowPlugin<Input, Event, State> = (args: {
  input: Input;
  events: WorkflowEvents<Event>;
}) => State | Promise<State>;

/**
 * Create a reusable workflow whose run(args) parses before initialising plugins.
 * Plugins initialise in declaration order, then execute schedules named tasks.
 * Recorded task failures reach finalize as partial results; other errors escape.
 * Completion observers, including nested emissions, finish before run returns
 * the final result and the per-run plugin states.
 */
export function createWorkflow<
  Input,
  Results,
  Result,
  Plugins,
  ExtraEvent = never,
>({
  input: parser,
  plugins,
  execute,
  finalize,
}: {
  input: { parse: (args: unknown) => Input };
  plugins: {
    [Name in keyof Plugins]: WorkflowPlugin<
      Input,
      WorkflowEvent<Results> | WorkflowCompleted<Result> | ExtraEvent,
      Plugins[Name]
    >;
  };
  execute: (args: {
    input: Input;
    steps: WorkflowSteps<Input, Results>;
  }) => Promise<void>;
  finalize: (args: {
    input: Input;
    execution: WorkflowSnapshot<Results>;
  }) => Result | Promise<Result>;
}) {
  /**
   * Run a fresh instance and return only after finalisation and plugin observers.
   */
  async function run(args: unknown) {
    const input = parser.parse(args);
    const events = new WorkflowEvents<
      WorkflowEvent<Results> | WorkflowCompleted<Result> | ExtraEvent
    >();
    const steps = createWorkflowRun<Input, Results>({ input, events });

    // Each configured plugin initialises once, before any task can emit progress.
    const states = {} as Plugins;
    for (const name in plugins) {
      states[name] = await plugins[name]({ input, events });
    }

    try {
      await execute({ input, steps });
    } catch (error) {
      if (!(error instanceof WorkflowTaskFailure)) {
        throw error;
      }
    }

    const result = await finalize({ input, execution: steps.result() });
    // Completion listeners may await further plugin events, such as publication.
    await events.emit({ type: "workflowCompleted", result });
    return { result, plugins: states };
  }

  return { run };
}
