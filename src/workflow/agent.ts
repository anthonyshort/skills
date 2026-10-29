/**
 * Call an agent with structured output validation and a finite retry budget.
 */
import * as z from "zod";
import { errorMessage } from "./run.js";

export async function callValidatedAgent<Result>({
  call,
  label,
  prompt,
  schema,
  maxAttempts,
  validate,
  onAttemptFailed,
}: {
  call: (
    prompt: string,
    options: { label: string; phase: string; schema: unknown },
  ) => Promise<unknown>;
  label: string;
  prompt: string;
  schema: z.ZodType<Result>;
  maxAttempts: number;
  validate?: (result: Result) => void;
  onAttemptFailed?: (failure: { attempt: number; reason: string }) => void;
}): Promise<Result> {
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1) {
    throw new RangeError("maxAttempts must be a positive integer");
  }
  const outputSchema = z.toJSONSchema(schema, { target: "draft-7" });
  let feedback = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const output = await call(
        [
          prompt,
          feedback
            ? `The prior attempt failed validation: ${feedback}. Make one fresh attempt.`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
        { label: `${label}:${attempt}`, phase: label, schema: outputSchema },
      );
      if (output === null) {
        throw new Error(
          "Agent failed, was skipped, or returned invalid structured output",
        );
      }
      const result = schema.parse(output);
      validate?.(result);
      return result;
    } catch (error) {
      feedback = errorMessage(error);
    }
    // Diagnostic observers do not consume the agent's retry budget.
    onAttemptFailed?.({ attempt, reason: feedback });
  }
  throw new Error(`${label} failed after ${maxAttempts} attempts: ${feedback}`);
}
