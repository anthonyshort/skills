/**
 * Sends workflow progress and publishes validated output through existing tools.
 * Delivery failures never repeat review work or imply confirmed approval.
 */
import { z } from "zod";
import {
  NotificationAnswerSchema,
  PublicationResultSchema,
} from "./contracts.js";
import type {
  Bundle,
  DeliveryState,
  GitHubRequest,
  PublicationResult,
  ReviewInput,
  ReviewResult,
} from "./contracts.js";
import { errorMessage } from "./text.js";

/**
 * Distinguishes an absent or disabled destination from publication still to do.
 */
export function initialPublication(input: ReviewInput): PublicationResult {
  const enabled = githubEnabled(input);
  return {
    status: enabled ? "pending" : "skipped",
    reason: !input.github
      ? "No pull request supplied"
      : enabled
        ? "Publication has not finished"
        : `${input.publication} output requested`,
    url: null,
    approval: null,
    statePath: enabled ? `${input.artifacts}/github.json` : null,
    newerCommits: false,
  };
}

/**
 * Start external updates only after setup accepts the pinned scope and route.
 */
export async function startProgress(
  input: ReviewInput,
  state: DeliveryState,
  mode: "full" | "split",
): Promise<void> {
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
  for (const stage of stages) state.statuses[stage] = "pending";
  state.started = true;
  await updateProgress(input, state, "setup", "complete");
}

/**
 * Update destinations independently so one failure cannot suppress the other.
 * GitHub calls are sequential because they share the helper's saved state.
 */
export async function updateProgress(
  input: ReviewInput,
  state: DeliveryState,
  stage: string,
  status: string,
  reason?: string,
): Promise<void> {
  state.statuses[stage] = status;
  if (!state.started) return;
  if (githubEnabled(input)) {
    const blocked = Object.entries(state.statuses).find(
      ([, value]) => value === "blocked",
    );
    const operation =
      state.githubSequence === 0 ? "start" : blocked ? "interrupt" : "update";
    await sendGitHub(
      input,
      state,
      operation,
      checklist(state),
      blocked ? (reason ?? `${blocked[0]} is blocked`) : "",
    );
  }
  await sendHostNotification(input, state, stage, status, reason);
}

/**
 * Publish only accepted saved files; the Node bridge repeats their validation.
 * A refused publication still updates progress while retaining its own reason.
 */
export async function publishAcceptedReview(
  input: ReviewInput,
  state: DeliveryState,
  bundle: Bundle,
  result: ReviewResult,
): Promise<PublicationResult> {
  if (!state.started) {
    state.publication = {
      ...state.publication,
      status: "skipped",
      reason: "Setup was not accepted; no external delivery started",
    };
    return state.publication;
  }
  if (bundle.status !== "incomplete")
    await updateProgress(input, state, "publication", "running");
  if (githubEnabled(input)) {
    if (bundle.status === "incomplete") {
      await sendGitHub(
        input,
        state,
        "interrupt",
        checklist(state),
        bundle.failures
          .map((failure) => `${failure.stage}: ${failure.reason}`)
          .join("; "),
      );
    } else {
      if (!result.reportPath)
        throw new Error("Publication requires validated saved output");
      // The helper unchecks this final row until publication succeeds.
      const finalChecklist = checklist(state).replace(
        /^- \[[ x]\] publication: .+$/m,
        "- [x] publication: complete",
      );
      await sendGitHub(
        input,
        state,
        "finish",
        finalChecklist,
        "",
        result.fingerprint,
      );
      const publication = state.publication;
      if (publication.status === "rejected") {
        await updateProgress(
          input,
          state,
          "publication",
          "blocked",
          publication.reason,
        );
        state.publication = publication;
      }
    }
  }
  state.statuses.publication = state.publication.status;
  state.statuses.review = bundle.status;
  return state.publication;
}

/**
 * Finish the host message with actual publication and approval confirmation.
 */
