/**
 * Run the review in Pi's workflow VM. agent(), parallel() and phase() are
 * official pi-subagents globals, declared in pi-workflow.d.ts. The local
 * reviewAgent wrapper adds common rules, validation and one fresh retry.
 */
import * as z from "zod";
import setupPrompt from "./prompts/setup.md";
import researchPrompt from "./prompts/research.md";
import researchCheckPrompt from "./prompts/researchCheck.md";
import productPrompt from "./prompts/product.md";
import systemFitPrompt from "./prompts/systemFit.md";
import simplicityPrompt from "./prompts/simplicity.md";
import readabilityPrompt from "./prompts/readability.md";
import correctnessPrompt from "./prompts/correctness.md";
import rulesPrompt from "./prompts/rules.md";
import consolidationPrompt from "./prompts/consolidation.md";
import draftPrompt from "./prompts/draft.md";
import editorialPrompt from "./prompts/editorial.md";
import reportPrompt from "./prompts/report.md";
import splitPlanPrompt from "./prompts/splitPlan.md";
import decisionPrompt from "./prompts/decision.md";
import sharedRules from "./prompts/common.md";
import assessmentRules from "./prompts/assessment.md";
import reportingRules from "./prompts/reporting.md";
import reportTemplate from "../../skills/review/templates/review-report.md";
import githubProgressTemplate from "../../skills/review/templates/github-progress.md";
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
  GitHubRequest,
  ReviewAgentInput,
  ReviewEventInput,
  ReviewSnapshot,
  ReviewStepTask,
  ReviewWorkflowInput,
  ReviewRun,
  ReviewStepInput,
  ProgressUpdateInput,
  SaveArtifactsInput,
  ReviewResult,
  ReviewOutput,
  StageName,
  StageResult,
  StageResults,
} from "./contracts.js";
import { githubEnabled, sendGitHub, publishAcceptedReview } from "./github.js";
import { validateStage } from "./validation.js";
import {
  coverageMarkdown,
  fingerprint,
  errorMessage,
  quote,
  progressChecklist,
  reviewProgress,
  sendHostNotification,
  sendFinalNotification,
} from "./utils.js";

/**
 * Official Pi workflow metadata. The build copies this literal into the generated
 * script header so Pi can read it before executing the coordinator.
 */
export const meta = {
  name: "review",
  description:
    "Experimental pinned review with required assessments and validated artefacts",
};

/**
 * Coordinate review events and delivery. Review evidence belongs to
 * reviewWorkflow; saving and publication happen only after it returns.
 */
export async function runReviewWorkflow(args: unknown): Promise<ReviewOutput> {
  const input = parseReviewInput(args);
  const delivery: DeliveryState = {
    notifications: [],
    hostNotifications: true,
    githubSequence: 0,
  };
  const review = await reviewWorkflow({
    input,
    onEvent: (event) => handleReviewEvent({ input, state: delivery, event }),
  });
  let validationCommand: string | undefined;

  /**
   * Saving and publication have their own progress after reviewer work ends.
   * Failed setup still saves partial evidence without starting external delivery.
   */
  async function reportDelivery({
    stage,
    status,
    reason,
  }: Pick<ProgressUpdateInput, "stage" | "status" | "reason">) {
    if (!review.stages.setup) {
      return;
    }
    await updateProgress({
      input,
      state: delivery,
      statuses: {
        ...reviewProgress({
          ...review,
          saved: validationCommand !== undefined,
        }),
        [stage]: status,
      },
      stage,
      status,
      reason,
    });
  }

  // Capture pre-save receipts, then validate actual files before any publication.
  await reportDelivery({ stage: "save-artefacts", status: "running" });
  const bundle: Bundle = {
    version: 1,
    ...review,
    notifications: [...delivery.notifications],
  };
  const result = createReviewResult(bundle);
  phase("save-artefacts");
  try {
    validationCommand = await saveReviewFiles({ bundle, result });
  } catch (error) {
    await reportDelivery({
      stage: "save-artefacts",
      status: "blocked",
      reason: errorMessage(error),
    });
    throw error;
  }
  await reportDelivery({ stage: "save-artefacts", status: "complete" });

  // Delivery outcomes never change accepted review evidence or retry reviewers.
  if (review.stages.setup && review.status !== "incomplete") {
    await reportDelivery({ stage: "publication", status: "running" });
  }
  const publication = await publishAcceptedReview({
    input,
    state: delivery,
    bundle,
    result,
  });
  if (publication.status === "rejected" && review.status !== "incomplete") {
    await reportDelivery({
      stage: "publication",
      status: "blocked",
      reason: publication.reason,
    });
  }
  await sendFinalNotification({
    input,
    state: delivery,
    bundle,
    result,
    publication,
  });
  return {
    ...result,
    approval: review.stages.decision?.approval ?? null,
    publication,
    validationCommand,
    failures: review.failures,
    notifications: delivery.notifications,
  };
}

