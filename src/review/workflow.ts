/**
 * Coordinate the packaged review inside Pi's restricted workflow VM.
 *
 * The generated workflow calls this module with agent, parallel and phase host
 * capabilities. Filesystem work goes through the gated artefact writer. Failed
 * review stages retain accepted partial evidence; persistence failures reject
 * the run without claiming success.
 */
import {
  assessmentNames,
  parseReviewInput,
  StageSchemas,
  StageResultsSchema,
} from "./contracts.js";
import type {
  ReviewInput,
  ReviewResult,
  StageName,
  StageResults,
  StageResult,
  Bundle,
} from "./contracts.js";
import type { WorkflowHost } from "./contracts.js";
import { createProgressReporter } from "./progress.js";
import { saveArtifacts } from "./artifacts.js";
import {
  stageDefinitions,
  stageJsonSchema,
  stagePrompt,
  validateStage,
} from "./stages.js";
import { coverageMarkdown, fingerprint, errorMessage } from "./text.js";

const reportingStages = [
  "rules",
  "consolidation",
  "draft",
  "editorial",
  "report",
] satisfies StageName[];

type ReviewRun = {
  host: WorkflowHost;
  input: ReviewInput;
  completed: StageResults;
  failures: Bundle["failures"];
  attempts: Bundle["attempts"];
  progress: ReturnType<typeof createProgressReporter>;
  activeStage: string;
};

/**
 * Run one pinned review through the saved Pi workflow host.
 *
 * Review-stage failures receive one fresh retry, then produce incomplete saved
 * output. Writer failures stop the run without retrying a possibly completed
 * write. A returned complete review may still contain defects or evidence gaps.
 */
export async function runReviewWorkflow(host: WorkflowHost, args: unknown) {
  const run = createReviewRun(host, args);
  await executeReviewGraph(run);
  const bundle = await prepareReviewOutput(run);
  const result = createReviewResult(bundle);
  let validationCommand: string;
  try {
    validationCommand = await saveArtifacts(
      host,
      run.input,
      bundle,
      result,
      run.progress.update,
    );
  } catch (error) {
    await run.progress.interrupt(errorMessage(error));
    throw error;
  }
  const publication = await run.progress.finish(
    bundle,
    result,
    validationCommand,
  );
  return {
    ...result,
    approval: bundle.stages.decision?.approval ?? null,
    publication,
    validationCommand,
    failures: bundle.failures,
    notifications: run.progress.notifications,
  };
}

/**
 * Keep accepted assessments and their progress reporter owned by one run.
 */
function createReviewRun(host: WorkflowHost, args: unknown): ReviewRun {
  const input = parseReviewInput(args);
  const progress = createProgressReporter(input, host);
  return {
    host,
    input,
    progress,
    completed: {},
    failures: [],
    attempts: [],
    activeStage: "setup",
  };
}

/**
 * Retry only a worker's assessment, validating each attempt before acceptance.
 * Parallel workers leave active-stage and progress ownership with their barrier.
 */
async function runStageWithRetry(
  run: ReviewRun,
  name: StageName,
  context: StageResults,
  trackStage = true,
): Promise<StageResult> {
  const definition = stageDefinitions[name];
  if (trackStage) {
    run.activeStage = name;
    run.host.phase(definition.group);
    await run.progress.update(name, "running");
  }
  let feedback = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const output = await run.host.agent(
        stagePrompt(run.input, name, context, feedback),
        {
          label: `${name}:${attempt}`,
          phase: definition.group,
          schema: stageJsonSchema(name, run.input),
        },
      );
      if (output === null) {
        throw new Error(
          "Agent failed, was skipped, or returned invalid structured output",
        );
      }
      const result = StageSchemas[name].parse(output);
      validateStage(result, context, run.input);
      if (trackStage) {
        await run.progress.update(name, "complete");
      }
      return result;
    } catch (error) {
      feedback = errorMessage(error);
      run.attempts.push({ stage: name, attempt, reason: feedback });
      if (trackStage && attempt === 1) {
        await run.progress.update(name, "retrying");
      }
    }
  }
  throw new Error(`${name} failed after two attempts: ${feedback}`);
}

