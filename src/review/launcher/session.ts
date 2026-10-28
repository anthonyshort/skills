import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import type { WriteStream } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { finished } from "node:stream/promises";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import type { ReviewInput } from "../contracts.js";
import { hasErrorCode } from "./inputs.js";

const CompletionSchema = z.object({
  name: z.literal("review-launcher"),
  status: z.enum(["completed", "failed", "killed"]),
});
const EntrySchema = z.object({
  type: z.string(),
  customType: z.string().optional(),
  data: z.unknown().optional(),
});
type Completion = z.infer<typeof CompletionSchema>;

export type SessionFiles = {
  workspace: string;
  bootstrap: string;
  sessionFile: string;
};
export type WaitOptions = {
  timeoutMs: number;
  signal?: AbortSignal;
  intervalMs?: number;
};
type ProcessStatus = {
  error(): Error | undefined;
  exitCode(): number | null;
  signalCode(): NodeJS.Signals | null;
};

export function bootstrapSource(inputs: ReviewInput): string {
  return `export const meta = { name: "review-launcher", description: "Run the packaged review workflow" };\nreturn await workflow("review", ${JSON.stringify(inputs)});\n`;
}

/**
 * Custom entries are persisted only after a conversation exists in Pi 1.4.
 */
export async function seedSession(file: string, cwd: string): Promise<void> {
  const timestamp = new Date().toISOString();
  const entries = [
    { type: "session", version: 3, id: randomUUID(), timestamp, cwd },
    {
      type: "message",
      id: randomUUID().slice(0, 8),
      parentId: null,
      timestamp,
      message: {
        role: "user",
        content: [
          {
            type: "text",
            text: "The saved review workflow runs at startup. No parent model turn is needed.",
          },
        ],
        timestamp: Date.now(),
      },
    },
  ];
  await writeFile(
    file,
    entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n",
    { flag: "wx", mode: 0o600 },
  );
}

/**
 * Require persisted workflow completion rather than a successful process exit.
 */
export async function waitForWorkflowEntry(
  sessionFile: string,
  processStatus: ProcessStatus,
  options: WaitOptions,
): Promise<Completion> {
  const deadline = Date.now() + options.timeoutMs;
  while (true) {
    if (options.signal?.aborted) {
      throw new Error("Review cancelled");
    }
    let content = "";
    try {
      content = await readFile(sessionFile, "utf8");
    } catch (error) {
      if (!hasErrorCode(error, "ENOENT")) {
        throw error;
      }
    }
    const lines = content.split("\n");
    lines.pop();
    for (const line of lines) {
      const entry = EntrySchema.parse(JSON.parse(line));
      if (
        entry.type !== "custom" ||
        entry.customType !== "subagents:workflow"
      ) {
        continue;
      }
      const completion = CompletionSchema.safeParse(entry.data);
      if (completion.success) {
        return completion.data;
      }
    }
    if (processStatus.error()) {
      throw new Error(
        "Could not start Pi; check the configured executable or output logs",
      );
    }
    if (
      processStatus.exitCode() !== null ||
      processStatus.signalCode() !== null
    ) {
      throw new Error(
        `Pi exited before a terminal workflow entry was saved (exit=${processStatus.exitCode()}, signal=${processStatus.signalCode()})`,
      );
    }
    if (Date.now() >= deadline) {
      throw new Error("Review workflow timed out");
    }
    await delay(
      Math.min(options.intervalMs ?? 100, Math.max(1, deadline - Date.now())),
    );
  }
}

/**
 * Own Pi, its process group and output streams behind one idempotent close.
 */
export async function startPiSession(
  inputs: ReviewInput,
  files: SessionFiles,
  profile: string,
  executable: string,
  env: NodeJS.ProcessEnv,
) {
  const argv = [
    "--mode",
    "rpc",
    "--session",
    files.sessionFile,
    "--no-context-files",
    "--no-mcp",
    "--offline",
    "--no-approve",
    "--no-prompt-templates",
    "--no-themes",
    `--subagents-workflow-file=${files.bootstrap}`,
  ];
  const child = spawn(executable, argv, {
    cwd: files.workspace,
    env: {
      ...env,
      PI_CODING_AGENT_DIR: profile,
      PI_OFFLINE: "1",
      PI_TELEMETRY: "0",
    },
    detached: process.platform !== "win32",
    stdio: ["pipe", "pipe", "pipe"],
  });
  let processError: Error | undefined;
  child.on("error", (error) => {
    processError = error;
  });
  const streams: WriteStream[] = [];
  let closePromise: Promise<void> | undefined;

  async function close(): Promise<void> {
    if (closePromise) {
      return closePromise;
    }
    closePromise = (async () => {
      try {
        await terminateProcessGroup(child);
      } finally {
        await closeOutputLogs(streams);
      }
    })();
    return closePromise;
  }

  try {
    for (const [name, source] of [
      ["stdout", child.stdout],
      ["stderr", child.stderr],
    ] satisfies [string, NodeJS.ReadableStream][]) {
      const log = createWriteStream(
        path.join(inputs.artifacts, `pi.${name}.log`),
        { flags: "wx", mode: 0o600 },
      );
      log.on("error", (error) => {
        processError = error;
      });
      source.pipe(log);
      streams.push(log);
    }
    return {
      wait: (options: WaitOptions) =>
        waitForWorkflowEntry(
          files.sessionFile,
          {
            error: () => processError,
            exitCode: () => child.exitCode,
            signalCode: () => child.signalCode,
          },
          options,
        ),
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}

export type PiSession = Awaited<ReturnType<typeof startPiSession>>;

async function terminateProcessGroup(
  child: ChildProcessWithoutNullStreams,
): Promise<void> {
  const pid = child.pid;
  if (!pid) {
    return;
  }
  const send = (signal: NodeJS.Signals) => {
    try {
      process.kill(process.platform === "win32" ? pid : -pid, signal);
    } catch (error) {
      if (!hasErrorCode(error, "ESRCH")) {
        throw error;
      }
    }
  };
  const closed = new Promise<void>((resolve) =>
    child.once("close", () => resolve()),
  );
  send("SIGTERM");
  for (
    let index = 0;
    index < 20 && child.exitCode === null && child.signalCode === null;
    index++
  ) {
    await delay(50);
  }
  send("SIGKILL");
  child.stdin.destroy();
  await Promise.race([closed, delay(1000)]);
}

async function closeOutputLogs(streams: WriteStream[]): Promise<void> {
  for (const stream of streams) {
    if (!stream.writableEnded) {
      stream.end();
    }
    await finished(stream).catch(() => {});
  }
}
