/**
 * Host adapter for workflow integration tests: temporary sources and canned
 * worker answers, plus real artifact writing and command gates. Prompt Markdown
 * is deliberately absent from the temporary skill root: the workflow embeds it.
 * Fault injection belongs in the test case; no model or live transport is used.
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { runWorkflow } from "../../node_modules/@tintinweb/pi-subagents/dist/workflow/runtime.js";
import type {
  RunWorkflowOptions,
  WorkflowHost as PiRuntimeHost,
  WorkflowSpawnRequest,
} from "../../node_modules/@tintinweb/pi-subagents/dist/workflow/runtime.js";
import {
  BundleSchema,
  ReviewResultSchema,
  StageSchemas,
  StageNameSchema,
  assessmentNames,
  parseReviewInput,
  NotificationBroadcastSchema,
  GitHubRequestSchema,
  ReviewOutputSchema,
} from "../../src/review/contracts.js";
import {
  rejectGitHubPublication,
  runGitHubOperation,
} from "../../scripts/review/github.js";
import type {
  Bundle,
  ReviewInput,
  StageName,
  StageResult,
} from "../../src/review/contracts.js";

export const questions = [...assessmentNames];
const packageRoot = fileURLToPath(new URL("../../", import.meta.url));
const script = readFileSync(
  path.join(packageRoot, "workflows/review.js"),
  "utf8",
);
export type FixtureOptions = {
  addedLines?: number;
  notify?: boolean;
  github?: boolean;
  publication?: ReviewInput["publication"];
  publicationRefusal?: string;
  deliveryFailure?: "start" | "update" | "interrupt" | "finish";
  notificationAvailable?: boolean;
  notificationScope?: (attempt: number) => string;
  wrapper?: boolean;
  split?: boolean;
  exception?: string;
  notificationStatus?: string;
  hold?: (request: WorkflowSpawnRequest) => Promise<void>;
  fail?: (name: StageName, attempt: number) => boolean;
  mutate?: (result: StageResult, attempt: number) => void;
  corrupt?: (context: { bundle: Bundle; root: string }) => void;
};

function createSources(options: FixtureOptions) {
  const root = mkdtempSync(path.join(os.tmpdir(), "review-workflow-"));
  const skillRoot = path.join(root, "skills/review-workflow");
  const repository = path.join(root, "repository");
  const artifacts = path.join(root, "artifacts with 'quotes'");
  mkdirSync(path.join(skillRoot, "rules"), { recursive: true });
  mkdirSync(repository);
  const git = (...args: string[]) =>
    execFileSync("git", ["-c", "core.hooksPath=/dev/null", ...args], {
      cwd: repository,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  const commit = (message: string) =>
    git(
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "--quiet",
      "-m",
      message,
    );
  git("init", "--quiet");
  writeFileSync(
    path.join(repository, "example.ts"),
    "export const value = 1;\n",
  );
  git("add", "example.ts");
  commit("base");
  const base = git("rev-parse", "HEAD");
  writeFileSync(
    path.join(repository, "added.ts"),
    "export {};\n".repeat(options.addedLines ?? 1),
  );
  git("add", "added.ts");
  commit("change");
  const rulePaths = ["await", "cleanup"].map((name) =>
    path.join(skillRoot, "rules", `${name}.md`),
  );
  writeFileSync(
    path.join(skillRoot, "rules/README.md"),
    rulePaths.map((file) => `[Rule](${path.basename(file)})`).join("\n"),
  );
  rulePaths.forEach((file) =>
    writeFileSync(file, "Inspect the relevant operation."),
  );
  const wrapperSkillRoots: string[] = [];
  if (options.wrapper) {
    const wrapper = path.join(root, "skills/wrapper");
    mkdirSync(path.join(wrapper, "rules"), { recursive: true });
    const file = path.join(wrapper, "rules/ownership.md");
    writeFileSync(file, "Trace the wrapper ownership boundary.");
    writeFileSync(
      path.join(wrapper, "rules/README.md"),
      "[Ownership](ownership.md)",
    );
    rulePaths.push(file);
    wrapperSkillRoots.push(wrapper);
  }
  const input = parseReviewInput({
    packageRoot,
    repository,
    target: "fixture/app#1",
    skillRoot,
    base,
    head: git("rev-parse", "HEAD"),
    artifacts,
    wrapperSkillRoots,
    runId: "fixture-run",
    invocationId: "invocation-one",
    github: options.github ? { repository: "fixture/app", pr: 7 } : null,
    publication: options.publication ?? "publish",
    notification: options.notify ? { messageKey: "fixture-run" } : null,
  });
  return { root, input, rulePaths };
}

function defaultAssessment(
  name: StageName,
  input: ReviewInput,
  rulePaths: string[],
  options: FixtureOptions,
): StageResult {
  const common = {
    stage: name,
    base: input.base,
    head: input.head,
    markdown: `# ${name}\nInspected the pinned change. 🐈\n`,
    checks: [
      {
        guidance: `fixture/${name}#behaviour@v1`,
        item: `${name} observable behaviour`,
        method: "source inspection",
        result: "Source checked",
        evidence: ["example.ts:4"],
        reason: "Traced the affected caller.",
      },
    ],
    findings: [],
    gaps: [],
  };
  let extra: Record<string, unknown> = {};
  if (name === "setup") {
    extra = {
      mode: options.split ? "split" : "full",
      addedLines: options.addedLines ?? 1,
      deletedLines: 0,
      sizeException: options.exception ?? null,
      rulePaths,
    };
  }
  if (name === "rules") {
    extra = {
      rules: rulePaths.map((path) => ({
        path,
        selection: "selected",
        result: "Satisfied",
        reason: "Inspected caller",
        evidence: ["example.ts:4"],
      })),
    };
  }
  if (name === "report") {
    extra = { decisions: [] };
  }
  if (name === "decision") {
    const checks = {
      result: "Pass",
      reason: "Fixture source review; no CI supplied",
    };
    extra = {
      approval: {
        outcome: options.split ? "split" : "human_review",
        changed_lines: options.addedLines ?? 1,
        checks: options.split
          ? null
          : {
              focused: checks,
              low_risk: checks,
              no_sensitive_changes: checks,
              clean_review: checks,
              complete_review: checks,
              verification: { ...checks, result: "Not verified" },
              concerns_resolved: checks,
            },
        reason: "A person should assess fixture limits",
        next_steps: ["Reviewer: inspect fixture verification limits"],
      },
      summaryMarkdown:
        "- **Overall:** Fixture source review complete.\n- **Risk:** Low, with missing CI evidence.\n- **Rules:** Source inspected.\n",
      inlineComments: [],
    };
  }
  if (["draft", "editorial", "report"].includes(name)) {
    common.markdown =
      "# Review: fixture/app#1\n\n## Assessment\nSource review completed.\n\n### Risk and scope\nLow production exposure in the inspected caller.\n\n## Findings\nNo supported findings.\n\n## Verification summary\nSource inspection only; fixture CI is unavailable.\n\n## References\nFixture requirements inspected.\n\n## Supporting details\nCaller traced at example.ts:4. 🐈\n";
  }
  if (name === "splitPlan") {
    common.markdown =
      "# Review: fixture/app#1\n\n## Assessment\nSplit required.\n\n### Risk and scope\nOversized change; full review deferred.\n\n## Split plan\nSeparate preparation from behaviour.\n\n## CI status\nUnavailable in fixture.\n";
  }
  return StageSchemas[name].parse({ ...common, ...extra });
}

function saveAcceptedArtifacts(prompt: string, root: string): Bundle {
  const lines = prompt.split("\n");
  const bundle = BundleSchema.parse(JSON.parse(lines.at(-1) ?? "null"));
  mkdirSync(root, { recursive: true });
  writeFileSync(path.join(root, "bundle.json"), JSON.stringify(bundle));
  for (const [name, result] of Object.entries(bundle.stages)) {
    writeFileSync(path.join(root, `${name}.md`), result.markdown);
  }
  if (bundle.status === "incomplete") {
    writeFileSync(
      path.join(root, "incomplete.md"),
      JSON.stringify(bundle.failures),
    );
  } else {
    writeFileSync(
      path.join(root, "review-report.md"),
      (bundle.stages.report ?? bundle.stages.splitPlan)?.markdown ?? "",
    );
  }
  const result = lines.flatMap((line) => {
    try {
      const parsed = ReviewResultSchema.safeParse(JSON.parse(line));
      return parsed.success ? [parsed.data] : [];
    } catch {
      return [];
    }
  })[0];
  assert.ok(result, "Writer prompt must contain result metadata");
  writeFileSync(path.join(root, "result.json"), JSON.stringify(result));
  const decision = bundle.stages.decision;
  if (decision) {
    writeFileSync(
      path.join(root, "approval.json"),
      JSON.stringify(decision.approval),
    );
    writeFileSync(path.join(root, "summary.md"), decision.summaryMarkdown);
    writeFileSync(
      path.join(root, "inline.json"),
      JSON.stringify(decision.inlineComments),
    );
  }
  return bundle;
}

/**
 * Return a canned host-tool broadcast. Parsing the actual event rejects an
 * incompatible notify request without claiming a real Telegram transport.
 */
