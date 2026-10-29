/**
 * Execute named tasks without choosing a workflow's order, policies or delivery.
 */
/**
 * Run input and prior accepted results shared by every task in one batch.
 * Readonly protects the containers; nested values must also be left unchanged.
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

/**
 * A shallow copy of accepted results and recorded task failures at one moment.
 */
export type WorkflowSnapshot<Results> = {
  readonly results: Readonly<Partial<Results>>;
  readonly failures: readonly {
    readonly name: keyof Results & string;
    readonly reason: string;
  }[];
};

/**
 * One start and finish event per batch. Finished snapshots include successful
 * siblings and any failures, so completion alone does not imply success.
 */
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

  /**
   * Register a handler for this run. Handlers remain subscribed for its lifetime.
   */
  subscribe(handler: (event: Event) => void | Promise<void>): void {
    this.handlers.push(handler);
  }

  /**
   * Await handlers in order. Nested emissions finish before their parent resumes;
   * a rejection stops dispatch and propagates to the producer.
   */
  async emit(event: Event): Promise<void> {
    for (const handler of this.handlers) {
      await handler(event);
    }
  }
}

/**
 * Signal recorded task failures after successful siblings have been accepted.
 * createWorkflow catches this error to finalise partial work; observer errors
 * keep their original identity and propagate.
 */
export class WorkflowTaskFailure extends Error {}

/**
 * Normalise thrown values for failure records and validation feedback.
 */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Create a runner with run(tasks) and result(). Each batch runs in parallel
 * against one prior-results snapshot; singleton arrays give sequential steps.
 * Results are accepted in declaration order before tasksFinished is emitted.
 * A failed batch then throws WorkflowTaskFailure without losing its siblings.
 * Task names select result keys and constrain each task's return type.
 *
 * Tasks and observers must treat nested accepted values as immutable. Snapshot
 * container copies keep later acceptance from changing earlier snapshots.
 * Observer errors propagate directly; the runner does not retry tasks.
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

  /**
   * Copy the current result and failure containers without cloning task values.
   */
  function result(): WorkflowSnapshot<Results> {
    return { results: { ...accepted }, failures: [...failures] };
  }

  /**
   * Await a parallel batch, retaining successes before throwing task failure.
   * Singleton batches return the named result type in a one-element array.
   */
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

/**
 * The runner API passed to a workflow's explicit execute function.
 */
export type WorkflowSteps<Input, Results> = ReturnType<
  typeof createWorkflowRun<Input, Results>
>;