/**
 * Translate awaited lifecycle events into Pi display groups and external
 * progress. Transport helpers record delivery failures without throwing them
 * back into reviewer execution.
 */
async function handleReviewEvent({
  input,
  state,
  event,
}: ReviewEventInput): Promise<void> {
  let status: "running" | "complete" | "blocked";
  let reason: string | undefined;
  switch (event.type) {
    case "stepStarted":
      phase(event.step);
      status = "running";
      break;
    case "stepAccepted":
      status = "complete";
      break;
    case "stepFailed":
      status = "blocked";
      reason = event.reason;
      break;
  }
  if (!event.snapshot.stages.setup) {
    return;
  }
  await updateProgress({
    input,
    state,
    statuses: {
      ...reviewProgress({ ...event.snapshot, saved: false }),
      [event.step]: status,
    },
    stage: event.step,
    status,
    reason,
  });
}

/**
 * Execute the review sequence and retain accepted evidence. Awaited callbacks
 * report its lifecycle; this function does not notify, save or publish.
 */
async function reviewWorkflow({
  input,
  onEvent,
}: ReviewWorkflowInput): Promise<ReviewRun> {
  let accepted: StageResults = {};
  const attempts: Bundle["attempts"] = [];
  const failures: Bundle["failures"] = [];

  /**
   * Copy containers so later acceptances cannot change an earlier event's view.
   */
  function snapshot(): ReviewSnapshot {
    return { stages: { ...accepted }, failures: [...failures] };
  }

  /**
   * Accept a validated result in one place, preserving the per-stage wire shape.
   */
  function accept(result: StageResult): void {
    accepted = StageResultsSchema.parse({
      ...accepted,
      [result.stage]: result,
    });
  }

  /**
   * Run a named task between awaited lifecycle events. Only task failures are
   * recorded as review failures; callbacks are outside the worker retry loop.
   */
  async function runStep<Result extends StageResult | void>({
    step,
    run,
  }: ReviewStepTask<Result>): Promise<Result> {
    await onEvent({ type: "stepStarted", step, snapshot: snapshot() });
    let result: Result;
    try {
      result = await run({ input, context: { ...accepted }, attempts });
      if (result) {
        accept(result);
      }
    } catch (error) {
      const reason = errorMessage(error);
      failures.push({ stage: step, reason });
      await onEvent({ type: "stepFailed", step, reason, snapshot: snapshot() });
      throw error;
    }
    await onEvent({ type: "stepAccepted", step, snapshot: snapshot() });
    return result;
  }

  /**
   * All five assessments see one research snapshot. Preserve successful siblings
   * in question order before failing the barrier, which emits one lifecycle.
   */
  async function runAssessments({
    input,
    context,
    attempts,
  }: ReviewStepInput): Promise<void> {
    const results = await parallel<StageResult>([
      () => assessProduct({ input, context, attempts }),
      () => assessSystemFit({ input, context, attempts }),
      () => assessSimplicity({ input, context, attempts }),
      () => assessReadability({ input, context, attempts }),
      () => assessCorrectness({ input, context, attempts }),
    ]);
    // Pi returns null for failed parallel tasks instead of cancelling siblings.
    for (const result of results) {
      if (result) {
        accept(result);
      }
    }
    const missing = assessmentNames.filter((name) => !accepted[name]);
    if (missing.length) {
      throw new Error(`Missing assessments: ${missing.join(", ")}`);
    }
  }

  try {
    const setup = await runStep({ step: "setup", run: setupReview });
    switch (setup.mode) {
      case "split":
        // Oversized reviews produce a split plan without full assessments.
        await runStep({ step: "splitPlan", run: planSplit });
        break;
      case "full":
        // Check research before the parallel barrier; reconcile before reporting.
        await runStep({ step: "research", run: researchReview });
        await runStep({ step: "researchCheck", run: checkResearch });
        await runStep({ step: "assessments", run: runAssessments });
        await runStep({ step: "rules", run: checkRules });
        await runStep({ step: "consolidation", run: consolidateReview });
        await runStep({ step: "draft", run: draftReport });
        await runStep({ step: "editorial", run: editReport });
        await runStep({ step: "report", run: acceptReport });
        break;
    }
    await runStep({ step: "decision", run: decideReview });
  } catch (error) {
    // Recorded task failures stop dependent work and return partial evidence.
    // Unexpected observer failures propagate instead of claiming completion.
    if (failures.length === 0) {
      throw error;
    }
  }

  const status = failures.length
    ? "incomplete"
    : accepted.setup?.mode === "split"
      ? "split"
      : "complete";
  if (status === "complete" && accepted.report) {
    accepted = {
      ...accepted,
      report: {
        ...accepted.report,
        markdown: accepted.report.markdown + coverageMarkdown(accepted),
      },
    };
  }
  return { input, status, stages: accepted, failures, attempts };
}

