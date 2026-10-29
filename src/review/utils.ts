/**
 * Derive review progress and render accepted evidence without retained UI state.
 */
import { stageNames } from "./schemas.js";
import type {
  ReviewEvent,
  ReviewRun,
  StageName,
  StageResults,
} from "./schemas.js";
import type { PublicationResult } from "./github.js";

type ProgressStep = StageName | "publication" | "review";
type ProgressStatus =
  | ReviewRun["status"]
  | PublicationResult["status"]
  | "running"
  | "blocked";
export type ProgressStatuses = Partial<Record<ProgressStep, ProgressStatus>>;
type ReviewSnapshot = Pick<ReviewRun, "stages" | "failures">;

/**
 * Render a shared progress view without delivery or retained state. reviewCompleted requests publication;
 * only publicationFinished has the outcome needed for a final notification.
 */
export function reviewEventProgress(event: ReviewEvent):
  | {
      statuses: ProgressStatuses;
      stage: string;
      status: ProgressStatus;
      reason: string;
    }
  | undefined {
  let snapshot: ReviewSnapshot;
  let steps: readonly ProgressStep[];
  let status: ProgressStatus;
  let reason = "";

  switch (event.type) {
    case "reviewCompleted":
      return;
    case "tasksStarted":
    case "tasksFinished":
      snapshot = {
        stages: event.snapshot.results,
        failures: event.snapshot.failures.map(({ name, reason }) => ({
          stage: name,
          reason,
        })),
      };
      steps = event.names;
      status = event.type === "tasksStarted" ? "running" : "complete";
      reason = snapshot.failures
        .map(({ stage, reason }) => `${stage}: ${reason}`)
        .join("\n");
      break;
    case "publicationFinished": {
      const { review } = event;
      const { publication } = event;
      snapshot = review;
      steps = ["review"];
      status = review.status;
      reason = [
        `Assessment: ${review.stages.decision?.approval.outcome ?? "incomplete"}`,
        ...review.failures.map(({ stage, reason }) => `${stage}: ${reason}`),
        `GitHub: ${publication.status}. ${publication.reason}`,
        publication.review
          ? `Submitted review: ${publication.review.state}`
          : "",
        publication.url ?? "",
      ]
        .filter(Boolean)
        .join("\n");
      break;
    }
  }

  // Setup must establish scope before any external notification starts.
  if (!snapshot.stages.setup) {
    return;
  }
  const statuses = reviewProgress(snapshot);
  if (event.type !== "tasksFinished") {
    for (const step of steps) {
      statuses[step] = status;
    }
  }
  if (event.type === "publicationFinished") {
    statuses.publication = event.publication.status;
  }
  if (event.type === "tasksFinished" && event.snapshot.failures.length) {
    status = "blocked";
  }
  return { statuses, stage: steps.join(", "), status, reason };
}

/**
 * Preserve checks and gaps in the report as expandable sections.
 */
export function coverageMarkdown(stages: StageResults): string {
  const lines = ["", "## Workflow assessment and rule coverage", ""];
  function fold(title: string, blocks: string[]): void {
    if (!blocks.length) {
      return;
    }
    lines.push(
      "<details>",
      `<summary>${title}</summary>`,
      "",
      blocks.join("\n\n"),
      "</details>",
      "",
    );
  }
  for (const [name, result] of Object.entries(stages)) {
    const blocks = result.checks.map((item) =>
      [
        `- ${item.item} — ${item.result}. Method: ${item.method}. Guidance: ${item.guidance}. ${item.reason}`,
        ...item.evidence.map((evidence) => `  - ${evidence}`),
      ].join("\n"),
    );
    blocks.push(...result.gaps.map((gap) => `- Coverage gap: ${gap}`));
    fold(name, blocks);
  }
  fold(
    "Rules",
    (stages.rules?.rules ?? []).map((item) =>
      [
        `- Rule ${item.path}: ${item.selection}, ${item.result}. ${item.reason}`,
        ...item.evidence.map((evidence) => `  - ${evidence}`),
      ].join("\n"),
    ),
  );
  return lines.join("\n");
}

/**
 * Accepted answers establish completed review steps; failures establish blocked
 * steps, including each parallel assessment.
 */
export function reviewProgress({
  stages,
  failures,
}: ReviewSnapshot): ProgressStatuses {
  const statuses: ProgressStatuses = {};
  for (const stage of stageNames) {
    if (stages[stage]) {
      statuses[stage] = "complete";
    }
    if (failures.some((failure) => failure.stage === stage)) {
      statuses[stage] = "blocked";
    }
  }
  return statuses;
}

/**
 * Describe actual work status without treating completed review work as passing.
 */
export function progressChecklist(statuses: ProgressStatuses): string {
  return Object.entries(statuses)
    .map(
      ([name, value]) =>
        `- [${value === "complete" ? "x" : " "}] ${name}: ${value}`,
    )
    .join("\n");
}
