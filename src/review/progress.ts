/**
 * Owns workflow progress through the host notification tool and GitHub helper.
 * Delivery failures are recorded without repeating any review assessment.
 */
import { z } from "zod";
import { NotificationBroadcastSchema } from "./contracts.js";
import type {
  ReviewInput,
  Bundle,
  ReviewResult,
  WorkflowHost,
} from "./contracts.js";
import { createGitHubPublisher } from "./publication.js";
import { errorMessage } from "./text.js";

const notificationAnswer = z.strictObject({
  broadcast: NotificationBroadcastSchema.nullable(),
  reason: z.string().min(1),
});

/**
 * Starts external progress only after setup accepts the pinned review scope.
 * Final publication is separate from updates because it consumes gated files.
 */
export function createProgressReporter(input: ReviewInput, host: WorkflowHost) {
  const states: Record<string, string> = {};
  const notifications: Bundle["notifications"] = [];
  const github = createGitHubPublisher(host, input);
  let started = false;
  let hostNotifications = true;

  async function notify(stage: string, status: string, detail = "") {
    if (
      !hostNotifications ||
      !input.notification ||
      ["local-only", "staged"].includes(input.publication)
    ) {
      return;
    }
    const receipt = await sendNotification(
      host,
      input,
      `${stage}:${status}`,
      statusMessage(input, states, detail),
    );
    const prior = notifications.find((entry) => entry.receipt.broadcast)
      ?.receipt.broadcast;
    if (prior && receipt.broadcast && receipt.broadcast.scope !== prior.scope) {
      receipt.status = "uncertain";
      receipt.reason =
        "Host notification scope changed; further updates disabled to avoid creating more messages";
      hostNotifications = false;
    }
    if (!receipt.broadcast && receipt.status === "rejected")
      hostNotifications = false;
    notifications.push({ stage, status, receipt });
  }

  async function update(
    stage: string,
    status: string,
    reason?: string,
  ): Promise<void> {
    states[stage] = status;
    if (!started) return;
    const checklist = Object.entries(states)
      .map(
        ([name, state]) =>
          `- [${state === "complete" ? "x" : " "}] ${name}: ${state}`,
      )
      .join("\n");
    const blocked = Object.entries(states).find(
      ([, state]) => state === "blocked",
    );
    await github.update(
      checklist,
      blocked ? (reason ?? `${blocked[0]} is blocked`) : undefined,
    );
    await notify(stage, status, reason);
  }

  return {
    update,
    notifications,
    async start(mode: "full" | "split") {
      const stages =
        mode === "split"
          ? ["split-plan", "decision", "save-artefacts", "publication"]
          : [
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
      for (const stage of stages) states[stage] = "pending";
      started = true;
      await update("setup", "complete");
    },
    async interrupt(reason: string) {
      if (!started || states["save-artefacts"] === "blocked") return;
      await update("save-artefacts", "blocked", reason);
    },
    async finish(
      bundle: Bundle,
      result: ReviewResult,
      validationCommand: string,
    ) {
      if (!started)
        return {
          ...github.result,
          status: "skipped" as const,
          reason: "Setup was not accepted; no external delivery started",
        };
      if (bundle.status !== "incomplete")
        await update("publication", "running");
      const publication = await github.finish(
        bundle,
        result,
        validationCommand,
      );
      if (publication.status === "rejected" && bundle.status !== "incomplete") {
        await update("publication", "blocked", publication.reason);
      }
      states.publication = publication.status;
      const outcome = bundle.stages.decision?.approval.outcome ?? "incomplete";
      states.review = bundle.status;
      await notify(
        "review",
        bundle.status,
        [
          `Assessment: ${outcome}`,
          `Report: ${result.reportPath ?? `${input.artifacts}/incomplete.md`}`,
          `GitHub: ${publication.status}. ${publication.reason}`,
          publication.url ?? "",
          publication.approval
            ? `Approval submission: ${publication.approval.status}`
            : "",
          publication.newerCommits ? "Newer commits are not reviewed." : "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
      return publication;
    },
  };
}

/**
 * Uses the actual host broadcast API. The authenticated host selects channels;
 * a stable message key edits existing messages within that same host scope.
 */
async function sendNotification(
  host: WorkflowHost,
  input: ReviewInput,
  label: string,
  text: string,
) {
  try {
    const output = await host.agent(
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
        schema: z.toJSONSchema(notificationAnswer, { target: "draft-7" }),
      },
    );
    const { broadcast, reason } = notificationAnswer.parse(output);
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
 * Keeps one status message readable and includes confirmed final delivery details.
 */
function statusMessage(
  input: ReviewInput,
  states: Record<string, string>,
  detail: string,
): string {
  return [
    `Review ${input.target}`,
    `Commit ${input.head.slice(0, 12)}`,
    "",
    ...Object.entries(states).map(([stage, status]) => `${stage}: ${status}`),
    detail,
  ]
    .filter((line) => line !== "")
    .join("\n");
}
