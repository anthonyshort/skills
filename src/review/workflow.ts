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
  GitHubRequest,
  ReviewInput,
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
    switch (accepted.setup?.mode) {
      case "split":
        await reviewStage("split-plan");
        break;
      default: {
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
        await updateProgress(input, delivery, "assessments", "complete");

        await reviewStage("rules");
        await reviewStage("consolidation");
        await reviewStage("draft");
        await reviewStage("editorial");
        await reviewStage("report");
        break;
      }
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
  if (status === "complete" && accepted.report) {
    accepted.report.markdown += coverageMarkdown(accepted);
  }
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
  if (delivery.started && bundle.status !== "incomplete") {
    await updateProgress(input, delivery, "publication", "running");
  }
  const publication = await publishAcceptedReview(
    input,
    delivery,
    bundle,
    result,
  );
  if (publication.status === "rejected" && bundle.status !== "incomplete") {
    await updateProgress(
      input,
      delivery,
      "publication",
      "blocked",
      publication.reason,
    );
    delivery.publication = publication;
  }
  delivery.statuses.publication = publication.status;
  delivery.statuses.review = bundle.status;
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
        if (output === null) {
          throw new Error(
            "Agent failed, was skipped, or returned invalid structured output",
          );
        }
        result = StageSchemas[name].parse(output);
        validateStage(result, context, input);
        break;
      } catch (error) {
        result = undefined;
        feedback = errorMessage(error);
        attempts.push({ stage: name, attempt, reason: feedback });
        if (!assessment && attempt === 1) {
          await updateProgress(input, delivery, name, "retrying");
        }
      }
    }
    if (!result) {
      throw new Error(`${name} failed after two attempts: ${feedback}`);
    }
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
 * The stage-to-skill map. Criteria remain in criteria.md; these instructions limit
 * each worker to its assigned part of the coordinator’s process.
 */
const stageDefinitions = {
  setup: {
    group: "Setup",
    reference: "step-1-setup",
    instructions:
      "Read the full diff, count additions/deletions, apply the over-2,000-added-lines split policy, and enumerate every rule path from the main and wrapper rules/README.md indexes. Use absolute canonical paths. Record any permitted size exception.",
  },
  research: {
    group: "Research",
    reference: "step-2-research",
    instructions:
      "Complete fresh research or validate prior complete review evidence using the re-review gate. Missing external sources must be recorded, not invented.",
  },
  "research-check": {
    group: "Research",
    reference: "step-2-research",
    instructions:
      "Act as the parent accepting the research brief. Independently check its important claims against the cited sources, scope and current CI. Validate any reused prior research. Return a corrected self-contained brief with supported conclusions and remaining gaps for the assessments. Reading the brief alone does not complete this check. Do not repeat broad searches without a specific missing or stale source.",
  },
  product: {
    group: "Assessments",
    reference: "q-should-we-build-this",
    instructions: "",
  },
  "system-fit": {
    group: "Assessments",
    reference: "q-does-this-code-fit-into-the-existing-system",
    instructions: "",
  },
  simplicity: {
    group: "Assessments",
    reference: "q-is-this-the-simplest-solution",
    instructions: "",
  },
  readability: {
    group: "Assessments",
    reference: "q-is-this-code-clear-and-easy-to-maintain",
    instructions: "",
  },
  correctness: {
    group: "Assessments",
    reference: "q-is-this-implementation-correct",
    instructions: "",
  },
  rules: {
    group: "Rules",
    reference: "step-4-check-review-rules",
    instructions:
      "One sequential pass must return exactly one row per setup.rulePaths entry, including skipped rules with reasons. Read each selected rule fully.",
  },
  consolidation: {
    group: "Consolidation",
    reference: "step-5-create-the-final-review-report",
    instructions:
      "Perform only the evidence-consolidation items 1–5 in Step 5. Independently check important worker claims against code, requirements and current CI. Verify checklist guidance coverage, resolve contradictions and merge duplicate findings. Record unresolved claims as gaps. Do not draft or edit the report in this stage.",
  },
  draft: {
    group: "Reporting",
    reference: "step-5-create-the-final-review-report",
    instructions:
      "Perform only Step 5 item 6: write the complete report using the accepted consolidation. Editorial reduction and final acceptance are later workflow stages.",
  },
  editorial: {
    group: "Reporting",
    reference: "step-5-create-the-final-review-report",
    instructions:
      "Shorten the complete draft without changing priorities, findings, evidence, tables, check outcomes or uncertainty. Return the edited full report as markdown.",
  },
  report: {
    group: "Reporting",
    reference: "step-5-create-the-final-review-report",
    instructions:
      "Compare the completed draft and editorial versions. Restore lost detail and accept the final canonical report. Account for every worker finding with decisions.sourceId = '<stage>:<finding id>'. Explain retained, merged, excluded or open findings. Keep retained report IDs visible in markdown. The decision stage assesses this accepted report.",
  },
  "split-plan": {
    group: "Reporting",
    reference: "step-1-setup",
    instructions:
      "Return a split-only report with Assessment, Risk and scope, Split plan and CI status headings. Read the sibling split-pr skill when available. State what was inspected and that full review was deferred.",
  },
  decision: {
    group: "Decision",
    reference: "step-6-publish-results",
    instructions:
      "Perform the final approval assessment from Step 6 without publishing. Return approval in the documented seven-check schema, summaryMarkdown following templates/github-progress.md, and inlineComments for verified new bugs with valid diff anchors only. Each inline ID must exactly match a retained reportId whose source is a new bug. Required retained findings and unresolved findings cannot pass clean_review. Do not introduce new findings. For split-only output use outcome split, checks null and no inline comments. Count additions plus deletions across the whole diff. This stage returns an assessment only. A later workflow delivery worker owns publication and approval submission. Honour input.publication: local-only, staged and comment-only never allow automatic approval; if all checks pass use not_submitted with the restriction as its reason and next step.",
  },
} satisfies Record<
  StageName,
  { group: string; reference: string; instructions: string }
