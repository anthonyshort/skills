/**
 * Schedules GitHub delivery through the existing review helper. The workflow VM
 * delegates command execution and checks its saved receipt without owning a client.
 */
import { z } from "zod";
import { ReviewInputSchema } from "./contracts.js";
import type {
  Bundle,
  ReviewInput,
  ReviewResult,
  WorkflowHost,
} from "./contracts.js";
import { errorMessage } from "./text.js";

// Pi's restricted VM has no URL global for Zod's URL validator.
const githubUrl = z
  .string()
  .max(4096)
  .regex(/^https:\/\/github\.com\/[^\s]+$/);
export const PublicationResultSchema = z.strictObject({
  status: z.enum(["skipped", "pending", "confirmed", "uncertain", "rejected"]),
  reason: z.string().min(1),
  url: githubUrl.nullable(),
  approval: z
    .strictObject({
      status: z.enum(["approved", "withheld"]),
      reason: z.string(),
      url: githubUrl.nullable(),
    })
    .nullable(),
  statePath: z.string().nullable(),
  newerCommits: z.boolean(),
});
export type PublicationResult = z.infer<typeof PublicationResultSchema>;

export const GitHubRequestSchema = z.strictObject({
  input: ReviewInputSchema,
  operation: z.enum(["start", "update", "interrupt", "finish"]),
  id: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  checklist: z.string().min(1),
  reason: z.string(),
  fingerprint: z
    .string()
    .regex(/^[a-f0-9]{16}$/)
    .nullable(),
});
export type GitHubRequest = z.infer<typeof GitHubRequestSchema>;

/**
 * Serial workflow-owned updates share one helper state file. Delivery gets no
 * automatic retry: an unknown response must be recovered through the helper.
 */
export function createGitHubPublisher(host: WorkflowHost, input: ReviewInput) {
  const enabled =
    Boolean(input.github) &&
    !["local-only", "staged"].includes(input.publication);
  let result: PublicationResult = {
    status: enabled ? "pending" : "skipped",
    reason: !input.github
      ? "No pull request supplied"
      : enabled
        ? "Publication has not finished"
        : `${input.publication} output requested`,
    url: null,
    approval: null,
    statePath: enabled ? `${input.artifacts}/github.json` : null,
    newerCommits: false,
  };
  let sequence = 0;
  let checklist = "- [ ] Review\n- [ ] Publish results\n";

  async function deliver(
    operation: GitHubRequest["operation"],
    reason = "",
    fingerprint: string | null = null,
  ) {
    const request: GitHubRequest = {
      input,
      operation,
      id: `${input.invocationId}-${++sequence}`,
      checklist,
      reason,
      fingerprint,
    };
    const command = [
      "node",
      "--import",
      quote(input.tsxLoader),
      quote(`${input.supportRoot}/github.ts`),
      quote(JSON.stringify(request)),
    ].join(" ");
    try {
      const answer = await host.agent(
        [
          "Execute this exact review delivery command once. Do not modify accepted files or publish through any other tool.",
          operation === "finish"
            ? `Before publishing, refresh discussion and relevant CI as required by ${input.skillRoot}/criteria.md#step-6-publish-results. If new facts invalidate the accepted assessment, execute the command with --reject followed by one shell-quoted reason instead. This records refusal without publishing. Return its actual rejected result and request a refreshed assessment. Never change the saved decision to force publication.`
            : "Do not review source or change the assessment.",
          "Return the command's actual JSON result through StructuredOutput. If it fails or its outcome is unknown, report uncertain with the error and saved state path. Do not retry.",
          `State path: ${input.artifacts}/github.json`,
          `GitHub request: ${JSON.stringify(request)}`,
          command,
        ].join("\n"),
        {
          label: `github:${operation}:${sequence}`,
          phase: "Publication",
          schema: z.toJSONSchema(PublicationResultSchema, {
            target: "draft-7",
          }),
          gate: `${command} --check`,
        },
      );
      if (answer === null) {
        throw new Error(
          "GitHub worker failed or was skipped; delivery may have completed",
        );
      }
      result = PublicationResultSchema.parse(answer);
    } catch (error) {
      result = {
        ...result,
        status: "uncertain",
        reason: `${errorMessage(error)}. Inspect ${input.artifacts}/github.json before retrying publication.`,
      };
    }
  }

  return {
    get result() {
      return result;
    },
    async update(value: string, interruptedReason?: string): Promise<void> {
      if (!enabled) return;
      checklist = value;
      if (sequence === 0) await deliver("start");
      else
        await deliver(
          interruptedReason ? "interrupt" : "update",
          interruptedReason,
        );
    },
    async finish(
      bundle: Bundle,
      review: ReviewResult,
      validationCommand: string,
    ): Promise<PublicationResult> {
      if (!enabled) return result;
      if (bundle.status === "incomplete") {
        await deliver(
          "interrupt",
          bundle.failures
            .map((failure) => `${failure.stage}: ${failure.reason}`)
            .join("; "),
        );
        return result;
      }
      // The Node bridge independently repeats this gate immediately before finish.
      if (!validationCommand || !review.reportPath)
        throw new Error("Publication requires validated saved output");
      // The helper unchecks publication while sending and accepts this final row on success.
      checklist = checklist.replace(
        /^- \[[ x]\] publication: .+$/m,
        "- [x] publication: complete",
      );
      await deliver("finish", "", review.fingerprint);
      return result;
    },
  };
}

/**
 * Quotes one argument for the host's POSIX command runner.
 */
function quote(value: string): string {
  return "'" + value.replace(/'/g, "'\\''") + "'";
}
