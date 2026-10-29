/**
 * Run the review in Pi's workflow VM. agent(), parallel() and phase() are
 * official pi-subagents globals, declared in pi-workflow.d.ts. The local
 * reviewAgent wrapper adds common rules, validation and one fresh retry.
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
 * and schema; only the shared reviewAgent wrapper adds rules and retries.
 */
export async function runReviewWorkflow(args: unknown): Promise<ReviewOutput> {
  const input = parseReviewInput(args);
  let accepted: StageResults = {};
  const attempts: Bundle["attempts"] = [];
  const failures: Bundle["failures"] = [];
  let activeStage = "setup";
  // Diagnostics name the worker; progress marks its entire milestone blocked.
  let activeMilestone = "setup";
  const delivery: DeliveryState = {
    statuses: {},
    notifications: [],
    started: false,
    hostNotifications: true,
    githubSequence: 0,
    publication: initialPublication(input),
  };
  const progress = { input, state: delivery };

  // Setup pins the comparison before any external progress starts.
  try {
    phase("Setup");
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
        phase("Reporting");
        activeStage = "split-plan";
        activeMilestone = "split-plan";
        await updateProgress({
          ...progress,
          stage: "split-plan",
          status: "running",
        });
        accepted["split-plan"] = await planSplit({
          input,
          context: accepted,
          attempts,
        });
        await updateProgress({
          ...progress,
          stage: "split-plan",
          status: "complete",
        });
        break;
      case "full": {
        // Independently check the brief before any assessment uses its conclusions.
        phase("Research");
        activeStage = "research";
        activeMilestone = "research";
        await updateProgress({
          ...progress,
          stage: "research",
          status: "running",
        });
        accepted.research = await researchReview({
          input,
          context: accepted,
          attempts,
        });
        activeStage = "research-check";
        accepted["research-check"] = await checkResearch({
          input,
          context: accepted,
          attempts,
        });
        await updateProgress({
          ...progress,
          stage: "research",
          status: "complete",
        });

        // All five workers see the same research, never developing sibling answers.
        phase("Assessments");
        activeStage = "assessments";
        activeMilestone = "assessments";
        await updateProgress({
          ...progress,
          stage: "assessments",
          status: "running",
        });
        const researchContext = {
          setup: accepted.setup,
          research: accepted.research,
          "research-check": accepted["research-check"],
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
        // Retain successful siblings in question order before rejecting missing work.
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

        phase("Rules");
        activeStage = "rules";
        activeMilestone = "rules";
        await updateProgress({
          ...progress,
          stage: "rules",
          status: "running",
        });
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

        // Reconcile findings before drafting; complete reporting only after acceptance.
        phase("Consolidation");
        activeStage = "consolidation";
        activeMilestone = "report";
        await updateProgress({
          ...progress,
          stage: "report",
          status: "running",
        });
        accepted.consolidation = await consolidateReview({
          input,
          context: accepted,
          attempts,
        });
        phase("Reporting");
        activeStage = "draft";
        accepted.draft = await draftReport({
          input,
          context: accepted,
          attempts,
        });
        activeStage = "editorial";
        accepted.editorial = await editReport({
          input,
          context: accepted,
          attempts,
        });
        activeStage = "report";
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
    phase("Decision");
    activeStage = "decision";
    activeMilestone = "decision";
    await updateProgress({
      ...progress,
      stage: "decision",
      status: "running",
    });
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
    failures.push({ stage: activeStage, reason: errorMessage(error) });
    await updateProgress({
      ...progress,
      stage: activeMilestone,
      status: "blocked",
      reason: `${activeStage}: ${errorMessage(error)}`,
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
    phase("Save artefacts");
    validationCommand = await saveArtifacts({ bundle, result });
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
    prompt: [
      `Assigned instructions: ${input.skillRoot}/criteria.md#step-1-setup`,
      "Read the full diff, count additions/deletions, apply the over-2,000-added-lines split policy, and enumerate every rule path from the main and wrapper rules/README.md indexes. Use absolute canonical paths. Record any permitted size exception.",
    ].join("\n"),
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
    prompt: [
      `Assigned instructions: ${input.skillRoot}/criteria.md#step-2-research`,
      "Complete fresh research or validate prior complete review evidence using the re-review gate. Missing external sources must be recorded, not invented.",
    ].join("\n"),
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
    stage: "research-check",
    phase: "Research",
    schema: StageSchemas["research-check"],
    prompt: [
      `Assigned instructions: ${input.skillRoot}/criteria.md#step-2-research`,
      "Act as the parent accepting the research brief. Independently check its important claims against the cited sources, scope and current CI. Validate any reused prior research. Return a corrected self-contained brief with supported conclusions and remaining gaps for the assessments. Reading the brief alone does not complete this check. Do not repeat broad searches without a specific missing or stale source.",
    ].join("\n"),
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
    prompt: [
      `Assigned instructions: ${input.skillRoot}/criteria.md#q-should-we-build-this`,
      "Assess whether the change solves the right problem, using the accepted research.",
      "Read the Review best practices and Build and verify the checklist sections in criteria.md, as well as your assigned question. Return only your own assessment.",
    ].join("\n"),
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
    stage: "system-fit",
    phase: "Assessments",
    schema: StageSchemas["system-fit"],
    prompt: [
      `Assigned instructions: ${input.skillRoot}/criteria.md#q-does-this-code-fit-into-the-existing-system`,
      "Assess ownership, dependencies and fit with the established system and documented direction.",
      "Read the Review best practices and Build and verify the checklist sections in criteria.md, as well as your assigned question. Return only your own assessment.",
    ].join("\n"),
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
    prompt: [
      `Assigned instructions: ${input.skillRoot}/criteria.md#q-is-this-the-simplest-solution`,
      "Assess whether this is the simplest supported implementation and scope. Propose concrete simplifications that preserve required behaviour.",
      "Read the Review best practices and Build and verify the checklist sections in criteria.md, as well as your assigned question. Return only your own assessment.",
    ].join("\n"),
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
    prompt: [
      `Assigned instructions: ${input.skillRoot}/criteria.md#q-is-this-code-clear-and-easy-to-maintain`,
      "Perform the dedicated readability pass over changed bodies and tests. Keep correctness and architectural redesign with their own assessments.",
      "Read the Review best practices and Build and verify the checklist sections in criteria.md, as well as your assigned question. Return only your own assessment.",
    ].join("\n"),
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
    prompt: [
      `Assigned instructions: ${input.skillRoot}/criteria.md#q-is-this-implementation-correct`,
      "Trace behaviour through real callers and tests. Report supported defects, current CI evidence and coverage limits.",
      "Read the Review best practices and Build and verify the checklist sections in criteria.md, as well as your assigned question. Return only your own assessment.",
    ].join("\n"),
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
    prompt: [
      `Assigned instructions: ${input.skillRoot}/criteria.md#step-4-check-review-rules`,
      "One sequential pass must return exactly one row per setup.rulePaths entry, including skipped rules with reasons. Read each selected rule fully.",
    ].join("\n"),
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
    prompt: [
      `Assigned instructions: ${input.skillRoot}/criteria.md#step-5-create-the-final-review-report`,
      "Perform only the evidence-consolidation items 1\u20135 in Step 5. Independently check important worker claims against code, requirements and current CI. Verify checklist guidance coverage, resolve contradictions and merge duplicate findings. Record unresolved claims as gaps. Do not draft or edit the report in this stage.",
    ].join("\n"),
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
    prompt: [
      `Assigned instructions: ${input.skillRoot}/criteria.md#step-5-create-the-final-review-report`,
      "Perform only Step 5 item 6: write the complete report using the accepted consolidation. Editorial reduction and final acceptance are later workflow stages.",
      `Use ${input.skillRoot}/templates/review-report.md. Return the complete self-contained report. Preserve coverage, research context and every evidence gap.`,
    ].join("\n"),
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
    prompt: [
      `Assigned instructions: ${input.skillRoot}/criteria.md#step-5-create-the-final-review-report`,
      "Shorten the complete draft without changing priorities, findings, evidence, tables, check outcomes or uncertainty. Return the edited full report as markdown.",
      `Use ${input.skillRoot}/templates/review-report.md. Return the complete self-contained report. Preserve coverage, research context and every evidence gap.`,
    ].join("\n"),
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
    prompt: [
      `Assigned instructions: ${input.skillRoot}/criteria.md#step-5-create-the-final-review-report`,
      "Compare the completed draft and editorial versions. Restore lost detail and accept the final canonical report. Account for every worker finding with decisions.sourceId = '<stage>:<finding id>'. Explain retained, merged, excluded or open findings. Keep retained report IDs visible in markdown. The decision stage assesses this accepted report.",
      `Use ${input.skillRoot}/templates/review-report.md. Return the complete self-contained report. Preserve coverage, research context and every evidence gap.`,
    ].join("\n"),
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
    stage: "split-plan",
    phase: "Reporting",
    schema: StageSchemas["split-plan"],
    prompt: [
      `Assigned instructions: ${input.skillRoot}/criteria.md#step-1-setup`,
      "Return a split-only report with Assessment, Risk and scope, Split plan and CI status headings. Read the sibling split-pr skill when available. State what was inspected and that full review was deferred.",
    ].join("\n"),
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
    prompt: [
      `Assigned instructions: ${input.skillRoot}/criteria.md#step-6-publish-results`,
      "Perform the final approval assessment from Step 6 without publishing. Return approval in the documented seven-check schema, summaryMarkdown following templates/github-progress.md, and inlineComments for verified new bugs with valid diff anchors only. Each inline ID must exactly match a retained reportId whose source is a new bug. Required retained findings and unresolved findings cannot pass clean_review. Do not introduce new findings. For split-only output use outcome split, checks null and no inline comments. Count additions plus deletions across the whole diff. This stage returns an assessment only. A later workflow delivery worker owns publication and approval submission. Honour input.publication: local-only, staged and comment-only never allow automatic approval; if all checks pass use not_submitted with the restriction as its reason and next step.",
    ].join("\n"),
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
    `Read shared review constraints in ${input.skillRoot}/criteria.md#rules. Read the assigned section and perform only its task.`,
    "Do not launch the review skill, run another workflow, delegate agents, publish or notify. The coordinator owns later stages and delivery.",
    "Use source inspection and existing CI. Do not modify source or artefacts, install anything, run local project checks, start services or trigger CI.",
    "Before inspecting source, confirm checkout HEAD matches the pinned head and the checkout is clean. Read other revisions through pinned Git objects. Record a mismatch as blocked.",
    "Findings need locations, triggers, effects and evidence. Missing evidence is a gap, not a passed check. An empty findings array is valid.",
    "Read relevant best-practice skill descriptions and select guidance for this task. Cite the sections used.",
    "The corrected research-check brief takes precedence over the initial research. Preserve remaining evidence gaps.",
    "Prior reports are supplied below and saved later by the writer. Do not treat unsaved intermediate files or future stages as missing evidence.",
    "Finish by calling StructuredOutput. Text outside that tool call is discarded.",
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
 * The official agent gate checks actual files before the writer is accepted.
 * Do not retry a writer whose filesystem work may already have completed.
 */
async function saveArtifacts({
  bundle,
  result,
}: SaveArtifactsInput): Promise<string> {
  const { input } = bundle;
  const validationCommand = `node --import ${quote(input.tsxLoader)} ${quote(`${input.supportRoot}/validate-bundle.ts`)} ${quote(`${input.artifacts}/bundle.json`)} --fingerprint ${quote(result.fingerprint)}`;

  // This worker writes accepted values; the command gate checks the actual files.
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
 * Record milestones explicitly entered by the coordinator. There is no second
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
