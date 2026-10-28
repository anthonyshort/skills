import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execute = promisify(execFile);

export async function runCommand(
  program: string,
  arguments_: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  const result = await execute(program, [...arguments_], {
    encoding: "utf8",
    env: { ...env, PYTHONDONTWRITEBYTECODE: "1" },
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  return result.stdout;
}

export async function commandJson(
  program: string,
  arguments_: readonly string[],
  env?: NodeJS.ProcessEnv,
): Promise<unknown> {
  const value: unknown = JSON.parse(await runCommand(program, arguments_, env));
  return value;
}
