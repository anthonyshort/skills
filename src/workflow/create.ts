/**
 * Compose parsing, per-run plugins, execution and domain-specific finalisation.
 */
import {
  createWorkflowRun,
  WorkflowEvents,
  WorkflowTaskFailure,
} from "./run.js";
import type { WorkflowEvent, WorkflowSnapshot, WorkflowSteps } from "./run.js";

export type WorkflowCompleted<Result> = {
  readonly type: "workflowCompleted";
  readonly result: Result;
};

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
    [Name in keyof Plugins]: (args: {
      input: Input;
      events: WorkflowEvents<
        WorkflowEvent<Results> | WorkflowCompleted<Result> | ExtraEvent
      >;
    }) => Plugins[Name] | Promise<Plugins[Name]>;
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
