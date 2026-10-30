/**
 * Globals supplied by pi-subagents 0.22.0 to saved workflow scripts.
 * These declarations describe the official API subset used here. They provide
 * no implementation or adapter. See pi-subagents docs/workflows.md for the full API.
 */
declare const args: unknown;

declare function agent(
  prompt: string,
  options?: { label?: string; phase?: string; schema?: unknown },
): Promise<unknown>;
