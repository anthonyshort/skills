/**
 * Validate caller input and resolve defaults before any review worker starts.
 */
import * as z from "zod";

/**
 * Absolute caller paths passed to workers for read-only repository inspection.
 */
const path = z.string().startsWith("/");

/**
 * Full commit identifiers used to pin every worker to the same review scope.
 */
const revision = z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/);

/**
 * Caller configuration parsed before plugin setup. The transform supplies
 * skillRoot and notification defaults from the validated packageRoot and runId.
 */
const inputSchema = z
  .strictObject({
    packageRoot: path,
    repository: path,
    target: z.string().min(1),
    base: revision,
    head: revision,
    skillRoot: path.optional(),
    runId: z.string().min(1).max(100),
    wrapperSkillRoots: z.array(path).max(20).default([]),
    contextFiles: z.array(path).max(20).default([]),
    github: z
      .strictObject({
        repository: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
        pr: z.number().int().positive(),
      })
      .nullable()
      .default(null),
    publication: z
      .enum(["publish", "local-only", "comment-only"])
      .default("publish"),
    notification: z
      .strictObject({ messageKey: z.string().min(1).max(200) })
      .nullable()
      .optional(),
  })
  .transform(({ skillRoot, notification, ...input }) => ({
    ...input,
    skillRoot: skillRoot ?? `${input.packageRoot}/skills/review`,
    notification:
      notification === undefined
        ? { messageKey: `review:${input.runId}` }
        : notification,
  }));

export type ReviewInput = z.infer<typeof inputSchema>;

/**
 * Parse once, then derive the skill location and notification key from validated
 * sibling fields. Explicit null disables notifications instead of using a key.
 */
export function parseReviewInput(value: unknown): ReviewInput {
  return inputSchema.parse(value);
}