/**
 * Establish the pinned scope, review depth and rule inventory.
 */
async function setupReview({ input, context, attempts }: ReviewStepInput) {
  return reviewAgent({
    input,
    context,
    attempts,
    label: "setup",
    schema: StageSchemas.setup,
    prompt: setupPrompt,
  });
}

/**
 * Gather sourced context or validate usable earlier research.
 */
async function researchReview({ input, context, attempts }: ReviewStepInput) {
  return reviewAgent({
    input,
    context,
    attempts,
    label: "research",
    schema: StageSchemas.research,
    prompt: researchPrompt,
  });
}

/**
 * Independently check the brief before assessments use it.
 */
async function checkResearch({ input, context, attempts }: ReviewStepInput) {
  return reviewAgent({
    input,
    context,
    attempts,
    label: "researchCheck",
    schema: StageSchemas.researchCheck,
    prompt: researchCheckPrompt,
  });
}

/**
 * Assess the user problem and supported product alternatives.
 */
async function assessProduct({ input, context, attempts }: ReviewStepInput) {
  return reviewAgent({
    input,
    context,
    attempts,
    label: "product",
    schema: StageSchemas.product,
    prompt: [assessmentRules, productPrompt].join("\n\n"),
  });
}

/**
 * Assess ownership, dependencies and architectural fit.
 */
async function assessSystemFit({ input, context, attempts }: ReviewStepInput) {
  return reviewAgent({
    input,
    context,
    attempts,
    label: "systemFit",
    schema: StageSchemas.systemFit,
    prompt: [assessmentRules, systemFitPrompt].join("\n\n"),
  });
}

/**
 * Assess the amount of implementation and scope needed.
 */
async function assessSimplicity({ input, context, attempts }: ReviewStepInput) {
  return reviewAgent({
    input,
    context,
    attempts,
    label: "simplicity",
    schema: StageSchemas.simplicity,
    prompt: [assessmentRules, simplicityPrompt].join("\n\n"),
  });
}

/**
 * Inspect changed bodies and tests for reading difficulties.
 */
async function assessReadability({
  input,
  context,
  attempts,
}: ReviewStepInput) {
  return reviewAgent({
    input,
    context,
    attempts,
    label: "readability",
    schema: StageSchemas.readability,
    prompt: [assessmentRules, readabilityPrompt].join("\n\n"),
  });
}

/**
 * Trace behaviour, callers, tests and available CI evidence.
 */