function notificationAnswer(
  prompt: string,
  options: FixtureOptions,
  attempt: number,
) {
  const event = z
    .object({
      action: z.literal("send"),
      messageKey: z.string(),
      text: z.string(),
    })
    .strict()
    .parse(JSON.parse(prompt.split("\n").at(-1) ?? "null"));
  if (options.notificationAvailable === false) {
    return {
      broadcast: null,
      reason: "Host notify tool unavailable",
    };
  }
  return {
    broadcast: NotificationBroadcastSchema.parse({
      scope: options.notificationScope?.(attempt) ?? "fixture-session",
      messageKey: event.messageKey,
      deliveries: [
        {
          deliveryId: "fixture-delivery",
          destination: "fixture-telegram",
          status: options.notificationStatus ?? "confirmed",
          externalId: "fixture-message",
          duplicate: false,
        },
      ],
    }),
    reason: "Fixture receipt, no external delivery.",
  };
}

/**
 * Replace only Python and gh subprocess responses. The real bridge writes its
 * receipt, and Pi runs the real receipt gate against these simulated helper files.
 */
function fakeGitHubCommand(input: ReviewInput) {
  return async (file: string, args: string[]) => {
    if (file === "gh") {
      return JSON.stringify({
        head: { sha: input.head },
        base: { sha: input.base },
      });
    }
    assert.equal(file, "python3");
    const operation = args[3];
    const status =
      operation === "finish"
        ? "complete"
        : operation === "interrupt"
          ? "interrupted"
          : "reviewing";
    const url = "https://github.com/fixture/app/pull/7#issuecomment-1";
    const approval =
      operation === "finish"
        ? { status: "withheld", reason: "Fixture requires human review" }
        : null;
    mkdirSync(input.artifacts, { recursive: true });
    writeFileSync(
      `${input.artifacts}/github.json`,
      JSON.stringify({
        repo: input.github?.repository,
        pr: input.github?.pr,
        base: input.base,
        head: input.head,
        status,
        comments: { main: { html_url: url } },
        approval,
      }),
    );
    return JSON.stringify({ status, url, approval });
  };
}

