/**
 * Globals supplied by pi-subagents 0.22.0 to saved workflow scripts.
 * These declarations describe the official API subset used here. They provide
 * no implementation or adapter. See the installed docs/workflows.md reference.
 */
declare const args: unknown;

declare function agent(
  prompt: string,
  options?: { label?: string; phase?: string; schema?: unknown; gate?: string },
): Promise<unknown>;

declare function parallel<T>(
  tasks: (() => Promise<T>)[],
): Promise<(T | null)[]>;

declare function phase(title: string): void;
