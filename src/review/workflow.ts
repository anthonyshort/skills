/**
 * Run the review in Pi's workflow VM. agent() and parallel() are official
 * pi-subagents globals, declared in pi-workflow.d.ts. The local
 * reviewAgent wrapper adds common rules, validation and one fresh retry.
 */
import * as z from "zod";
import setupPrompt from "../../skills/review-workflow/prompts/setup.md";
import researchPrompt from "../../skills/review-workflow/prompts/research.md";
import researchCheckPrompt from "../../skills/review-workflow/prompts/researchCheck.md";
import productPrompt from "../../skills/review-workflow/prompts/product.md";
import systemFitPrompt from "../../skills/review-workflow/prompts/systemFit.md";
import simplicityPrompt from "../../skills/review-workflow/prompts/simplicity.md";
import readabilityPrompt from "../../skills/review-workflow/prompts/readability.md";
import correctnessPrompt from "../../skills/review-workflow/prompts/correctness.md";
import rulesPrompt from "../../skills/review-workflow/prompts/rules.md";
import consolidationPrompt from "../../skills/review-workflow/prompts/consolidation.md";
import draftPrompt from "../../skills/review-workflow/prompts/draft.md";
import editorialPrompt from "../../skills/review-workflow/prompts/editorial.md";
import reportPrompt from "../../skills/review-workflow/prompts/report.md";
import splitPlanPrompt from "../../skills/review-workflow/prompts/splitPlan.md";
import decisionPrompt from "../../skills/review-workflow/prompts/decision.md";
import sharedRules from "../../skills/review-workflow/prompts/common.md";
import assessmentRules from "../../skills/review-workflow/prompts/assessment.md";
import reportingRules from "../../skills/review-workflow/prompts/reporting.md";
import reportTemplate from "../../skills/review-workflow/templates/review-report.md";
import githubProgressTemplate from "../../skills/review-workflow/templates/github-progress.md";
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
  ReviewStepInput,
  ProgressUpdateInput,
  SaveArtifactsInput,
  ReviewResult,
  ReviewOutput,
  StageName,
  StageResult,
  StageResults,
} from "./contracts.js";
import {
  initialPublication,
  githubEnabled,
  sendGitHub,
  publishAcceptedReview,
} from "./github.js";
import { validateStage } from "./validation.js";
import {
  coverageMarkdown,
  fingerprint,
  errorMessage,
  quote,
  progressChecklist,
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
  phases: [
    { title: "Setup" },
    { title: "Research" },
    { title: "Assessments" },
    { title: "Rules" },
    { title: "Consolidation" },
    { title: "Reporting" },
    { title: "Decision" },
    { title: "Save artefacts" },
    { title: "Progress" },
    { title: "Publication" },
  ],
};

/**
 * Execute the required review steps explicitly. Each named step owns its prompt
 * import and schema; only the shared reviewAgent wrapper adds rules and retries.
 */
