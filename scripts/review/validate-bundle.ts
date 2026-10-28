#!/usr/bin/env node
/**
 * File-gate entry point used by the review workflow's artefact writer.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateBundle } from "../../src/review/validate.js";
import { errorMessage } from "../../src/review/text.js";

/**
 * Validate a writer's saved bundle against the fingerprint accepted by the VM.
 * The gate succeeds only when validation returns; errors produce a non-zero exit.
 */
export async function main(args = process.argv.slice(2)): Promise<void> {
  if (args.length !== 3 || args[1] !== "--fingerprint") {
    throw new Error("Usage: validate-bundle.ts BUNDLE --fingerprint VALUE");
  }
  const bundle = await validateBundle(args[0], args[2]);
  process.stdout.write(
    JSON.stringify({
      status: bundle.status,
      head: bundle.input.head,
      validated: true,
    }) + "\n",
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    process.stderr.write(
      `Review artefact validation failed: ${errorMessage(error)}\n`,
    );
    process.exitCode = 1;
  });
}
