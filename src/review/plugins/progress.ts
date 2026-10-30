/**
 * Derive the shared progress view consumed by GitHub and host notifications.
 */
import type { ReviewEvent, ReviewResult } from "../workflow.js";
import type { StageName } from "../steps.js";
import type { PublicationResult } from "./github/index.js";

type ProgressStep = StageName | "publication" | "review";
type ProgressStatus =
  | ReviewResult["status"]
  | PublicationResult["status"]
  | "running"
  | "blocked";
export type ProgressStatuses = Partial<Record<ProgressStep, ProgressStatus>>;
type ReviewSnapshot = Pick<ReviewResult, "stages" | "failures">;

/**
 * Derive progress without retaining state. workflowCompleted carries plugin
 * outcomes after all completion hooks, so final notifications include delivery.
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
    case "workflowCompleted": {
      const review = event.result;
      const { publication } = event.plugins.github;
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
  if (event.type === "workflowCompleted") {
    statuses.publication = event.plugins.github.publication.status;
  }
  if (event.type === "tasksFinished" && event.snapshot.failures.length) {
    status = "blocked";
  }
  return { statuses, stage: steps.join(", "), status, reason };
}

/**
 * Accepted answers establish completed review steps; failures establish blocked
 * steps, including each parallel assessment.
 */
export function reviewProgress({
  stages,
  failures,
}: ReviewSnapshot): ProgressStatuses {
  const statuses: ProgressStatuses = Object.fromEntries(
    Object.keys(stages).map((name) => [name, "complete"] as const),
  );
  for (const { stage } of failures) {
    statuses[stage] = "blocked";
  }
  return statuses;
}
