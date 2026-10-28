#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateBundle } from "../../src/review/support/validate.js";
import { message } from "../../src/review/text.js";

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
      remotePublicationVerified: false,
    }) + "\n",
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    process.stderr.write(
      `Review artefact validation failed: ${message(error)}\n`,
    );
    process.exitCode = 1;
  });
}
