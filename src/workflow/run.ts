/**
 * Execute named tasks without choosing a workflow's order, policies or delivery.
 */
export type StepInput<Input, Results> = {
  readonly input: Input;
  readonly results: Readonly<Partial<Results>>;
};

type Task<Input, Results, Name extends keyof Results & string> = {
  [Key in Name]: {
    name: Key;
    execute: (args: StepInput<Input, Results>) => Promise<Results[Key]>;
  };
}[Name];

export type WorkflowSnapshot<Results> = {
  readonly results: Readonly<Partial<Results>>;
  readonly failures: readonly {
    readonly name: keyof Results & string;
    readonly reason: string;
  }[];
};

export type WorkflowEvent<Results> = {
  readonly type: "tasksStarted" | "tasksFinished";
  readonly names: readonly (keyof Results & string)[];
  readonly snapshot: WorkflowSnapshot<Results>;
};

/**
 * Await observers in subscription order, including any nested emissions.
 */
export class WorkflowEvents<Event> {
  private readonly handlers: ((event: Event) => void | Promise<void>)[] = [];

  subscribe(handler: (event: Event) => void | Promise<void>): void {
    this.handlers.push(handler);
  }

  async emit(event: Event): Promise<void> {
    for (const handler of this.handlers) {
      await handler(event);
    }
  }
}

/**
 * Stop dependent work after task failure without hiding observer failures.
 */
export class WorkflowTaskFailure extends Error {}

/**
 * Normalise thrown values for failure records and validation feedback.
 */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Each batch sees one snapshot. Tasks and observers must treat accepted values
 * as immutable; container copies keep acceptance from changing earlier snapshots.
 */
export function createWorkflowRun<Input, Results>({
  input,
  events,
}: {
  input: Input;
  events: Pick<WorkflowEvents<WorkflowEvent<Results>>, "emit">;
}) {
  const accepted: Partial<Results> = {};
  const failures: { name: keyof Results & string; reason: string }[] = [];

  function result(): WorkflowSnapshot<Results> {
    return { results: { ...accepted }, failures: [...failures] };
  }

  async function run<Name extends keyof Results & string>(
    tasks: readonly Task<Input, Results, Name>[],
  ): Promise<Results[Name][]> {
    const snapshot = result();
    const names = tasks.map(({ name }) => name);
    await events.emit({ type: "tasksStarted", names, snapshot });

    // Capture task errors inside the barrier. Observer errors propagate directly.
    const outcomes = await Promise.all(
      tasks.map(
        async ({
          execute,
        }): Promise<{ result: Results[Name] } | { reason: string }> => {
          try {
            return {
              result: await execute({ input, results: snapshot.results }),
            };
          } catch (error) {
            return { reason: errorMessage(error) };
          }
        },
      ),
    );
    const values: Results[Name][] = [];
    for (const [index, { name }] of tasks.entries()) {
      const outcome = outcomes[index];
      if ("result" in outcome) {
        accepted[name] = outcome.result;
        values.push(outcome.result);
      } else {
        failures.push({ name, reason: outcome.reason });
      }
    }
    await events.emit({ type: "tasksFinished", names, snapshot: result() });
    if (values.length !== tasks.length) {
      throw new WorkflowTaskFailure(
        failures.map(({ name, reason }) => `${name}: ${reason}`).join("\n"),
      );
    }
    return values;
  }

  return { run, result };
}

export type WorkflowSteps<Input, Results> = ReturnType<
  typeof createWorkflowRun<Input, Results>
>;
