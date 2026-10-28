import { lstat, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import type { Bundle, ReviewInput } from "../contracts.js";
import { message } from "../text.js";
import { commandJson } from "./commands.js";
import { exists, readJson, requireCondition, saveJson } from "./files.js";
import {
  LivePullSchema,
  PreviewSchema,
  ProgressStateSchema,
  RemoteCommentSchema,
  RemoteReviewSchema,
} from "./publication-models.js";
import type { PublicationReceipt } from "./publication-models.js";
import { loadValidatedReview, publicationDigest } from "./validate.js";

type Options = {
  env?: NodeJS.ProcessEnv;
};

export function checklist(states: Record<string, string>): string {
  return (
    Object.entries(states)
      .map(
        ([name, status]) =>
          `- [${status === "complete" ? "x" : " "}] ${name}: ${status}`,
      )
      .join("\n") + "\n"
  );
}

/**
 * Keep accepted artefacts, original helper writes and remote verification separate.
 */
export function createPublisher(options: Options = {}) {
  const env = options.env ?? process.env;
  const api = (endpoint: string) =>
    commandJson("gh", ["api", "--method", "GET", endpoint], env);

  async function liveTarget(input: ReviewInput): Promise<void> {
    requireCondition(
      input.publication.mode === "github",
      "Live target checks require GitHub publication",
    );
    const target = input.publication;
    const pull = LivePullSchema.parse(
      await api(`repos/${target.repository}/pulls/${target.prNumber}`),
    );
    requireCondition(
      pull.head.sha === input.head,
      "The live PR head changed; stop before publishing and review the new revision",
    );
    requireCondition(
      pull.base.sha === input.base,
      "The live PR base changed; stop before publishing and review the new comparison",
    );
    requireCondition(
      pull.state === "open" && !pull.merged,
      "The PR is no longer open",
    );
  }

  function helper(input: ReviewInput, arguments_: string[]): Promise<unknown> {
    return commandJson(
      "python3",
      [
        path.join(input.skillRoot, "scripts/github_progress.py"),
        "--state",
        path.join(input.artifacts, "progress.json"),
        ...arguments_,
      ],
      env,
    );
  }

  function finishArguments(root: string): string[] {
    return [
      "finish",
      "--summary",
      path.join(root, "summary.md"),
      "--report",
      path.join(root, "review-report.md"),
      "--inline",
      path.join(root, "inline.json"),
      "--approval",
      path.join(root, "approval.json"),
      "--checklist",
      path.join(root, "progress.md"),
    ];
  }

  async function progress(
    input: ReviewInput,
    states: Record<string, string>,
  ): Promise<PublicationReceipt> {
    requireCondition(
      input.publication.mode === "github",
      "Live progress requires explicit GitHub publication",
    );
    const root = input.artifacts;
    await mkdir(root, { recursive: true, mode: 0o700 });
    const statePath = path.join(root, "progress.json");
    const statusPath = path.join(root, "progress.md");
    let operation: string[];
    if (await exists(statePath)) {
      const saved = ProgressStateSchema.parse(
        await readJson(root, "progress.json"),
      );
      requireCondition(
        saved.repo === input.publication.repository &&
          saved.pr === input.publication.prNumber &&
          saved.base === input.base &&
          saved.head === input.head,
        "Saved progress belongs to another review",
      );
      if (["publishing", "complete"].includes(saved.status)) {
        return {
          status: "confirmed",
          reason: "Final publication owns the comment",
        };
      }
      operation = ["update", "--checklist", statusPath];
    } else {
      operation = [
        "start",
        "--repo",
        input.publication.repository,
        "--pr",
        String(input.publication.prNumber),
        "--base",
        input.base,
        "--head",
        input.head,
        "--checklist",
        statusPath,
      ];
    }
    await liveTarget(input);
    await saveText(statusPath, checklist(states));
    const response = z
      .object({ url: z.string().min(1) })
      .parse(await helper(input, operation));
    return {
      status: "confirmed",
      reason: "Progress comment updated",
      url: response.url,
    };
  }

  async function previewFor(
    input: ReviewInput,
  ): Promise<z.infer<typeof PreviewSchema>> {
    return PreviewSchema.parse(
      await helper(input, ["--dry-run", ...finishArguments(input.artifacts)]),
    );
  }

  async function verifyComments(
    input: ReviewInput,
    bundle: Bundle,
  ): Promise<string> {
    const state = ProgressStateSchema.parse(
      await readJson(input.artifacts, "progress.json"),
    );
    requireCondition(
      input.publication.mode === "github",
      "Comment verification requires GitHub publication",
    );
    for (const [key, expected] of Object.entries({
      repo: input.publication.repository,
      pr: input.publication.prNumber,
      base: input.base,
      head: input.head,
    })) {
      requireCondition(
        state[key] === expected,
        `Publication receipt identity mismatch: ${key}`,
      );
    }
    requireCondition(
      state.status === "complete",
      "The publication helper did not finish",
    );
    requireCondition(
      state.publication_digest ===
        publicationDigest(bundle.stages, state.checklist),
      "Frozen publication inputs changed",
    );
    const preview = await previewFor(input);
    requireCondition(
      preview.publication_digest === state.publication_digest,
      "Rendered publication inputs changed",
    );
    for (const [key, comment] of Object.entries(state.comments)) {
      const remote = RemoteCommentSchema.parse(
        await api(`repos/${state.repo}/issues/comments/${comment.id}`),
      );
      const marker = `<!-- review-progress:${state.run_id}:${key} -->`;
      requireCondition(
        remote.body.includes(marker),
        "Published comment no longer belongs to this run",
      );
      requireCondition(
        remote.html_url === comment.html_url,
        "Published comment URL differs from its receipt",
      );
      let body: string;
      if (key === "main") {
        body = preview.body;
      } else if (key.startsWith("report-")) {
        const index = Number(key.slice("report-".length));
        requireCondition(
          Number.isInteger(index) &&
            index >= 1 &&
            index <= preview.report_parts.length,
          "Unexpected saved report part",
        );
        body = `## Full report — part ${index}/${preview.report_parts.length}\n\n${preview.report_parts[index - 1]}`;
      } else {
        continue;
      }
      requireCondition(
        remote.body.trimEnd() === `${body.trimEnd()}\n\n${marker}`.trimEnd(),
        "Published comment content differs from the accepted report",
      );
    }
    requireCondition(state.comments.main, "Published main comment is missing");
    await verifyReviews(input, bundle, state);
    return state.comments.main.html_url;
  }

  async function verifyReviews(
    input: ReviewInput,
    bundle: Bundle,
    state: z.infer<typeof ProgressStateSchema>,
  ): Promise<void> {
    const decision = bundle.stages.decision;
    requireCondition(decision, "Publication requires an accepted decision");
    if (
      decision.approval.outcome !== "approve" &&
      !decision.inlineComments.length
    ) {
      return;
    }
    const reviews: z.infer<typeof RemoteReviewSchema>[] = [];
    for (let page = 1; page <= 1000; page++) {
      const batch = z
        .array(RemoteReviewSchema)
        .max(100)
        .parse(
          await api(
            `repos/${state.repo}/pulls/${state.pr}/reviews?per_page=100&page=${page}`,
          ),
        );
      reviews.push(...batch);
      if (batch.length < 100) {
        break;
      }
      requireCondition(
        page < 1000,
        "Review receipt lookup exceeded its page limit",
      );
    }
    if (decision.approval.outcome === "approve") {
      requireCondition(
        state.approval?.status === "approved" &&
          reviews.some(
            (review) =>
              review.id === state.approval?.id &&
              review.state === "APPROVED" &&
              review.commit_id === input.head,
          ),
        "GitHub has not confirmed approval at the reviewed head",
      );
    }
    if (decision.inlineComments.length) {
      requireCondition(
        reviews.some(
          (review) =>
            review.id === state.inline_review?.id &&
            review.state === "COMMENTED" &&
            review.commit_id === input.head,
        ),
        "GitHub has not confirmed inline findings at the reviewed head",
      );
    }
  }

  async function verify(file: string): Promise<PublicationReceipt> {
    const { bundle, result } = await loadValidatedReview(file);
    const input = bundle.input;
    requireCondition(
      bundle.status !== "incomplete",
      "An incomplete review cannot publish",
    );
    if (input.publication.mode === "local") {
      requireCondition(
        result.publication.status === "not_requested",
        "Unexpected local publication state",
      );
      return { status: "not_requested", reason: "Local report only" };
    }
    if (input.publication.mode === "dry-run") {
      requireCondition(
        result.publication.status === "rendered",
        "Publication preview has not been rendered",
      );
      const preview = PreviewSchema.parse(
        await readJson(input.artifacts, "publication-preview.json"),
      );
      const state = ProgressStateSchema.parse(
        await readJson(input.artifacts, "progress.json"),
      );
      requireCondition(
        preview.publication_digest ===
          publicationDigest(bundle.stages, state.checklist),
        "Preview inputs changed",
      );
      requireCondition(
        isDeepStrictEqual(preview, await previewFor(input)),
        "Saved preview differs from the accepted helper payload",
      );
      return {
        status: "rendered",
        reason: "Publication payload validated without remote writes",
      };
    }
    requireCondition(
      ["pending", "confirmed"].includes(result.publication.status),
      "Publication was not confirmed; inspect existing remote effects before retrying",
    );
    await liveTarget(input);
    return {
      status: "confirmed",
      reason: "GitHub publication independently verified",
      url: await verifyComments(input, bundle),
    };
  }

  async function finish(file: string): Promise<PublicationReceipt> {
    const { bundle, result } = await loadValidatedReview(file);
    const input = bundle.input;
    requireCondition(
      bundle.status !== "incomplete",
      "An incomplete review cannot publish",
    );
    if (
      input.publication.mode === "local" ||
      ["confirmed", "rendered"].includes(result.publication.status)
    ) {
      return verify(file);
    }
    requireCondition(
      result.publication.status === "pending",
      "Publication was already attempted; inspect saved state before explicit recovery",
    );
    try {
      const root = input.artifacts;
      const states = Object.fromEntries(
        Object.keys(bundle.stages).map((name) => [name, "complete"]),
      );
      states.publication = "complete";
      await saveText(path.join(root, "progress.md"), checklist(states));
      if (input.publication.mode === "github") {
        await liveTarget(input);
        if (!(await exists(path.join(root, "progress.json")))) {
          await helper(input, [
            "start",
            "--repo",
            input.publication.repository,
            "--pr",
            String(input.publication.prNumber),
            "--base",
            input.base,
            "--head",
            input.head,
            "--checklist",
            path.join(root, "progress.md"),
          ]);
        }
      } else if (!(await exists(path.join(root, "progress.json")))) {
        await saveJson(path.join(root, "progress.json"), {
          repo: input.publication.repository,
          pr: input.publication.prNumber,
          base: input.base,
          head: input.head,
          run_id: input.runId,
          comments: {},
          status: "reviewing",
          checklist: checklist(states),
        });
      }
      const response = await helper(input, [
        ...(input.publication.mode === "dry-run" ? ["--dry-run"] : []),
        ...finishArguments(root),
      ]);
      if (input.publication.mode === "dry-run") {
        await saveJson(
          path.join(root, "publication-preview.json"),
          PreviewSchema.parse(response),
        );
        const state = ProgressStateSchema.parse(
          await readJson(root, "progress.json"),
        );
        await saveJson(path.join(root, "progress.json"), {
          ...state,
          checklist: checklist(states),
        });
        result.publication = { mode: "dry-run", status: "rendered" };
        await saveJson(path.join(root, "result.json"), result);
      }
      const receipt = await verify(file);
      if (input.publication.mode === "github") {
        result.publication = { mode: "github", ...receipt };
        await saveJson(path.join(root, "result.json"), result);
      }
      return receipt;
    } catch (error) {
      result.publication = {
        mode: input.publication.mode,
        status: "failed",
        reason: message(error),
        inspectBeforeRetry: true,
      };
      await saveJson(path.join(input.artifacts, "result.json"), result);
      throw error;
    }
  }

  return { progress, finish, verify };
}

async function saveText(file: string, contents: string): Promise<void> {
  requireCondition(
    !(await exists(file)) || !(await lstat(file)).isSymbolicLink(),
    `Refusing symlinked progress checklist: ${file}`,
  );
  await writeFile(file, contents, { mode: 0o600 });
}
