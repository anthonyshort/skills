#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { parseReviewInput } from "../../src/review/contracts.js";
import { createPublisher } from "../../src/review/support/publisher.js";
import { message } from "../../src/review/text.js";

export async function main(args = process.argv.slice(2)): Promise<void> {
  const publisher = createPublisher();
  const [operation, ...rest] = args;
  if (operation === "progress") {
    if (rest.length !== 4 || rest[0] !== "--input" || rest[2] !== "--states") {
      throw new Error(
        "Usage: publication.ts progress --input JSON --states JSON",
      );
    }
    const inputValue: unknown = JSON.parse(rest[1]);
    const statesValue: unknown = JSON.parse(rest[3]);
    const states = z
      .record(z.string().min(1), z.string().min(1))
      .refine((value) => Object.keys(value).length <= 1000)
      .parse(statesValue);
    process.stdout.write(
      JSON.stringify(
        await publisher.progress(parseReviewInput(inputValue), states),
      ) + "\n",
    );
  } else if (
    (operation === "finish" || operation === "verify") &&
    rest.length === 1
  ) {
    process.stdout.write(
      JSON.stringify(await publisher[operation](rest[0])) + "\n",
    );
  } else {
    throw new Error(
      "Usage: publication.ts finish|verify BUNDLE or progress --input JSON --states JSON",
    );
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    process.stderr.write(
      `Review publication not confirmed: ${message(error)}\n`,
    );
    process.exitCode = 1;
  });
}
