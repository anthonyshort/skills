/**
 * Crosses from the filesystem-free workflow VM to an agent that saves files.
 * A successful agent answer is accepted only after its command gate passes.
 */
import { z } from "zod";
import type { Bundle, ReviewInput, ReviewResult } from "./contracts.js";
import type { WorkflowHost } from "./contracts.js";

type ReportStatus = (stage: string, status: string) => Promise<void>;

/**
 * Asks a writer to persist accepted values and validates the resulting files.
 * Throws on a failed gate; it never retries a writer with an unknown outcome.
 * The bundle captures receipts collected before writing; the final save receipt
 * is available only in the successful workflow return.
 */
export async function saveArtifacts(
  host: WorkflowHost,
  input: ReviewInput,
  bundle: Bundle,
  result: ReviewResult,
  reportStatus: ReportStatus,
): Promise<string> {
  const serialized = JSON.stringify(bundle);
  const validationCommand = `node --import ${shellQuote(input.tsxLoader)} ${shellQuote(`${input.supportRoot}/validate-bundle.ts`)} ${shellQuote(`${input.artifacts}/bundle.json`)} --fingerprint ${shellQuote(result.fingerprint)}`;
  host.phase("Save artefacts");
  const saved = await host.agent(
    [
      "You are the artefact writer. Do not review code, publish, notify, or call github_review_complete.",
      `Write the exact JSON bundle below to ${input.artifacts}/bundle.json.`,
      "For each stages entry, write its markdown unchanged to <stage>.md in that directory.",
      "Write review-report.md from stages.report.markdown, or stages['split-plan'].markdown for split output.",
      "For incomplete output write incomplete.md explaining failures. Do not fabricate missing assessments.",
      "If decision exists, write approval.json from decision.approval, summary.md from decision.summaryMarkdown and inline.json from decision.inlineComments. Preserve those values exactly.",
      `Write the exact result JSON below to ${input.artifacts}/result.json.`,
      JSON.stringify(result),
      "Use only read/write tools or filesystem commands. Write only under the supplied artefact directory.",
      serialized,
    ].join("\n"),
    {
      label: "save-artefacts",
      phase: "Save artefacts",
      gate: validationCommand,
      schema: z.toJSONSchema(z.strictObject({ saved: z.literal(true) }), {
        target: "draft-7",
      }),
    },
  );
  if (saved === null) {
    await reportStatus("save-artefacts", "blocked");
    throw new Error(
      `Artefact validation failed. Inspect ${input.artifacts}; review is incomplete.`,
    );
  }
  await reportStatus("save-artefacts", "complete");

  return validationCommand;
}

/**
 * Quotes one POSIX shell argument, including paths containing spaces or quotes.
 */
function shellQuote(value: string): string {
  return "'" + value.replace(/'/g, "'\\''") + "'";
}
