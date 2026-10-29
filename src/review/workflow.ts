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
  ReviewAgentInput,
  ReviewSnapshot,
  ReviewStepTask,
  ReviewWorkflowInput,
  ReviewRun,
  ReviewStepInput,
  SaveReviewInput,
  SavedReview,
  ReviewResult,
  ReviewOutput,
  StageName,
  StageResult,
  StageResults,
} from "./contracts.js";
import { createGithubComment } from "./github.js";
import {
  validateAnswer,
  validateSetup,
  validateRuleCoverage,
  validateFindingDecisions,
  validateApproval,
} from "./validation.js";
import {
  coverageMarkdown,
  fingerprint,
  errorMessage,
  quote,
  ReviewEvents,
  createNotifications,
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

  // Subscribers own their effects. Pi grouping is an optional UI observer.
  const events = new ReviewEvents();
  events.subscribe((event) => {
    if (event.type === "stepStarted") {
      phase(event.step);
    }
  });

  // Notifications can subscribe first: final publication has its own event.
  const notifications = createNotifications({ input, events });
  const githubComment = createGithubComment({ input, events });

  // The review knows only how to emit facts, not which objects observe them.
  const review = await reviewWorkflow({ input, events });

  // Persist accepted answers and validate the files before GitHub can use them.
  let saved: SavedReview;
  try {
    saved = await saveReviewFiles({
      review,
      notifications: notifications.receipts,
    });
  } catch (error) {
    await events.emit({
      type: "runFailed",
      review,
      reason: errorMessage(error),
    });
    throw error;
  }

  // GitHub publishes in response, then emits the outcome for notifications.
  await events.emit({ type: "reviewSaved", saved });

  // Return file locations, the assessment and channel outcomes to the caller.
  return {
    ...saved.result,
    approval: review.stages.decision?.approval ?? null,
    publication: githubComment.publication,
    validationCommand: saved.validationCommand,
    failures: review.failures,
    notifications: notifications.receipts,
  };
}

/**
 * Execute the review sequence and retain accepted evidence. Awaited callbacks
 * report its lifecycle; this function does not notify, save or publish.
 */
async function reviewWorkflow({
  input,
  events,
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
    await events.emit({ type: "stepStarted", step, snapshot: snapshot() });
    let result: Result;
    try {
      result = await run({ input, context: { ...accepted }, attempts });
      if (result) {
        accept(result);
      }
    } catch (error) {
      const reason = errorMessage(error);
      failures.push({ stage: step, reason });
      await events.emit({
        type: "stepFailed",
        step,
        reason,
        snapshot: snapshot(),
      });
      throw error;
    }
    await events.emit({ type: "stepAccepted", step, snapshot: snapshot() });
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
    validate: (setup) => validateSetup({ setup }),
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
  const setup = context.setup;
  if (!setup) {
    throw new Error("Rule coverage requires accepted setup");
  }
  return reviewAgent({
    input,
    context,
    attempts,
    label: "rules",
    schema: StageSchemas.rules,
    validate: (assessment) =>
      validateRuleCoverage({
        rules: assessment.rules,
        expectedPaths: setup.rulePaths,
      }),
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
    validate: (report) => validateFindingDecisions({ report, prior: context }),
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
  const setup = context.setup;
  if (!setup) {
    throw new Error("Approval requires accepted setup");
  }
  return reviewAgent({
    input,
    context,
    attempts,
    label: "decision",
    schema: StageSchemas.decision,
    validate: (decision) =>
      validateApproval({
        decision,
        setup,
        report: context.report,
        prior: context,
      }),
    prompt: [decisionPrompt, githubProgressTemplate].join("\n\n"),
  });
}

/**
 * Our small wrapper around Pi's agent API. The caller supplies the prompt,
 * label, schema and optional step-specific check. Shared evidence and revision
 * checks apply to every worker; invalid answers get one fresh retry. This
 * function does not schedule steps, update progress or accept evidence. Labels identify Pi workers and retry
 * diagnostics; the coordinator selects display groups from lifecycle events.
 */
async function reviewAgent<Result extends StageResult>({
  input,
  context,
  attempts,
  label,
  schema,
  prompt,
  validate,
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
      validateAnswer({ result, input });
      validate?.(result);
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
  review,
  notifications,
}: SaveReviewInput): Promise<SavedReview> {
  const bundle: Bundle = {
    version: 1,
    ...review,
    notifications: [...notifications],
  };
  const { input, status, stages } = bundle;
  const required: readonly StageName[] =
    stages.setup?.mode === "split"
      ? ["setup", "splitPlan", "decision"]
      : stageNames.filter((name) => name !== "splitPlan");
  const result: ReviewResult = {
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
  return { bundle, result, validationCommand };
}
