/**
 * Sends stage status through the existing host notification tool.
 * Destinations (including any GitHub adapter) belong to the host configuration.
 */
import { z } from "zod";
import { NotificationReceiptSchema } from "./contracts.js";
import type { ReviewInput, Bundle, WorkflowHost } from "./contracts.js";
import { errorMessage } from "./text.js";

/**
 * Owns one review’s status message and delivery diagnostics. A failed or uncertain
 * notification is recorded once and never causes an assessment to run again.
 */
export function createProgressReporter(input: ReviewInput, host: WorkflowHost) {
  const states: Record<string, string> = {};
  const notifications: Bundle["notifications"] = [];
  async function update(stage: string, status: string): Promise<void> {
    states[stage] = status;
    if (!input.notification) {
      return;
    }
    const event = {
      action: "update",
      ...input.notification,
      eventKey: `${input.runId}:${stage}:${status}`,
      text: statusMessage(input, states),
    };
    try {
      const receipt = await host.agent(
        [
          "Call the host notify tool exactly once with this event. If unavailable, report rejected.",
          "Do not emulate the tool with bash or HTTP, send elsewhere, or retry uncertain delivery.",
          "Return the actual tool status and reason.",
          JSON.stringify(event),
        ].join("\n"),
        {
          label: `notify:${stage}:${status}`,
          phase: "Progress",
          schema: z.toJSONSchema(NotificationReceiptSchema, {
            target: "draft-7",
          }),
        },
      );
      notifications.push({
        stage,
        status,
        receipt: NotificationReceiptSchema.parse(
          receipt ?? {
            status: "uncertain",
            reason: "Reporting agent failed or was skipped",
          },
        ),
      });
    } catch (error) {
      notifications.push({
        stage,
        status,
        receipt: { status: "uncertain", reason: errorMessage(error) },
      });
    }
  }
  return { update, notifications };
}

/**
 * Keeps one message’s history readable without requiring transport-specific code.
 */
function statusMessage(
  input: ReviewInput,
  states: Record<string, string>,
): string {
  return [
    `Review ${input.target}`,
    `Commit ${input.head.slice(0, 12)}`,
    "",
    ...Object.entries(states).map(([stage, status]) => `${stage}: ${status}`),
  ].join("\n");
}
