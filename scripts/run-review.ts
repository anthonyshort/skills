#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArguments, usage } from "../src/review/launcher/arguments.js";
import { runReview } from "../src/review/launcher/run.js";

export { parseArguments, usage } from "../src/review/launcher/arguments.js";
export { resolveReviewInputs } from "../src/review/launcher/inputs.js";
export { createPrivateProfile } from "../src/review/launcher/profile.js";
export {
  bootstrapSource,
  waitForWorkflowEntry,
} from "../src/review/launcher/session.js";
export { validateReviewResult } from "../src/review/launcher/result.js";
export { runReview } from "../src/review/launcher/run.js";

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const options = parseArguments(argv);
  if ("help" in options) {
    process.stdout.write(usage);
    return;
  }
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.on("SIGINT", cancel);
  process.on("SIGTERM", cancel);
  try {
    const result = await runReview(options, { signal: controller.signal });
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } finally {
    process.off("SIGINT", cancel);
    process.off("SIGTERM", cancel);
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `Review failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