/**
 * Accept each coordinator-owned stage before supplying it to the next worker.
 */
async function runSequentialStages(
  run: ReviewRun,
  names: readonly StageName[],
): Promise<void> {
  for (const name of names) {
    const result = await runStageWithRetry(run, name, run.completed);
    run.completed = StageResultsSchema.parse({
      ...run.completed,
      [name]: result,
    });
  }
}

/**
 * Wait for all five assessments, preserving successful siblings on failure.
 * Pi parallel failures become null, so completeness is checked after the barrier.
 */
async function runAssessmentBarrier(run: ReviewRun): Promise<void> {
  run.activeStage = "assessments";
  run.host.phase("Assessments");
  await run.progress.update("assessments", "running");
  const context = {
    setup: run.completed.setup,
    research: run.completed.research,
    "research-check": run.completed["research-check"],
  };
  const results = await run.host.parallel(
    assessmentNames.map(
      (name) => () => runStageWithRetry(run, name, context, false),
    ),
  );
  for (const result of results) {
    if (result) {
      run.completed = StageResultsSchema.parse({
        ...run.completed,
        [result.stage]: result,
      });
    }
  }
  const missing = assessmentNames.filter((name) => !run.completed[name]);
  if (missing.length) {
    throw new Error(`Missing assessments: ${missing.join(", ")}`);
  }
  await run.progress.update("assessments", "complete");
}

/**
 * Execute the full or split-only graph and record an exhausted review stage.
 * Saving remains outside this boundary so accepted partial work can be retained.
 */
async function executeReviewGraph(run: ReviewRun): Promise<void> {
  try {
    await runSequentialStages(run, ["setup"]);
    await run.progress.start(run.completed.setup?.mode ?? "full");
    if (run.completed.setup?.mode === "split") {
      await runSequentialStages(run, ["split-plan"]);
    } else {
      await runSequentialStages(run, ["research", "research-check"]);
      await runAssessmentBarrier(run);
      await runSequentialStages(run, reportingStages);
    }
    await runSequentialStages(run, ["decision"]);
  } catch (error) {
    run.failures.push({ stage: run.activeStage, reason: errorMessage(error) });
    await run.progress.update(run.activeStage, "blocked");
  }
}

/**
 * Add canonical coverage and snapshot accepted evidence before the writer runs.
 */
async function prepareReviewOutput(run: ReviewRun): Promise<Bundle> {
  const status = run.failures.length
    ? "incomplete"
    : run.completed.setup?.mode === "split"
      ? "split"
      : "complete";
  if (status === "complete" && run.completed.report) {
    run.completed.report.markdown += coverageMarkdown(run.completed);
  }
  await run.progress.update("save-artefacts", "running");
  return {
    version: 1,
    input: run.input,
    status,
    stages: run.completed,
    failures: run.failures,
    attempts: run.attempts,
    notifications: [...run.progress.notifications],
  };
}

/**
 * Describe accepted review completion and saved-file locations for the caller.
 */
function createReviewResult(bundle: Bundle): ReviewResult {
  const { input, status, stages, failures } = bundle;
  const required: StageName[] =
    stages.setup?.mode === "split"
      ? ["setup", "split-plan", "decision"]
      : [
          "setup",
          "research",
          "research-check",
          ...assessmentNames,
          ...reportingStages,
          "decision",
        ];
  return {
    status,
    runId: input.runId,
    invocationId: input.invocationId,
    base: input.base,
    head: input.head,
    bundlePath: `${input.artifacts}/bundle.json`,
    reportPath: failures.length ? null : `${input.artifacts}/review-report.md`,
    fingerprint: fingerprint(JSON.stringify(bundle)),
    missingStages: required.filter((name) => !stages[name]),
    coverageGaps: Object.entries(stages).flatMap(([stage, value]) =>
      value.gaps.map((reason) => ({ stage, reason })),
    ),
  };
}