async function assessCorrectness({
  input,
  context,
  attempts,
}: ReviewStepInput) {
  return reviewAgent({
    input,
    context,
    attempts,
    label: "correctness",
    schema: StageSchemas.correctness,
    prompt: [assessmentRules, correctnessPrompt].join("\n\n"),
  });
}

/**
 * Account for every indexed rule in one sequential pass.
 */
async function checkRules({ input, context, attempts }: ReviewStepInput) {
  return reviewAgent({
    input,
    context,
    attempts,
    label: "rules",
    schema: StageSchemas.rules,
    prompt: rulesPrompt,
  });
}

/**
 * Verify claims, resolve disagreements and merge findings.
 */
async function consolidateReview({
  input,
  context,
  attempts,
}: ReviewStepInput) {
  return reviewAgent({
    input,
    context,
    attempts,
    label: "consolidation",
    schema: StageSchemas.consolidation,
    prompt: [reportingRules, consolidationPrompt].join("\n\n"),
  });
}

/**
 * Write the complete report from accepted review evidence.
 */
async function draftReport({ input, context, attempts }: ReviewStepInput) {
  return reviewAgent({
    input,
    context,
    attempts,
    label: "draft",
    schema: StageSchemas.draft,
    prompt: [reportingRules, draftPrompt, reportTemplate].join("\n\n"),
  });
}

/**
 * Shorten the draft while preserving evidence and findings.
 */
async function editReport({ input, context, attempts }: ReviewStepInput) {
  return reviewAgent({
    input,
    context,
    attempts,
    label: "editorial",
    schema: StageSchemas.editorial,
    prompt: [reportingRules, editorialPrompt, reportTemplate].join("\n\n"),
  });
}

/**
 * Compare the edit and draft, restore detail and accept the report.
 */
async function acceptReport({ input, context, attempts }: ReviewStepInput) {
  return reviewAgent({
    input,
    context,
    attempts,
    label: "report",
    schema: StageSchemas.report,
    prompt: [reportingRules, reportPrompt, reportTemplate].join("\n\n"),
  });
}

/**
 * Propose useful review boundaries without a full implementation review.
 */
async function planSplit({ input, context, attempts }: ReviewStepInput) {
  return reviewAgent({
    input,
    context,
    attempts,
    label: "splitPlan",
    schema: StageSchemas.splitPlan,
    prompt: splitPlanPrompt,
  });
}

/**
 * Assess approval and prepare publication material without submitting it.
 */
async function decideReview({ input, context, attempts }: ReviewStepInput) {
  return reviewAgent({
    input,
    context,
    attempts,
    label: "decision",
    schema: StageSchemas.decision,
    prompt: [decisionPrompt, githubProgressTemplate].join("\n\n"),
  });
}

/**
 * Our small wrapper around Pi's agent API. The caller supplies the prompt,
 * label and schema. Shared rules and revisions apply to every review worker;
 * invalid answers get one fresh retry. This function does not schedule steps,
 * update progress or accept evidence. Labels identify Pi workers and retry
 * diagnostics; the coordinator selects display groups from lifecycle events.
 */
async function reviewAgent<Result extends StageResult>({
  input,
  context,
  attempts,
  label,
  schema,
  prompt,
}: ReviewAgentInput<Result>): Promise<Result> {
  // Every review worker gets these rules before its task-specific prompt.
  const commonRules = [
    sharedRules,
    `Wrapper guidance: ${JSON.stringify(input.wrapperSkillRoots.map((root) => `${root}/SKILL.md`))}.`,
    `Read supplied scope and requirements files: ${JSON.stringify(input.contextFiles)}. Record unavailable external context rather than inventing sources.`,
    `Pinned inputs: ${JSON.stringify(input)}`,
    `Prior accepted results: ${JSON.stringify(context)}`,
  ].join("\n");
  const outputSchema = z.toJSONSchema(schema, { target: "draft-7" });
  let feedback = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const output = await agent(
        [
          commonRules,
          prompt,
          feedback
            ? `The prior attempt failed validation: ${feedback}. Make one fresh attempt.`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
        {
          label: `${label}:${attempt}`,
          schema: {
            ...outputSchema,
            properties: {
              ...outputSchema.properties,
              base: { type: "string", const: input.base },
              head: { type: "string", const: input.head },
            },
          },
        },
      );
      if (output === null) {
        throw new Error(
          "Agent failed, was skipped, or returned invalid structured output",
        );
      }
      const result = schema.parse(output);
      validateStage({ result, prior: context, input });
      return result;
    } catch (error) {
      feedback = errorMessage(error);
      attempts.push({ stage: label, attempt, reason: feedback });
    }
  }
  throw new Error(`${label} failed after two attempts: ${feedback}`);
}

