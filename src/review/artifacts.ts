import { z } from "zod";
import type { Bundle, ReviewInput, ReviewResult } from "./contracts.js";
import type { WorkflowHost } from "./host.js";
import { quote, supportCommand } from "./text.js";
type ReportStatus = (stage: string, status: string) => Promise<void>;

export async function saveArtifacts(
  host: WorkflowHost,
  input: ReviewInput,
  bundle: Bundle,
  result: ReviewResult,
  reportStatus: ReportStatus,
): Promise<string> {
  const serialized = JSON.stringify(bundle);
  const validationCommand = `${supportCommand(input, "validate-bundle")} ${quote(`${input.artifacts}/bundle.json`)} --fingerprint ${quote(result.fingerprint)}`;
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

export async function publishArtifacts(
  host: WorkflowHost,
  input: ReviewInput,
  result: ReviewResult,
  reportStatus: ReportStatus,
): Promise<void> {
  if (input.publication.mode !== "local") {
    await reportStatus("publication", "running");
    const publication = await host.agent(
      [
        "Publish only the accepted review artefacts using the supplied helper. Do not alter findings, approval, summary or report, and do not independently call GitHub APIs.",
        `Run exactly: ${supportCommand(input, "publication")} finish ${quote(`${input.artifacts}/bundle.json`)}`,
        "If the command fails, report failed with the actual reason. Do not retry or create another comment. Existing helper state is retained for explicit recovery.",
        "The helper validates saved artefacts and live head before publication. Report confirmed only when it verifies the remote result, rendered for a dry-run preview.",
      ].join("\n"),
      {
        label: "publication",
        phase: "Publication",
        schema: z.toJSONSchema(
          z.strictObject({
            status: z.enum(["confirmed", "rendered", "failed"]),
            reason: z.string().min(1),
          }),
          { target: "draft-7" },
        ),
        gate: `${supportCommand(input, "publication")} verify ${quote(`${input.artifacts}/bundle.json`)}`,
      },
    );
    if (
      publication === null ||
      z.object({ status: z.string() }).parse(publication).status === "failed"
    ) {
      await reportStatus("publication", "blocked");
      throw new Error(
        `Publication was not confirmed. Inspect ${input.artifacts}/progress.json and result.json before retrying.`,
      );
    }
    if (input.publication.mode !== "github") {
      await reportStatus("publication", "complete");
    }
    result.publication.status =
      input.publication.mode === "github" ? "confirmed" : "rendered";
  }
}
