/**
 * Run the review in Pi's workflow VM. agent(), parallel() and phase() are
 * official pi-subagents globals, declared in pi-workflow.d.ts. The local
 * reviewStage helper adds our bounded retry and evidence validation policy.
 */
import { z } from "zod";
import {
  assessmentNames,
  parseReviewInput,
  SavedArtifactsSchema,
  stageNames,
  StageSchemas,
  StageResultsSchema,
} from "./contracts.js";
import type {
  Bundle,
  DeliveryState,
  ReviewResult,
  ReviewOutput,
  StageName,
  StageResult,
  StageResults,
} from "./contracts.js";
import {
  initialPublication,
  publishAcceptedReview,
  sendFinalNotification,
  startProgress,
  updateProgress,
} from "./delivery.js";
import {
  stageDefinitions,
  stageJsonSchema,
  stagePrompt,
  validateStage,
} from "./stages.js";
import { coverageMarkdown, fingerprint, errorMessage } from "./text.js";

/**
 * Require the review stages before saving and publishing their accepted output.
 * An exhausted review stage retains partial evidence. Saving and delivery never
 * run inside the assessment retry loop.
 */
export async function runReviewWorkflow(args: unknown): Promise<ReviewOutput> {
  const input = parseReviewInput(args);
  let accepted: StageResults = {};
  const attempts: Bundle["attempts"] = [];
  const failures: Bundle["failures"] = [];
  let activeStage = "setup";
  const delivery: DeliveryState = {
    statuses: {},
    notifications: [],
    started: false,
    hostNotifications: true,
    githubSequence: 0,
    publication: initialPublication(input),
  };

  try {
    await reviewStage("setup");
    await startProgress(input, delivery, accepted.setup?.mode ?? "full");
    if (accepted.setup?.mode === "split") {
      await reviewStage("split-plan");
    } else {
      await reviewStage("research");
      await reviewStage("research-check");

      activeStage = "assessments";
      phase("Assessments");
      await updateProgress(input, delivery, "assessments", "running");
      // Siblings see the same research, never each other's developing answers.
      const research = {
        setup: accepted.setup,
        research: accepted.research,
        "research-check": accepted["research-check"],
      };
      const assessments = await parallel(
        assessmentNames.map((name) => () => reviewStage(name, research)),
      );
      // Accept all successful siblings in question order before rejecting gaps.
      for (const result of assessments) {
        if (result)
          accepted = StageResultsSchema.parse({
            ...accepted,
            [result.stage]: result,
          });
      }
      const missing = assessmentNames.filter((name) => !accepted[name]);
      if (missing.length)
        throw new Error(`Missing assessments: ${missing.join(", ")}`);
      await updateProgress(input, delivery, "assessments", "complete");

      await reviewStage("rules");
      await reviewStage("consolidation");
      await reviewStage("draft");
      await reviewStage("editorial");
      await reviewStage("report");
    }
    await reviewStage("decision");
  } catch (error) {
    failures.push({ stage: activeStage, reason: errorMessage(error) });
    await updateProgress(input, delivery, activeStage, "blocked");
  }

  const status = failures.length
    ? "incomplete"
    : accepted.setup?.mode === "split"
      ? "split"
      : "complete";
  if (status === "complete" && accepted.report)
    accepted.report.markdown += coverageMarkdown(accepted);
  await updateProgress(input, delivery, "save-artefacts", "running");
  const bundle: Bundle = {
    version: 1,
    input,
    status,
    stages: accepted,
    failures,
    attempts,
    notifications: [...delivery.notifications],
  };
  const result = createReviewResult(bundle);
  let validationCommand: string;
  try {
    phase("Save artefacts");
    validationCommand = await saveArtifacts(bundle, result);
  } catch (error) {
    await updateProgress(
      input,
      delivery,
      "save-artefacts",
      "blocked",
      errorMessage(error),
    );
    throw error;
  }
  await updateProgress(input, delivery, "save-artefacts", "complete");
  const publication = await publishAcceptedReview(
    input,
    delivery,
    bundle,
    result,
  );
  await sendFinalNotification(input, delivery, bundle, result);
  return {
    ...result,
    approval: accepted.decision?.approval ?? null,
    publication,
    validationCommand,
    failures,
    notifications: delivery.notifications,
  };

  /**
   * One local helper calls Pi's agent API, validates the answer, then accepts it.
   * Parallel assessments leave ambient phase and progress ownership at the barrier.
   */
  async function reviewStage(
    name: StageName,
    context = accepted,
  ): Promise<StageResult> {
    const definition = stageDefinitions[name];
    const assessment = assessmentNames.some((candidate) => candidate === name);
    if (!assessment) {
      activeStage = name;
      phase(definition.group);
      await updateProgress(input, delivery, name, "running");
    }
    let feedback = "";
    let result: StageResult | undefined;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const output = await agent(
          stagePrompt(input, name, context, feedback),
          {
            label: `${name}:${attempt}`,
            phase: definition.group,
            schema: stageJsonSchema(name, input),
          },
        );
        if (output === null)
          throw new Error(
            "Agent failed, was skipped, or returned invalid structured output",
          );
        result = StageSchemas[name].parse(output);
        validateStage(result, context, input);
        break;
      } catch (error) {
        result = undefined;
        feedback = errorMessage(error);
        attempts.push({ stage: name, attempt, reason: feedback });
        if (!assessment && attempt === 1)
          await updateProgress(input, delivery, name, "retrying");
      }
    }
    if (!result)
      throw new Error(`${name} failed after two attempts: ${feedback}`);
    if (!assessment) {
      accepted = StageResultsSchema.parse({ ...accepted, [name]: result });
      await updateProgress(input, delivery, name, "complete");
    }
    return result;
  }
}