export function fixture(options: FixtureOptions = {}) {
  const { root, input: args, rulePaths } = createSources(options);
  const calls: string[] = [];
  const prompts = new Map<string, string>();
  const phases = new Map<string, string | undefined>();
  let notificationCount = 0;
  let bundle: Bundle | undefined;
  const host: PiRuntimeHost = {
    abortAgent() {},
    async spawnAgent(request) {
      calls.push(request.label);
      prompts.set(request.label, request.prompt);
      phases.set(request.label, request.phaseTitle);
      await options.hold?.(request);
      const ok = (value: unknown) => ({
        ok: true,
        text: JSON.stringify(value),
      });
      if (request.label.startsWith("notify:")) {
        return ok(
          notificationAnswer(request.prompt, options, ++notificationCount),
        );
      }
      if (request.label.startsWith("github:")) {
        const line = request.prompt.match(/^GitHub request: (.+)$/m)?.[1];
        assert.ok(line, "Delivery worker must receive its request");
        const delivery = GitHubRequestSchema.parse(JSON.parse(line));
        if (delivery.operation === options.deliveryFailure) {
          return { ok: false, error: "Fixture delivery response lost" };
        }
        const result =
          delivery.operation === "finish" && options.publicationRefusal
            ? await rejectGitHubPublication(
                delivery,
                options.publicationRefusal,
              )
            : await runGitHubOperation(
                delivery,
                fakeGitHubCommand(delivery.input),
              );
        return ok(result);
      }
      if (request.label === "save-artefacts") {
        bundle = saveAcceptedArtifacts(request.prompt, args.artifacts);
        options.corrupt?.({ bundle, root: args.artifacts });
        return ok({ saved: true });
      }
      const [label, count] = request.label.split(":");
      const name = StageNameSchema.parse(label);
      if (options.fail?.(name, Number(count))) {
        return { ok: false, error: "Fixture child failed" };
      }
      const value = defaultAssessment(name, args, rulePaths, options);
      options.mutate?.(value, Number(count));
      return ok(value);
    },
    async runGate(command) {
      const result = spawnSync("sh", ["-c", command], { encoding: "utf8" });
      return { ok: result.status === 0, output: result.stdout + result.stderr };
    },
  };
  return {
    args,
    calls,
    prompts,
    phases,
    rulePaths,
    get bundle() {
      assert.ok(bundle);
      return bundle;
    },
    async run(
      overrides: Record<string, unknown> = {},
      options: Partial<RunWorkflowOptions> = {},
    ) {
      const result = await runWorkflow({
        script,
        args: { ...args, ...overrides },
        host,
        concurrency: 8,
        ...options,
      });
      return {
        ...result,
        get value() {
          return ReviewOutputSchema.parse(result.value);
        },
      };
    },
    close: () => rmSync(root, { recursive: true, force: true }),
  };
}

export async function scenario(
  options: FixtureOptions,
  check: (state: ReturnType<typeof fixture>) => Promise<void>,
) {
  const state = fixture(options);
  try {
    await check(state);
  } finally {
    state.close();
  }
}
