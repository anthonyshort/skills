import { z } from "zod";
import { NotificationReceiptSchema } from "./contracts.js";
import type { ReviewInput, Bundle } from "./contracts.js";
import type { WorkflowHost } from "./host.js";
import { quote, message, supportCommand } from "./text.js";

export function createProgressReporter(input: ReviewInput, host: WorkflowHost) {
  const states: Record<string, string> = Object.fromEntries(
    [
      "setup",
      "research",
      "assessments",
      "rules",
      "consolidation",
      "draft",
      "editorial",
      "report",
      "save-artefacts",
    ].map((name) => [name, "pending"]),
  );
  const notifications: Bundle["notifications"] = [];
  const agent = host.agent;

  async function update(
    stageName: string,
    status: string,
    split = false,
  ): Promise<void> {
    states[stageName] = status;
    if (!input.notification && input.publication.mode !== "github") {
      return;
    }
    // Never retry uncertain external writes or treat notification failure as review failure.
    try {
      const names = split
        ? ["setup", "split-plan", "save-artefacts"]
        : Object.keys(states);
      const text = [
        `Review ${input.target}`,
        `Commit ${input.head.slice(0, 12)}`,
        "",
        ...names.map((name) => {
          const state = states[name] ?? "pending";
          const marker =
            state === "complete"
              ? "✓"
              : state === "blocked"
                ? "!"
                : state === "pending"
                  ? "○"
                  : "◉";
          return `${marker} ${name}: ${state}`;
        }),
      ].join("\n");
      const event = input.notification
        ? {
            action: "update",
            ...input.notification,
            eventKey: `${input.runId}:${stageName}:${status}`,
            text,
          }
        : null;
      const githubProgress =
        input.publication.mode === "github"
          ? `${supportCommand(input, "publication")} progress --input ${quote(JSON.stringify(input))} --states ${quote(JSON.stringify(states))}`
          : null;
      const receipt = await agent(
        [
          event
            ? "Call the host notify tool exactly once with the supplied event. This assumes the separately implemented notification update API. If unavailable, report rejected. Do not emulate it with bash or HTTP."
            : "",
          githubProgress
            ? `Update the existing GitHub progress comment by running exactly: ${githubProgress}`
            : "",
          "Do not send to other destinations, independently call HTTP APIs, or publish findings.",
          "Return the tool's actual delivery status and a reason. Do not retry uncertain delivery.",
          event ? JSON.stringify(event) : "",
        ]
          .filter(Boolean)
          .join("\n"),
        {
          label: `notify:${stageName}:${status}`,
          phase: "Progress",
          schema: z.toJSONSchema(NotificationReceiptSchema, {
            target: "draft-7",
          }),
        },
      );
      notifications.push({
        stage: stageName,
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
        stage: stageName,
        status,
        receipt: { status: "uncertain", reason: message(error) },
      });
    }
  }
  return { update, notifications };
}
