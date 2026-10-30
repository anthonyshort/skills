/**
 * Check validation and retry bounds through the injected agent-call boundary.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import * as z from "zod";
import { callValidatedAgent } from "./agent.js";

describe("callValidatedAgent", () => {
  test("retries validation failures with feedback", async () => {
    const prompts: string[] = [];
    const labels: string[] = [];
    const failures: { attempt: number; reason: string }[] = [];
    const result = await callValidatedAgent({
      call: async (prompt, options) => {
        prompts.push(prompt);
        labels.push(options.label);
        return { count: prompts.length === 1 ? 0 : 3 };
      },
      label: "count",
      prompt: "Count the items.",
      outputSchema: z.strictObject({ count: z.number() }),
      maxAttempts: 2,
      validate: ({ count }) => {
        if (count <= 0) {
          throw new Error("Count must be positive");
        }
      },
      onAttemptFailed: (failure) => {
        failures.push(failure);
      },
    });
    assert.deepEqual(result, { count: 3 });
    assert.deepEqual(labels, ["count:1", "count:2"]);
    assert.match(prompts[1], /Count must be positive/);
    assert.deepEqual(failures, [
      { attempt: 1, reason: "Count must be positive" },
    ]);
  });

  test("stops after the configured attempts", async () => {
    let calls = 0;
    const attempts: number[] = [];
    await assert.rejects(
      callValidatedAgent({
        call: async () => {
          calls++;
          return { count: "invalid" };
        },
        label: "count",
        prompt: "Count the items.",
        outputSchema: z.strictObject({ count: z.number() }),
        maxAttempts: 2,
        onAttemptFailed: ({ attempt }) => {
          attempts.push(attempt);
        },
      }),
      /count failed after 2 attempts/,
    );
    assert.equal(calls, 2);
    assert.deepEqual(attempts, [1, 2]);
  });

  test("propagates diagnostic errors without retrying", async () => {
    let calls = 0;
    const observerError = new Error("Diagnostic failed");
    await assert.rejects(
      callValidatedAgent({
        call: async () => {
          calls++;
          return null;
        },
        label: "count",
        prompt: "Count the items.",
        outputSchema: z.number(),
        maxAttempts: 2,
        onAttemptFailed: () => {
          throw observerError;
        },
      }),
      (error) => error === observerError,
    );
    assert.equal(calls, 1);
  });
});