export async function runReviewWorkflow(args: unknown): Promise<ReviewOutput> {
  const input = parseReviewInput(args);
  let accepted: StageResults = {};
  const attempts: Bundle["attempts"] = [];
  const failures: Bundle["failures"] = [];
  let currentStep: StageName | "assessments" = "setup";
  const delivery: DeliveryState = {
    statuses: {},
    notifications: [],
    started: false,
    hostNotifications: true,
    githubSequence: 0,
    publication: initialPublication(input),
  };
  const progress = { input, state: delivery };

  /**
   * Use the same current step for progress and failure diagnostics.
   */
  async function startStep({ stage }: { stage: StageName | "assessments" }) {
    currentStep = stage;
    await updateProgress({ ...progress, stage, status: "running" });
  }

  // Setup pins the comparison before any external progress starts.
  try {
    accepted.setup = await setupReview({ input, context: accepted, attempts });
    delivery.started = true;
    await updateProgress({
      ...progress,
      stage: "setup",
      status: "complete",
    });

    switch (accepted.setup.mode) {
      case "split":
        // Split-only reviews stop at a plan rather than a full assessment.
        await startStep({ stage: "splitPlan" });
        accepted.splitPlan = await planSplit({
          input,
          context: accepted,
          attempts,
        });
        await updateProgress({
          ...progress,
          stage: "splitPlan",
          status: "complete",
        });
        break;
      case "full": {
        // Independently check the brief before any assessment uses its conclusions.
        await startStep({ stage: "research" });
        accepted.research = await researchReview({
          input,
          context: accepted,
          attempts,
        });
        await updateProgress({
          ...progress,
          stage: "research",
          status: "complete",
        });
        await startStep({ stage: "researchCheck" });
        accepted.researchCheck = await checkResearch({
          input,
          context: accepted,
          attempts,
        });
        await updateProgress({
          ...progress,
          stage: "researchCheck",
          status: "complete",
        });

        // All five workers see the same research, never developing sibling answers.
        await startStep({ stage: "assessments" });
        const researchContext = {
          setup: accepted.setup,
          research: accepted.research,
          researchCheck: accepted.researchCheck,
        };
        const assessments = await parallel<StageResult>([
          () => assessProduct({ input, context: researchContext, attempts }),
          () => assessSystemFit({ input, context: researchContext, attempts }),
          () => assessSimplicity({ input, context: researchContext, attempts }),
          () =>
            assessReadability({ input, context: researchContext, attempts }),
          () =>
            assessCorrectness({ input, context: researchContext, attempts }),
        ]);
        // Pi returns null for failed parallel tasks. Keep successful siblings before stopping.
        for (const result of assessments) {
          if (result) {
            accepted = StageResultsSchema.parse({
              ...accepted,
              [result.stage]: result,
            });
          }
        }
        const missing = assessmentNames.filter((name) => !accepted[name]);
        if (missing.length) {
          throw new Error(`Missing assessments: ${missing.join(", ")}`);
        }
        await updateProgress({
          ...progress,
          stage: "assessments",
          status: "complete",
        });

        await startStep({ stage: "rules" });
        accepted.rules = await checkRules({
          input,
          context: accepted,
          attempts,
        });
        await updateProgress({
          ...progress,
          stage: "rules",
          status: "complete",
        });

        // Reconcile findings before drafting, editing and accepting the final report.
        await startStep({ stage: "consolidation" });
        accepted.consolidation = await consolidateReview({
          input,
          context: accepted,
          attempts,
        });

        await updateProgress({
          ...progress,
          stage: "consolidation",
          status: "complete",
        });
        await startStep({ stage: "draft" });
        accepted.draft = await draftReport({
          input,
          context: accepted,
          attempts,
        });
        await updateProgress({
          ...progress,
          stage: "draft",
          status: "complete",
        });
        await startStep({ stage: "editorial" });
        accepted.editorial = await editReport({
          input,
          context: accepted,
          attempts,
        });
        await updateProgress({
          ...progress,
          stage: "editorial",
          status: "complete",
        });
        await startStep({ stage: "report" });
        accepted.report = await acceptReport({
          input,
          context: accepted,
          attempts,
        });
        await updateProgress({
          ...progress,
          stage: "report",
          status: "complete",
        });
        break;
      }
    }

    // The decision assesses the accepted report; it does not publish anything.
    await startStep({ stage: "decision" });
    accepted.decision = await decideReview({
      input,
      context: accepted,
      attempts,
    });
    await updateProgress({
      ...progress,
      stage: "decision",
      status: "complete",
    });
  } catch (error) {
    // Accepted partial evidence survives an exhausted required step.
    failures.push({ stage: currentStep, reason: errorMessage(error) });
    await updateProgress({
      ...progress,
      stage: currentStep,
      status: "blocked",
      reason: errorMessage(error),
    });
  }

  const status = failures.length
    ? "incomplete"
    : accepted.setup?.mode === "split"
      ? "split"
      : "complete";
  if (status === "complete" && accepted.report) {
    accepted.report.markdown += coverageMarkdown(accepted);
  }
  await updateProgress({
    ...progress,
    stage: "save-artefacts",
    status: "running",
  });
  // Snapshot receipts now; later notifications belong in the returned result.
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
    validationCommand = await saveReviewFiles({ bundle, result });
  } catch (error) {
    await updateProgress({
      ...progress,
      stage: "save-artefacts",
      status: "blocked",
      reason: errorMessage(error),
    });
    throw error;
  }
  await updateProgress({
    ...progress,
    stage: "save-artefacts",
    status: "complete",
  });

  // Publication and final host status stay outside the review retry loop.
  if (delivery.started && bundle.status !== "incomplete") {
    await updateProgress({
      ...progress,
      stage: "publication",
      status: "running",
    });
  }
  const publication = await publishAcceptedReview({
    ...progress,
    bundle,
    result,
  });
  if (publication.status === "rejected" && bundle.status !== "incomplete") {
    await updateProgress({
      ...progress,
      stage: "publication",
      status: "blocked",
      reason: publication.reason,
    });
    // Keep the refusal when the progress update records a different receipt.
    delivery.publication = publication;
  }
  delivery.statuses.publication = publication.status;
  delivery.statuses.review = bundle.status;
  await sendFinalNotification({ input, state: delivery, bundle, result });
  return {
    ...result,
    approval: accepted.decision?.approval ?? null,
    publication,
    validationCommand,
    failures,
    notifications: delivery.notifications,
  };
}

