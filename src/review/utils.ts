/**
 * Text, progress and host notification helpers shared by the review.
 * Tool calls occur only inside functions.
 */
import * as z from "zod";
import {
  assessmentNames,
  stageNames,
  NotificationAnswerSchema,
} from "./contracts.js";
import type {
  NotificationUpdateInput,
  RequestHostNotificationInput,
  ProgressStatuses,
  ReviewProgressInput,
  StageResults,
  ReviewEvent,
  ReviewEventEmitter,
  ReviewEventHandler,
  ReviewEventProgress,
  ReviewInput,
  ReviewNotifications,
  NotificationState,
  ReviewSnapshot,
  ProgressStep,
  ProgressStatus,
} from "./contracts.js";

/**
 * Await observers in subscription order. A listener may emit another event;
 * that nested event finishes before the original emission continues.
 */
export class ReviewEvents implements ReviewEventEmitter {
  private readonly handlers: ReviewEventHandler[] = [];

  /**
   * Register one observer for this run. Subscriptions live only for the run.
   */
  subscribe(handler: ReviewEventHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Finish observer work before the producer advances to its next step.
   */
  async emit(event: ReviewEvent): Promise<void> {
    for (const handler of this.handlers) {
      await handler(event);
    }
  }
}

/**
 * Subscribe to review progress and publication outcomes. Delivery receipts and
 * the host-availability latch belong to this object, not review execution.
 */
export function createNotifications({
  input,
  events,
}: {
  input: ReviewInput;
  events: ReviewEventEmitter;
}): ReviewNotifications {
  const state: NotificationState = { receipts: [], enabled: true };
  events.subscribe(async (event) => {
    const progress = reviewEventProgress(event);
    if (!progress) {
      return;
    }
    await sendHostNotification({ input, state, ...progress });
  });
  return {
    get receipts() {
      return state.receipts;
    },
  };
}

/**
 * Render a shared progress view without delivery or retained state. reviewCompleted requests publication;
 * only publicationFinished has the outcome needed for a final notification.
 */
export function reviewEventProgress(
  event: ReviewEvent,
): ReviewEventProgress | undefined {
  let snapshot: ReviewSnapshot;
  let stage: ProgressStep;
  let status: ProgressStatus;
  let reason = "";

  switch (event.type) {
    case "reviewCompleted":
      return;
    case "stepStarted":
      snapshot = event.snapshot;
      stage = event.step;
      status = "running";
      break;
    case "stepAccepted":
      snapshot = event.snapshot;
      stage = event.step;
      status = "complete";
      break;
    case "stepFailed":
      snapshot = event.snapshot;
      stage = event.step;
      status = "blocked";
      reason = event.reason;
      break;
    case "publicationFinished": {
      const { review } = event;
      const { publication } = event;
      snapshot = review;
      stage = "review";
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
  const statuses: ProgressStatuses = {
    ...reviewProgress(snapshot),
    [stage]: status,
  };
  if (event.type === "publicationFinished") {
    statuses.publication = event.publication.status;
  }
  return { statuses, stage, status, reason };
}

/**
 * Normalises thrown values for stage failures and notification diagnostics.
 */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
 * Stop host sends after a missing tool or scope change rather than creating
 * more messages. A rejected transport delivery alone can recover next stage.
 */
async function sendHostNotification({
  input,
  state,
  statuses,
  stage,
  status,
  reason = "",
}: NotificationUpdateInput): Promise<void> {
  if (
    !state.enabled ||
    !input.notification ||
    input.publication === "local-only"
  ) {
    return;
  }
  const text = [
    `Review ${input.target}`,
    `Commit ${input.head.slice(0, 12)}`,
    ...Object.entries(statuses).map(([name, value]) => `${name}: ${value}`),
    reason,
  ]
    .filter(Boolean)
    .join("\n");
  const receipt = await requestHostNotification({
    input,
    label: `${stage}:${status}`,
    text,
  });
  const prior = state.receipts.find((entry) => entry.receipt.broadcast)?.receipt
    .broadcast;
  if (prior && receipt.broadcast && receipt.broadcast.scope !== prior.scope) {
    receipt.status = "uncertain";
    receipt.reason =
      "Host notification scope changed; further updates disabled to avoid creating more messages";
    state.enabled = false;
  }
  if (!receipt.broadcast && receipt.status === "rejected") {
    state.enabled = false;
  }
  state.receipts.push({ stage, status, receipt });
}

/**
 * Use the host broadcast API, whose authenticated scope selects destinations.
 * Return actual tool receipts; no HTTP or shell fallback invents delivery.
 */
async function requestHostNotification({
  input,
  label,
  text,
}: RequestHostNotificationInput) {
  try {
    const output = await agent(
      [
        "Call the host notify tool exactly once with the JSON below. If the tool is unavailable, return broadcast:null and explain why.",
        "Do not emulate it with bash, HTTP or another tool. Do not add a destination or retry uncertain delivery.",
        "Return the exact broadcast response from the tool, including scope and every delivery receipt. Do not invent confirmation.",
        JSON.stringify({
          action: "send",
          messageKey: input.notification?.messageKey,
          text,
        }),
      ].join("\n"),
      {
        label: `notify:${label}`,
        phase: "Progress",
        schema: z.toJSONSchema(NotificationAnswerSchema, { target: "draft-7" }),
      },
    );
    const { broadcast, reason } = NotificationAnswerSchema.parse(output);
    if (!broadcast || broadcast.deliveries.length === 0) {
      return { status: "rejected" as const, reason, broadcast };
    }
    if (broadcast.messageKey !== input.notification?.messageKey) {
      throw new Error("Notification receipt has a different message key");
    }
    const statuses = broadcast.deliveries.map((delivery) => delivery.status);
    const status = statuses.every((value) => value === "confirmed")
      ? ("confirmed" as const)
      : statuses.every((value) => value === "rejected")
        ? ("rejected" as const)
        : ("uncertain" as const);
    return { status, reason, broadcast };
  } catch (error) {
    return {
      status: "uncertain" as const,
      reason: errorMessage(error),
      broadcast: null,
    };
  }
}

/**
 * Accepted answers establish completed review steps; failures establish blocked
 * steps.
 * The five assessments share one row and complete only as a full set.
 */
export function reviewProgress({
  stages,
  failures,
}: ReviewProgressInput): ProgressStatuses {
  const statuses: ProgressStatuses = {};
  for (const stage of stageNames) {
    if (assessmentNames.some((name) => name === stage)) {
      if (assessmentNames.every((name) => stages[name])) {
        statuses.assessments = "complete";
      }
    } else if (stages[stage]) {
      statuses[stage] = "complete";
    }
    if (failures.some((failure) => failure.stage === stage)) {
      statuses[stage] = "blocked";
    }
  }
  if (failures.some((failure) => failure.stage === "assessments")) {
    statuses.assessments = "blocked";
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
