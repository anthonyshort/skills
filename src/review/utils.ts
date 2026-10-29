/**
 * Text, quoting and host notification helpers shared by the review. Tool calls
 * occur only inside functions so Node commands can import the text utilities.
 */
import { z } from "zod";
import { NotificationAnswerSchema } from "./contracts.js";
import type {
  DeliveryState,
  ProgressUpdateInput,
  RequestHostNotificationInput,
  ReviewPublicationInput,
  StageResults,
} from "./contracts.js";

/**
 * Normalises thrown values for stage failures and notification diagnostics.
 */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Preserves every check and gap in the canonical report. Bounded detail folds
 * let the existing GitHub helper split a long report into continuation comments.
 */
export function coverageMarkdown(stages: StageResults): string {
  const lines = ["", "## Workflow assessment and rule coverage", ""];
  function folds(title: string, blocks: string[]) {
    let content = "";
    let part = 1;
    const flush = () => {
      if (!content) {
        return;
      }
      lines.push(
        "<details>",
        `<summary>${title} — part ${part++}</summary>`,
        "",
        content,
        "</details>",
        "",
      );
      content = "";
    };
    for (const block of blocks) {
      if (content.length + block.length > 40000) {
        flush();
      }
      content += block + "\n\n";
    }
    flush();
  }
  for (const [name, result] of Object.entries(stages)) {
    const blocks = result.checks.map((item) =>
      [
        `- ${item.item} — ${item.result}. Method: ${item.method}. Guidance: ${item.guidance}. ${item.reason}`,
        ...item.evidence.map((evidence) => `  - ${evidence}`),
      ].join("\n"),
    );
    blocks.push(...result.gaps.map((gap) => `- Coverage gap: ${gap}`));
    folds(name, blocks);
  }
  folds(
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
 * Detects accidental writer changes without putting the bundle in shell argv.
 * Both halves hash UTF-16 code units, so the VM and Node agree on non-BMP text.
 * This checksum is not a defence against a hostile writer.
 */
export function fingerprint(text: string): string {
  let first = 2166136261;
  let second = 3339675911;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619) >>> 0;
    second = Math.imul(second ^ code, 16777619) >>> 0;
  }
  return (
    first.toString(16).padStart(8, "0") + second.toString(16).padStart(8, "0")
  );
}

/**
 * Finish the host message with actual publication and approval confirmation.
 */
export async function sendFinalNotification({
  input,
  state,
  bundle,
  result,
}: ReviewPublicationInput): Promise<void> {
  if (!state.started) {
    return;
  }
  const publication = state.publication;
  await sendHostNotification({
    input,
    state,
    stage: "review",
    status: bundle.status,
    reason: [
      `Assessment: ${bundle.stages.decision?.approval.outcome ?? "incomplete"}`,
      ...bundle.failures.map(({ stage, reason }) => `${stage}: ${reason}`),
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
  });
}

/**
 * Stop host sends after a missing tool or scope change rather than creating
 * more messages. A rejected transport delivery alone can recover next stage.
 */
export async function sendHostNotification({
  input,
  state,
  stage,
  status,
  reason = "",
}: ProgressUpdateInput): Promise<void> {
  if (
    !state.hostNotifications ||
    !input.notification ||
    ["local-only", "staged"].includes(input.publication)
  ) {
    return;
  }
  const text = [
    `Review ${input.target}`,
    `Commit ${input.head.slice(0, 12)}`,
    ...Object.entries(state.statuses).map(
      ([name, value]) => `${name}: ${value}`,
    ),
    reason,
  ]
    .filter(Boolean)
    .join("\n");
  const receipt = await requestHostNotification({
    input,
    label: `${stage}:${status}`,
    text,
  });
  const prior = state.notifications.find((entry) => entry.receipt.broadcast)
    ?.receipt.broadcast;
  if (prior && receipt.broadcast && receipt.broadcast.scope !== prior.scope) {
    receipt.status = "uncertain";
    receipt.reason =
      "Host notification scope changed; further updates disabled to avoid creating more messages";
    state.hostNotifications = false;
  }
  if (!receipt.broadcast && receipt.status === "rejected") {
    state.hostNotifications = false;
  }
  state.notifications.push({ stage, status, receipt });
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
 * Describe actual work status without treating completed review work as passing.
 */
export function progressChecklist(state: DeliveryState): string {
  return Object.entries(state.statuses)
    .map(
      ([name, value]) =>
        `- [${value === "complete" ? "x" : " "}] ${name}: ${value}`,
    )
    .join("\n");
}

/**
 * Quote one argument for the host's POSIX command runner.
 */
export function quote(value: string): string {
  return "'" + value.replace(/'/g, "'\\''") + "'";
}
