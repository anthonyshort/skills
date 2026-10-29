/**
 * Own keyed host notifications and their delivery receipts for one review.
 */
import * as z from "zod";
import type { WorkflowPlugin } from "../workflow/create.js";
import type { ReviewInput, ReviewEvent } from "./schemas.js";
import { errorMessage } from "../workflow/run.js";
import { reviewEventProgress } from "./utils.js";

const text = z
  .string()
  .min(1)
  .refine((value) => Boolean(value.trim()), "Expected non-empty text");

/**
 * Receipt returned by the host's keyed notification broadcast. The host chooses
 * destinations from the authenticated session; callers supply no recipient.
 */
const NotificationBroadcastSchema = z.object({
  scope: text,
  messageKey: text.optional(),
  deliveries: z
    .array(
      z.object({
        deliveryId: text,
        destination: text,
        status: z.enum(["in-flight", "confirmed", "rejected", "uncertain"]),
        externalId: z.string().nullable(),
        duplicate: z.boolean(),
      }),
    )
    .max(100),
});

/**
 * Review-specific response shape for notification workers.
 * Pi supplies StructuredOutput; these response fields belong to our workflow.
 */
const NotificationAnswerSchema = z.strictObject({
  broadcast: NotificationBroadcastSchema.nullable(),
  reason: z.string().min(1),
});
export type Notification = {
  stage: string;
  status: string;
  receipt: z.infer<typeof NotificationAnswerSchema> & {
    status: "confirmed" | "rejected" | "uncertain";
  };
};

/**
 * Subscribe to review progress and publication outcomes. Delivery receipts and
 * the host-availability latch belong to this object, not review execution.
 */
export const createNotifications = (({ input, events }) => {
  const receipts: Notification[] = [];
  let enabled = true;

  events.subscribe(async (event) => {
    const progress = reviewEventProgress(event);
    if (progress) {
      await sendHostNotification(progress);
    }
  });

  /**
   * Stop host sends after a missing tool or scope change rather than creating
   * more messages. A rejected transport delivery alone can recover next stage.
   */
  async function sendHostNotification({
    statuses,
    stage,
    status,
    reason,
  }: NonNullable<ReturnType<typeof reviewEventProgress>>): Promise<void> {
    if (!enabled || !input.notification || input.publication === "local-only") {
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
      label: `${stage}:${status}`,
      text,
    });
    const prior = receipts.find((entry) => entry.receipt.broadcast)?.receipt
      .broadcast;
    if (prior && receipt.broadcast && receipt.broadcast.scope !== prior.scope) {
      receipt.status = "uncertain";
      receipt.reason =
        "Host notification scope changed; further updates disabled to avoid creating more messages";
      enabled = false;
    }
    if (!receipt.broadcast && receipt.status === "rejected") {
      enabled = false;
    }
    receipts.push({ stage, status, receipt });
  }

  /**
   * Use the host broadcast API, whose authenticated scope selects destinations.
   * Return actual tool receipts; no HTTP or shell fallback invents delivery.
   */
  async function requestHostNotification({
    label,
    text,
  }: {
    label: string;
    text: string;
  }) {
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
          schema: z.toJSONSchema(NotificationAnswerSchema, {
            target: "draft-7",
          }),
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

  return {
    get receipts() {
      return receipts;
    },
  };
}) satisfies WorkflowPlugin<
  ReviewInput,
  ReviewEvent,
  { readonly receipts: Notification[] }
>;