export async function sendFinalNotification(
  input: ReviewInput,
  state: DeliveryState,
  bundle: Bundle,
  result: ReviewResult,
): Promise<void> {
  if (!state.started) return;
  const publication = state.publication;
  await sendHostNotification(
    input,
    state,
    "review",
    bundle.status,
    [
      `Assessment: ${bundle.stages.decision?.approval.outcome ?? "incomplete"}`,
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
}

/**
 * Keep one helper state file and one operation receipt per scheduled worker.
 * Unknown delivery is recorded once and recovered later through the helper.
 */
async function sendGitHub(
  input: ReviewInput,
  state: DeliveryState,
  operation: GitHubRequest["operation"],
  progress: string,
  reason = "",
  fingerprint: string | null = null,
): Promise<void> {
  const request: GitHubRequest = {
    input,
    operation,
    id: `${input.invocationId}-${++state.githubSequence}`,
    checklist: progress,
    reason,
    fingerprint,
  };
  const command = [
    "node",
    "--import",
    quote(input.tsxLoader),
    quote(`${input.supportRoot}/github.ts`),
    quote(JSON.stringify(request)),
  ].join(" ");
  try {
    const answer = await agent(
      [
        "Execute this exact review delivery command once. Do not modify accepted files or publish through any other tool.",
        operation === "finish"
          ? `Before publishing, refresh discussion and relevant CI as required by ${input.skillRoot}/criteria.md#step-6-publish-results. If new facts invalidate the accepted assessment, execute the command with --reject followed by one shell-quoted reason instead. This records refusal without publishing. Return its actual rejected result and request a refreshed assessment. Never change the saved decision to force publication.`
          : "Do not review source or change the assessment.",
        "Return the command's actual JSON result through StructuredOutput. If it fails or its outcome is unknown, report uncertain with the error and saved state path. Do not retry.",
        `State path: ${input.artifacts}/github.json`,
        `GitHub request: ${JSON.stringify(request)}`,
        command,
      ].join("\n"),
      {
        label: `github:${operation}:${state.githubSequence}`,
        phase: "Publication",
        schema: z.toJSONSchema(PublicationResultSchema, { target: "draft-7" }),
        gate: `${command} --check`,
      },
    );
    if (answer === null)
      throw new Error(
        "GitHub worker failed or was skipped; delivery may have completed",
      );
    state.publication = PublicationResultSchema.parse(answer);
  } catch (error) {
    state.publication = {
      ...state.publication,
      status: "uncertain",
      reason: `${errorMessage(error)}. Inspect ${input.artifacts}/github.json before retrying publication.`,
    };
  }
}

/**
 * Stop host sends after a missing tool or scope change rather than creating
 * more messages. A rejected transport delivery alone can recover next stage.
 */
async function sendHostNotification(
  input: ReviewInput,
  state: DeliveryState,
  stage: string,
  status: string,
  detail = "",
): Promise<void> {
  if (
    !state.hostNotifications ||
    !input.notification ||
    ["local-only", "staged"].includes(input.publication)
  )
    return;
  const text = [
    `Review ${input.target}`,
    `Commit ${input.head.slice(0, 12)}`,
    ...Object.entries(state.statuses).map(
      ([name, value]) => `${name}: ${value}`,
    ),
    detail,
  ]
    .filter(Boolean)
    .join("\n");
  const receipt = await requestHostNotification(
    input,
    `${stage}:${status}`,
    text,
  );
  const prior = state.notifications.find((entry) => entry.receipt.broadcast)
    ?.receipt.broadcast;
  if (prior && receipt.broadcast && receipt.broadcast.scope !== prior.scope) {
    receipt.status = "uncertain";
    receipt.reason =
      "Host notification scope changed; further updates disabled to avoid creating more messages";
    state.hostNotifications = false;
  }
  if (!receipt.broadcast && receipt.status === "rejected")
    state.hostNotifications = false;
  state.notifications.push({ stage, status, receipt });
}

/**
 * Use the host broadcast API, whose authenticated scope selects destinations.
 * Return actual tool receipts; no HTTP or shell fallback invents delivery.
 */
async function requestHostNotification(
  input: ReviewInput,
  label: string,
  text: string,
) {
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
    if (!broadcast || broadcast.deliveries.length === 0)
      return { status: "rejected" as const, reason, broadcast };
    if (broadcast.messageKey !== input.notification?.messageKey)
      throw new Error("Notification receipt has a different message key");
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
function checklist(state: DeliveryState): string {
  return Object.entries(state.statuses)
    .map(
      ([name, value]) =>
        `- [${value === "complete" ? "x" : " "}] ${name}: ${value}`,
    )
    .join("\n");
}

function githubEnabled(input: ReviewInput): boolean {
  return (
    Boolean(input.github) &&
    !["local-only", "staged"].includes(input.publication)
  );
}

/**
 * Quote one argument for the host's POSIX command runner.
 */
function quote(value: string): string {
  return "'" + value.replace(/'/g, "'\\''") + "'";
}
