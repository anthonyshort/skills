import {
  assessmentNames,
  parseReviewInput,
  StageSchemas,
  StageResultsSchema,
} from "./contracts.js";
import type {
  ReviewResult,
  StageName,
  StageResults,
  StageResult,
  Bundle,
} from "./contracts.js";
import type { WorkflowHost } from "./host.js";
import { createProgressReporter } from "./progress.js";
import { saveArtifacts, publishArtifacts } from "./artifacts.js";
import {
  stageDefinitions,
  stageJsonSchema,
  stagePrompt,
  validateStage,
} from "./stages.js";
import { coverageMarkdown, fingerprint, message } from "./text.js";

export async function runReviewWorkflow(host: WorkflowHost, args: unknown) {
  const input = parseReviewInput(args);
  const { agent, parallel, phase } = host;
  const progress = createProgressReporter(input, host);
  const reportStatus = (stage: string, status: string) =>
    progress.update(stage, status, completed.setup?.mode === "split");
  let completed: StageResults = {};
  const notifications = progress.notifications;
  const failures: Bundle["failures"] = [];
  const attempts: Bundle["attempts"] = [];
  let activeStage: string = "setup";

  async function acceptStage(
    name: StageName,
    context: StageResults,
    reportProgress = true,
  ): Promise<StageResult> {
    const definition = stageDefinitions[name];
    // Parallel assessments share the group status but still identify each failed stage.
    if (reportProgress) {
      activeStage = name;
      phase(definition.group);
      await reportStatus(name, "running");
    }
    let feedback = "";
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
        const result = StageSchemas[name].parse(output);
        validateStage(result, context, input);
        if (reportProgress) {
          await reportStatus(name, "complete");
        }
        return result;
      } catch (error) {
        feedback = message(error);
        attempts.push({ stage: name, attempt, reason: feedback });
        if (reportProgress && attempt === 1) {
          await reportStatus(name, "retrying");
        }
      }
    }
    throw new Error(`${name} failed after two attempts: ${feedback}`);
  }

  async function runStage(name: StageName): Promise<void> {
    const result = await acceptStage(name, completed);
    completed = StageResultsSchema.parse({ ...completed, [name]: result });
  }

  try {
    await runStage("setup");
    if (completed.setup?.mode === "split") {
      await runStage("split-plan");
    } else {
      await runStage("research");
      activeStage = "assessments";
      phase("Assessments");
      await reportStatus("assessments", "running");
      const context = { setup: completed.setup, research: completed.research };
      const results = await parallel(
        assessmentNames.map((name) => () => acceptStage(name, context, false)),
      );
      for (const result of results) {
        if (result) {
          completed = StageResultsSchema.parse({
            ...completed,
            [result.stage]: result,
          });
        }
      }
      const missing = assessmentNames.filter((name) => !completed[name]);
      if (missing.length) {
        throw new Error(`Missing assessments: ${missing.join(", ")}`);
      }
      await reportStatus("assessments", "complete");
      for (const name of [
        "rules",
        "consolidation",
        "draft",
        "editorial",
        "report",
      ] as const) {
        await runStage(name);
      }
    }
    await runStage("decision");
  } catch (error) {
    failures.push({ stage: activeStage, reason: message(error) });
    await reportStatus(activeStage, "blocked");
  }
  const status = failures.length
    ? "incomplete"
    : completed.setup?.mode === "split"
      ? "split"
      : "complete";
  if (status === "complete" && completed.report) {
    completed.report.markdown += coverageMarkdown(completed);
  }
  await reportStatus("save-artefacts", "running");
  const bundle: Bundle = {
    version: 1,
    input,
    status,
    stages: completed,
    failures,
    attempts,
    notifications,
  };
  const serialized = JSON.stringify(bundle);
  const required: StageName[] =
    completed.setup?.mode === "split"
      ? ["setup", "split-plan", "decision"]
      : [
          "setup",
          "research",
          ...assessmentNames,
          "rules",
          "consolidation",
          "draft",
          "editorial",
          "report",
          "decision",
        ];
  const result: ReviewResult = {
    status,
    runId: input.runId,
    invocationId: input.invocationId,
    base: input.base,
    head: input.head,
    bundlePath: `${input.artifacts}/bundle.json`,
    reportPath: failures.length ? null : `${input.artifacts}/review-report.md`,
    fingerprint: fingerprint(serialized),
    publication: {
      mode: input.publication.mode,
      status:
        failures.length || input.publication.mode === "local"
          ? "not_requested"
          : "pending",
    },
    missingStages: required.filter((name) => !completed[name]),
    coverageGaps: Object.entries(completed).flatMap(([stage, value]) =>
      value.gaps.map((reason) => ({ stage, reason })),
    ),
  };

  const validationCommand = await saveArtifacts(
    host,
    input,
    bundle,
    result,
    reportStatus,
  );
  if (!failures.length) {
    await publishArtifacts(host, input, result, reportStatus);
  }
  return {
    ...result,
    validationCommand,
    published: result.publication.status === "confirmed",
    failures,
    notifications,
  };
}
