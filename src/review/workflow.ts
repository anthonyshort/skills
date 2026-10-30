/**
 * Compose the review sequence and delivery subscribers in Pi's workflow VM.
 */
import { createWorkflow } from "../workflow/create.js";
import type { WorkflowSnapshot, WorkflowSteps } from "../workflow/run.js";
import { parseReviewInput } from "./input.js";
import type { ReviewInput } from "./input.js";
import type { WorkflowEvent } from "../workflow/run.js";
import type { WorkflowCompleted } from "../workflow/create.js";
import type { PublicationResult } from "./plugins/github/index.js";
import type { Notification } from "./plugins/notifications/index.js";
import { createGithubComment } from "./plugins/github/index.js";
import { createNotifications } from "./plugins/notifications/index.js";
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
import type {
  ReviewContext,
  ReviewResults,
  StageResults,
  StageName,
} from "./steps.js";

/**
 * Computed review output. Worker and transport responses are parsed at their
 * boundaries; this object contains the values already accepted by the workflow.
 */
export type ReviewResult = {
  input: ReviewInput;
  status: "complete" | "split" | "incomplete";
  stages: StageResults;
  failures: { stage: StageName; reason: string }[];
  attempts: ReviewContext["attempts"];
  report: string | null;
  approval: ReviewResults["decision"]["approval"] | null;
};

export type ReviewPluginResults = {
  github: { readonly publication: PublicationResult };
  notifications: { readonly receipts: Notification[] };
};

export type ReviewOutput = ReviewResult & {
  notifications: Notification[];
  publication: PublicationResult;
};

export type ReviewEvent =
  | WorkflowEvent<ReviewResults>
  | WorkflowCompleted<ReviewResult, ReviewPluginResults>;

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
 * Plugin functions receive fresh input and events for every workflow execution.
 */
const workflow = createWorkflow({
  input: {
    parse: (args: unknown): ReviewContext => ({
      review: parseReviewInput(args),
      attempts: [],
    }),
  },
  plugins: {
    notifications: createNotifications,
    github: createGithubComment,
  },
  execute: executeWorkflow,
  finalize: finalizeReview,
});

/**
 * Preserve the review's public output while the factory owns the run lifecycle.
 */
export async function runReviewWorkflow(args: unknown): Promise<ReviewOutput> {
  const { result, plugins } = await workflow.run(args);
  return {
    ...result,
    publication: plugins.github.publication,
    notifications: plugins.notifications.receipts,
  };
}

/**
 * Declare the full or split-only review order using concrete named steps.
 */
async function executeWorkflow({
  steps,
}: {
  input: ReviewContext;
  steps: WorkflowSteps<ReviewContext, ReviewResults>;
}): Promise<void> {
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
      await steps.run([{ name: "consolidation", execute: consolidateReview }]);
      await steps.run([{ name: "draft", execute: draftReport }]);
      await steps.run([{ name: "editorial", execute: editReport }]);
      await steps.run([{ name: "report", execute: acceptReport }]);
      break;
  }
  await steps.run([{ name: "decision", execute: decideReview }]);
}

/**
 * Interpret accepted evidence and partial failures using review-specific policy.
 */
function finalizeReview({
  input,
  execution,
}: {
  input: ReviewContext;
  execution: WorkflowSnapshot<ReviewResults>;
}): ReviewResult {
  const stages = { ...execution.results };
  const status = execution.failures.length
    ? "incomplete"
    : stages.setup?.mode === "split"
      ? "split"
      : "complete";
  if (status === "complete" && stages.report) {
    stages.report = {
      ...stages.report,
      markdown: stages.report.markdown + renderReviewEvidenceAppendix(stages),
    };
  }
  return {
    input: input.review,
    status,
    stages,
    report: stages.report?.markdown ?? stages.splitPlan?.markdown ?? null,
    approval: stages.decision?.approval ?? null,
    failures: execution.failures.map(({ name, reason }) => ({
      stage: name,
      reason,
    })),
    attempts: input.attempts,
  };
}

/**
 * Render assessment checklists, evidence gaps and rule results as collapsible
 * sections appended to the final report.
 */
function renderReviewEvidenceAppendix(stages: StageResults): string {
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