/**
 * Establish the pinned scope, review depth and rule inventory.
 */
async function setupReview({ input, context, attempts }: ReviewStepInput) {
  return reviewAgent({
    input,
    context,
    attempts,
    stage: "setup",
    phase: "Setup",
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
    stage: "research",
    phase: "Research",
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
    stage: "researchCheck",
    phase: "Research",
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
    stage: "product",
    phase: "Assessments",
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
    stage: "systemFit",
    phase: "Assessments",
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
    stage: "simplicity",
    phase: "Assessments",
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
    stage: "readability",
    phase: "Assessments",
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
    stage: "correctness",
    phase: "Assessments",
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
    stage: "rules",
    phase: "Rules",
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
    stage: "consolidation",
    phase: "Consolidation",
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
    stage: "draft",
    phase: "Reporting",
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
    stage: "editorial",
    phase: "Reporting",
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
    stage: "report",
    phase: "Reporting",
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
    stage: "splitPlan",
    phase: "Reporting",
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
    stage: "decision",
    phase: "Decision",
    schema: StageSchemas.decision,
    prompt: [decisionPrompt, githubProgressTemplate].join("\n\n"),
  });
}

/**
 * Our small wrapper around Pi's agent API. The caller supplies the prompt,
 * phase and schema. Shared rules and revisions apply to every review worker;
 * invalid answers get one fresh retry. This function does not schedule steps,
 * update progress or accept results into the coordinator's state. Stage names
 * are used only for worker labels and attempt diagnostics.
 */
async function reviewAgent<Result extends StageResult>({
  input,
  context,
  attempts,
  stage,
  phase: workerPhase,
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
          label: `${stage}:${attempt}`,
          phase: workerPhase,
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
      attempts.push({ stage, attempt, reason: feedback });
    }
  }
  throw new Error(`${stage} failed after two attempts: ${feedback}`);
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
      phase: "Save artefacts",
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
 * Record review steps explicitly entered by the coordinator. There is no second
 * list of future steps to maintain. Delivery failures do not repeat review work.
 */
async function updateProgress({
  input,
  state,
  stage,
  status,
  reason,
}: ProgressUpdateInput): Promise<void> {
  state.statuses[stage] = status;
  if (!state.started) {
    return;
  }
  if (githubEnabled(input)) {
    const blocked = Object.entries(state.statuses).find(
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
      checklist: progressChecklist(state),
      reason: blocked ? (reason ?? `${blocked[0]} is blocked`) : "",
    });
  }
  await sendHostNotification({ input, state, stage, status, reason });
}