/**
 * Save accepted review data (bundle.json), readable stage reports and the final
 * report, decision payloads and result index. The workflow VM has no filesystem
 * API, so a tool-equipped worker copies these values without reviewing them.
 * Its command gate checks the actual files before publication. Do not retry a
 * writer whose filesystem work may already have completed.
 */
async function saveReviewFiles({
  bundle,
  result,
}: SaveArtifactsInput): Promise<string> {
  const { input } = bundle;
  const validationCommand = `node --import ${quote(input.tsxLoader)} ${quote(`${input.supportRoot}/validate-bundle.ts`)} ${quote(`${input.artifacts}/bundle.json`)} --fingerprint ${quote(result.fingerprint)}`;

  // This worker writes accepted values; the command gate checks the actual files.
  const saved = await agent(
    [
      "You save accepted review files using host filesystem tools, which the workflow VM cannot access directly. Do not review code, publish, notify, or call github_review_complete.",
      "The bundle contains pinned inputs, accepted stage answers, failures, retry records and notification receipts. Copy its values exactly; do not infer or revise evidence.",
      `Write the exact JSON bundle below to ${input.artifacts}/bundle.json.`,
      "For each stages entry, write its markdown unchanged to <stage>.md in that directory.",
      "Write review-report.md from stages.report.markdown, or stages.splitPlan.markdown for split output.",
      "For incomplete output write incomplete.md explaining failures. Do not fabricate missing assessments.",
      "If decision exists, write approval.json from decision.approval, summary.md from decision.summaryMarkdown and inline.json from decision.inlineComments. Preserve those values exactly.",
      `Write the exact result JSON below to ${input.artifacts}/result.json.`,
      JSON.stringify(result),
      "Use only read/write tools or filesystem commands. Write only under the supplied artefact directory.",
      JSON.stringify(bundle),
    ].join("\n"),
    {
      label: "save-artefacts",
      gate: validationCommand,
      schema: z.toJSONSchema(SavedArtifactsSchema, { target: "draft-7" }),
    },
  );
  if (saved === null) {
    throw new Error(
      `Artefact validation failed. Inspect ${input.artifacts}; review is incomplete.`,
    );
  }
  return validationCommand;
}

/**
 * Describe structural completion and validated local file locations separately
 * from the later publication result and notification receipts.
 */
function createReviewResult(bundle: Bundle): ReviewResult {
  const { input, status, stages } = bundle;

  // Missing-stage diagnostics follow the route selected during setup.
  const required: readonly StageName[] =
    stages.setup?.mode === "split"
      ? ["setup", "splitPlan", "decision"]
      : stageNames.filter((name) => name !== "splitPlan");
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
 * Send a derived progress snapshot to GitHub and the host notification tool.
 * Delivery failures do not repeat review work or replace final publication.
 */
async function updateProgress({
  input,
  state,
  statuses,
  stage,
  status,
  reason,
}: ProgressUpdateInput): Promise<void> {
  if (githubEnabled(input)) {
    const blocked = Object.entries(statuses).find(
      ([, value]) => value === "blocked",
    );
    let operation: GitHubRequest["operation"] = "update";
    if (state.githubSequence === 0) {
      operation = "start";
    } else if (blocked) {
      operation = "interrupt";
    }
    await sendGitHub({
      input,
      state,
      operation,
      checklist: progressChecklist(statuses),
      reason: blocked ? (reason ?? `${blocked[0]} is blocked`) : "",
    });
  }
  await sendHostNotification({ input, state, statuses, stage, status, reason });
}
