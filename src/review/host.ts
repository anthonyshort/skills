export type WorkflowHost = {
  agent(
    prompt: string,
    options: { label: string; phase: string; schema: unknown; gate?: string },
  ): Promise<unknown>;
  parallel<T>(tasks: (() => Promise<T>)[]): Promise<(T | null)[]>;
  phase(name: string): void;
  log(message: string): void;
};
