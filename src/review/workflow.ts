/**
 * Compose the review sequence and delivery subscribers in Pi's workflow VM.
 */
import {
  createWorkflowRun,
  WorkflowEvents,
  WorkflowTaskFailure,
} from "../workflow/run.js";
import { parseReviewInput } from "./contracts.js";
import type {
  ReviewInput,
  ReviewResults,
  ReviewEvent,
  ReviewEventEmitter,
  ReviewRun,
  ReviewOutput,
} from "./contracts.js";
import { createGithubComment } from "./github.js";
import { createNotifications } from "./notifications.js";
import { coverageMarkdown } from "./utils.js";
import {
  setupReview,
  researchReview,
  checkResearch,
  assessProduct,
  assessSystemFit,
  assessSimplicity,
  assessReadability,
  assessCorrectness,
  checkRules,
  consolidateReview,
  draftReport,
  editReport,
  acceptReport,
  planSplit,
  decideReview,
} from "./steps.js";
import type { ReviewContext } from "./steps.js";

/**
 * Official Pi workflow metadata. The build copies this literal into the generated
 * script header so Pi can read it before executing the coordinator.
 */
export const meta = {
  name: "review",
  description:
    "Experimental pinned review with required assessments and a validated report",
};

/**
 * Compose review execution and channel subscribers for one run.
 */
export async function runReviewWorkflow(args: unknown): Promise<ReviewOutput> {
  const input = parseReviewInput(args);

  const events = new WorkflowEvents<ReviewEvent>();

  // Notifications can subscribe first: final publication has its own event.
  const notifications = createNotifications({ input, events });
  const githubComment = createGithubComment({ input, events });

  // The review knows only how to emit facts, not which objects observe them.
  const review = await executeWorkflow({ input, events });

  // Completion passes accepted values directly to the publication subscriber.
  await events.emit({ type: "reviewCompleted", review });

  // Return the report, partial evidence and delivery outcomes without file IO.
  return {
    ...review,
    report:
      review.stages.report?.markdown ??
      review.stages.splitPlan?.markdown ??
      null,
    approval: review.stages.decision?.approval ?? null,
    publication: githubComment.publication,
    notifications: notifications.receipts,
  };
}

/**
 * Declare the full or split-only review order using concrete named steps.
 * The shared runner owns acceptance and lifecycle; review policy stays here.
 */
async function executeWorkflow({
  input,
  events,
}: {
  input: ReviewInput;
  events: ReviewEventEmitter;
}): Promise<ReviewRun> {
  const attempts: ReviewRun["attempts"] = [];
  const steps = createWorkflowRun<ReviewContext, ReviewResults>({
    input: { review: input, attempts },
    events,
  });

  try {
    const [setup] = await steps.run([{ name: "setup", execute: setupReview }]);
    switch (setup.mode) {
      case "split":
        // Oversized reviews produce a split plan without full assessments.
        await steps.run([{ name: "splitPlan", execute: planSplit }]);
        break;
      case "full":
        // Check research before the parallel barrier; reconcile before reporting.
        await steps.run([{ name: "research", execute: researchReview }]);
        await steps.run([{ name: "researchCheck", execute: checkResearch }]);
        await steps.run([
          { name: "product", execute: assessProduct },
          { name: "systemFit", execute: assessSystemFit },
          { name: "simplicity", execute: assessSimplicity },
          { name: "readability", execute: assessReadability },
          { name: "correctness", execute: assessCorrectness },
        ]);
        await steps.run([{ name: "rules", execute: checkRules }]);
        await steps.run([
          { name: "consolidation", execute: consolidateReview },
        ]);
        await steps.run([{ name: "draft", execute: draftReport }]);
        await steps.run([{ name: "editorial", execute: editReport }]);
        await steps.run([{ name: "report", execute: acceptReport }]);
        break;
    }
    await steps.run([{ name: "decision", execute: decideReview }]);
  } catch (error) {
    // Recorded task failures stop dependent work and return partial evidence.
    // Unexpected observer failures propagate instead of claiming completion.
    if (!(error instanceof WorkflowTaskFailure)) {
      throw error;
    }
  }

  const execution = steps.result();
  const stages = { ...execution.results };
  const status = execution.failures.length
    ? "incomplete"
    : stages.setup?.mode === "split"
      ? "split"
      : "complete";
  if (status === "complete" && stages.report) {
    stages.report = {
      ...stages.report,
      markdown: stages.report.markdown + coverageMarkdown(stages),
    };
  }
  return {
    input,
    status,
    stages,
    failures: execution.failures.map(({ name, reason }) => ({
      stage: name,
      reason,
    })),
    attempts,
  };
}
