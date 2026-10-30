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
 * Emitted after finalisation and plugin completion hooks, with resolved plugin states.
 */
export type WorkflowCompleted<Result, Plugins> = {
  readonly type: "workflowCompleted";
  readonly result: Result;
  readonly plugins: Plugins;
};

/**
 * Per-run state and optional completion work. Completion receives the finalised
 * result, including partial work, and finishes before workflowCompleted.
 */
export type WorkflowPluginInstance<Result, State> = {
  state: State;
  complete?: (args: { result: Result }) => void | Promise<void>;
};

/**
 * Initialise a plugin and register progress or final observers before resolving.
 * Put result-dependent work in complete; only the workflow publishes lifecycle events.
 */
export type WorkflowPlugin<Input, Event, Result, State> = (args: {
  input: Input;
  events: Pick<WorkflowEvents<Event>, "subscribe">;
}) =>
  | WorkflowPluginInstance<Result, State>
  | Promise<WorkflowPluginInstance<Result, State>>;

/**
 * Create a reusable workflow whose run(args) parses before initialising plugins.
 * Plugins initialise in declaration order, then execute schedules named tasks.
 * Recorded task failures reach finalize as partial results; other errors escape.
 * Completion hooks finish before the final event is emitted. Observers then
 * finish before run returns the result and the per-run plugin states.
 */
export function createWorkflow<Input, Results, Result, Plugins>({
  input: parser,
  plugins,
  execute,
  finalize,
}: {
  input: { parse: (args: unknown) => Input };
  plugins: {
    [Name in keyof Plugins]: WorkflowPlugin<
      Input,
      WorkflowEvent<Results> | WorkflowCompleted<Result, Plugins>,
      Result,
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
      WorkflowEvent<Results> | WorkflowCompleted<Result, Plugins>
    >();
    const steps = createWorkflowRun<Input, Results>({ input, events });

    // Each configured plugin initialises once, before any task can emit progress.
    const states = {} as Plugins;
    const completions: ((result: Result) => void | Promise<void>)[] = [];
    for (const name in plugins) {
      const plugin = await plugins[name]({ input, events });
      states[name] = plugin.state;
      if (plugin.complete) {
        completions.push((result) => plugin.complete?.({ result }));
      }
    }

    try {
      await execute({ input, steps });
    } catch (error) {
      if (!(error instanceof WorkflowTaskFailure)) {
        throw error;
      }
    }

    const result = await finalize({ input, execution: steps.result() });
    // Finish delivery before final observers read the resolved plugin states.
    for (const complete of completions) {
      await complete(result);
    }
    await events.emit({ type: "workflowCompleted", result, plugins: states });
    return { result, plugins: states };
  }

  return { run };
}