/**
 * The official agent gate checks actual files before the writer is accepted.
 * Do not retry a writer whose filesystem work may already have completed.
 */
async function saveArtifacts(
  bundle: Bundle,
  result: ReviewResult,
): Promise<string> {
  const { input } = bundle;
  const validationCommand = `node --import ${quote(input.tsxLoader)} ${quote(`${input.supportRoot}/validate-bundle.ts`)} ${quote(`${input.artifacts}/bundle.json`)} --fingerprint ${quote(result.fingerprint)}`;
  const saved = await agent(
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
      JSON.stringify(bundle),
    ].join("\n"),
    {
      label: "save-artefacts",
      phase: "Save artefacts",
      gate: validationCommand,
      schema: z.toJSONSchema(SavedArtifactsSchema, { target: "draft-7" }),
    },
  );
  if (saved === null)
    throw new Error(
      `Artefact validation failed. Inspect ${input.artifacts}; review is incomplete.`,
    );
  return validationCommand;
}

/**
 * Describe structural completion and validated local file locations separately
 * from the later publication result and notification receipts.
 */
function createReviewResult(bundle: Bundle): ReviewResult {
  const { input, status, stages } = bundle;
  const required: readonly StageName[] =
    stages.setup?.mode === "split"
      ? ["setup", "split-plan", "decision"]
      : stageNames.filter((name) => name !== "split-plan");
  return {
    status,
    runId: input.runId,
    invocationId: input.invocationId,
    base: input.base,
    head: input.head,
    bundlePath: `${input.artifacts}/bundle.json`,
    reportPath:
      status === "incomplete" ? null : `${input.artifacts}/review-report.md`,
    fingerprint: fingerprint(JSON.stringify(bundle)),
    missingStages: required.filter((name) => !stages[name]),
    coverageGaps: Object.entries(stages).flatMap(([stage, value]) =>
      value.gaps.map((reason) => ({ stage, reason })),
    ),
  };
}

/**
 * Quote a POSIX argument, including paths containing spaces or apostrophes.
 */
function quote(value: string): string {
  return "'" + value.replace(/'/g, "'\\''") + "'";
}
