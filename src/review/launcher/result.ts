import { execFile } from "node:child_process";
import { readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { ReviewResultSchema } from "../contracts.js";
import type { ReviewInput, ReviewResult } from "../contracts.js";
import { within } from "./inputs.js";

const execute = promisify(execFile);
const publicationSuccess = {
  local: "not_requested",
  "dry-run": "rendered",
  github: "confirmed",
};

function capturedOutput(error: unknown, field: "stdout" | "stderr"): string {
  if (error instanceof Error && field in error) {
    const value: unknown = Reflect.get(error, field);
    if (typeof value === "string") {
      return value;
    }
    if (Buffer.isBuffer(value)) {
      return value.toString("utf8");
    }
  }
  return field === "stderr" ? "Validator failed" : "";
}

/**
 * Recheck identities and run the package validator without a shell.
 */
export async function validateReviewResult(
  inputs: ReviewInput,
  {
    env = process.env,
    signal,
  }: { env?: NodeJS.ProcessEnv; signal?: AbortSignal } = {},
): Promise<ReviewResult> {
  const parsed = ReviewResultSchema.safeParse(
    JSON.parse(
      await readFile(path.join(inputs.artifacts, "result.json"), "utf8"),
    ),
  );
  if (!parsed.success) {
    throw new Error("Saved review result has invalid structure");
  }
  const result = parsed.data;
  for (const key of [
    "runId",
    "invocationId",
    "base",
    "head",
  ] satisfies (keyof ReviewInput & keyof ReviewResult)[]) {
    if (result[key] !== inputs[key]) {
      throw new Error(`Saved result has a mismatched ${key}`);
    }
  }
  const bundlePath = path.join(inputs.artifacts, "bundle.json");
  if (
    result.bundlePath !== bundlePath ||
    (await realpath(bundlePath)) !== bundlePath
  ) {
    throw new Error("Saved result names an unexpected bundle");
  }
  if (result.status === "incomplete") {
    if (result.reportPath !== null) {
      throw new Error("Incomplete result must not claim a canonical report");
    }
  } else {
    if (!result.reportPath) {
      throw new Error("Complete result must name its canonical report");
    }
    const report = await realpath(result.reportPath);
    if (!within(inputs.artifacts, report)) {
      throw new Error("Saved report is outside the output directory");
    }
  }
  const validator = path.join(
    inputs.packageRoot,
    "scripts/review/validate-bundle.ts",
  );
  try {
    const { stdout, stderr } = await execute(
      process.execPath,
      [
        "--import",
        inputs.tsxLoader,
        validator,
        bundlePath,
        "--fingerprint",
        result.fingerprint,
      ],
      { env, signal, maxBuffer: 1024 * 1024, timeout: 30_000 },
    );
    await writeFile(
      path.join(inputs.artifacts, "validation.stdout.log"),
      stdout,
      { mode: 0o600 },
    );
    await writeFile(
      path.join(inputs.artifacts, "validation.stderr.log"),
      stderr,
      { mode: 0o600 },
    );
  } catch (error) {
    await writeFile(
      path.join(inputs.artifacts, "validation.stdout.log"),
      capturedOutput(error, "stdout"),
      { mode: 0o600 },
    );
    await writeFile(
      path.join(inputs.artifacts, "validation.stderr.log"),
      capturedOutput(error, "stderr"),
      { mode: 0o600 },
    );
    throw new Error(
      "Saved review bundle failed fresh validation; see validation.stderr.log",
    );
  }
  if (result.status === "incomplete") {
    throw new Error(`Review is incomplete; inspect ${inputs.artifacts}`);
  }
  if (
    result.publication.mode !== inputs.publication.mode ||
    result.publication.status !== publicationSuccess[inputs.publication.mode]
  ) {
    throw new Error("Required publication is not confirmed");
  }
  return result;
}