>;

/**
 * Builds one worker assignment from pinned inputs and already accepted answers.
 * Retry feedback describes the rejected answer without reusing that worker.
 */
function stagePrompt(
  input: ReviewInput,
  name: StageName,
  context: StageResults,
  feedback: string,
): string {
  const definition = stageDefinitions[name];
  return [
    `You are the ${name} worker for one pinned code review.`,
    `Read shared review constraints in ${input.skillRoot}/criteria.md#rules. Do not perform its coordinator steps.`,
    `Assigned instructions: ${input.skillRoot}/criteria.md#${definition.reference}`,
    "Read the assigned section and perform only its task. Coordinator steps outside that section are not part of your assignment.",
    `Wrapper guidance: ${JSON.stringify(input.wrapperSkillRoots.map((root) => `${root}/SKILL.md`))}.`,
    "Execute only your assigned stage. Do not recursively run the review or delegate more agents.",
    "For assessments and later stages, research-check is the accepted corrected research brief and takes precedence over the initial research result. Preserve remaining evidence gaps.",
    "Accepted prior reports are supplied inline below and saved later by the writer. Editing happens in later stages. Publication belongs to the workflow delivery worker. Do not treat unsaved intermediate files or future stages as missing evidence.",
    `Read supplied scope and requirements files: ${JSON.stringify(input.contextFiles)}. Apply caller restrictions, cite the files and record unavailable external context rather than inventing sources.`,
    "Finish by calling StructuredOutput with markdown, individual checks, findings and gaps. Text outside that tool call is discarded. Do not substitute a prose final answer.",
    "Read relevant best-practice skill descriptions and select guidance for this question. Cite guidance sections and versions.",
    assessmentNames.some((question) => question === name)
      ? "Read the main skill's Review best practices and Build and verify the checklist sections as well as your assigned question. Return only your own assessment."
      : "",
    "Do not modify source or artefacts, install anything, run local project checks, start services, trigger CI, publish, notify, or call github_review_complete. Use source inspection and existing CI.",
    "Before inspecting source, confirm checkout HEAD matches the supplied head and the checkout is clean. Read other revisions through pinned Git objects. Record a mismatch as blocked rather than reviewing another revision.",
    "A blocked or unavailable evidence source is a recorded gap, not a passed check. Findings need locations, triggers, effects and evidence. An empty findings array is valid.",
    definition.instructions,
    ["draft", "editorial", "report"].includes(name)
      ? `Use ${input.skillRoot}/templates/review-report.md. Return the complete self-contained report. Preserve coverage, research context and every evidence gap.`
      : "",
    `Pinned inputs: ${JSON.stringify(input)}`,
    `Prior accepted results: ${JSON.stringify(context)}`,
    feedback
      ? `The prior attempt failed validation: ${feedback}. Make one fresh attempt.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Pins the worker’s structured-output schema to this review’s exact revisions.
 */
function stageJsonSchema(name: StageName, input: ReviewInput) {
  return z.toJSONSchema(
    StageSchemas[name].extend({
      base: z.literal(input.base),
      head: z.literal(input.head),
    }),
    { target: "draft-7" },
  );
}

/**
 * Start external updates only after setup accepts the pinned scope and route.
 */
async function startProgress(
  input: ReviewInput,
  state: DeliveryState,
  mode: "full" | "split",
): Promise<void> {
  let stages: string[];
  switch (mode) {
    case "split":
      stages = ["split-plan", "decision", "save-artefacts", "publication"];
      break;
    case "full":
      stages = [
        "research",
        "research-check",
        "assessments",
        "rules",
        "consolidation",
        "draft",
        "editorial",
        "report",
        "decision",
        "save-artefacts",
        "publication",
      ];
      break;
  }
  for (const stage of stages) {
    state.statuses[stage] = "pending";
  }
  state.started = true;
  await updateProgress(input, state, "setup", "complete");
}

/**
 * Update destinations independently so one failure cannot suppress the other.
 * GitHub calls are sequential because they share the helper's saved state.
 */
async function updateProgress(
  input: ReviewInput,
  state: DeliveryState,
  stage: string,
  status: string,
  reason?: string,
): Promise<void> {
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
    await sendGitHub(
      input,
      state,
      operation,
      progressChecklist(state),
      blocked ? (reason ?? `${blocked[0]} is blocked`) : "",
    );
  }
  await sendHostNotification(input, state, stage, status, reason);
}
