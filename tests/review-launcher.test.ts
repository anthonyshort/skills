import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { z } from "zod";
import {
  parseArguments,
  resolveReviewInputs,
  runReview,
} from "../scripts/run-review.js";
import { LauncherOptionsSchema } from "../src/review/launcher/arguments.js";

const execute = promisify(execFile);
const secret = "private-auth-sentinel-" + randomUUID();
const loader = fileURLToPath(import.meta.resolve("tsx"));
const fakePi = fileURLToPath(new URL("./fixtures/fake-pi.ts", import.meta.url));
const captureSchema = z.object({
  argv: z.array(z.string()).max(100),
  input: z.object({ notification: z.unknown(), tsxLoader: z.string() }),
  profile: z.string(),
  authMode: z.number(),
  settings: z.object({
    defaultProvider: z.string(),
    defaultModel: z.string(),
    defaultThinkingLevel: z.string(),
    packages: z.array(z.string()).max(100),
  }),
});

function quote(value: string): string {
  return "'" + value.replace(/'/g, "'\\''") + "'";
}

async function fixture(context: TestContext) {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "review-launcher-test-"),
  );
  context.after(() => rm(directory, { recursive: true, force: true }));
  const repository = path.join(directory, "repository");
  const packageRoot = path.join(directory, "package");
  const pluginRoot = path.join(directory, "plugin");
  const profile = path.join(directory, "profile");
  await Promise.all(
    [
      repository,
      pluginRoot,
      profile,
      path.join(packageRoot, "scripts/review"),
      path.join(packageRoot, "workflows"),
    ].map((location) => mkdir(location, { recursive: true })),
  );
  await writeFile(
    path.join(repository, "sum.mjs"),
    "export const sum = values => values.reduce((a, b) => a + b, 0);\n",
  );
  await execute("git", ["init", "--quiet", repository]);
  await execute("git", ["-C", repository, "add", "."]);
  await execute("git", [
    "-C",
    repository,
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "-c",
    "commit.gpgsign=false",
    "-c",
    "core.hooksPath=/dev/null",
    "commit",
    "--quiet",
    "-m",
    "feat: add fixture",
  ]);
  const { stdout } = await execute("git", [
    "-C",
    repository,
    "rev-parse",
    "HEAD",
  ]);
  const head = stdout.trim();
  await writeFile(
    path.join(packageRoot, "package.json"),
    JSON.stringify({
      name: "fixture-review-package",
      pi: { subagents: { workflows: ["./workflows"] } },
    }),
  );
  await writeFile(
    path.join(packageRoot, "workflows/review.js"),
    'export const meta = { name: "review", description: "fixture" };\nreturn {};\n',
  );
  await writeFile(
    path.join(packageRoot, "scripts/review/validate-bundle.ts"),
    `import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const file = process.argv[2];
const data: unknown = JSON.parse(readFileSync(file, 'utf8'));
writeFileSync(path.join(path.dirname(file), 'validator-called'), 'yes');
if (process.argv[3] !== '--fingerprint' || typeof data !== 'object' || data === null || !('fingerprint' in data) || data.fingerprint !== process.argv[4] || !('valid' in data) || data.valid !== true) throw new Error('Invalid fixture bundle');
`,
  );
  await writeFile(
    path.join(pluginRoot, "package.json"),
    JSON.stringify({ name: "@tintinweb/pi-subagents", version: "0.22.0" }),
  );
  const sourceSettings = JSON.stringify({
    defaultProvider: "fixture-provider",
    defaultModel: "inherited-model",
    defaultThinkingLevel: "high",
    packages: ["must-not-load"],
    extensions: ["/must-not-load.js"],
  });
  await writeFile(path.join(profile, "settings.json"), sourceSettings);
  await writeFile(
    path.join(profile, "auth.json"),
    JSON.stringify({ fixture: { key: secret } }),
    { mode: 0o600 },
  );
  const pi = path.join(directory, "fake-pi");
  await writeFile(
    pi,
    `#!/bin/sh\nexec ${quote(process.execPath)} --import ${quote(loader)} ${quote(fakePi)} "$@"\n`,
    { mode: 0o700 },
  );
  const options = LauncherOptionsSchema.parse({
    repository,
    base: head,
    head,
    output: path.join(directory, "output"),
    profile,
    pluginRoot,
    pi,
    publication: "local",
    timeoutMs: 3000,
  });
  return {
    directory,
    repository,
    packageRoot,
    profile,
    options,
    sourceSettings,
  };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;

async function runFixture(
  context: Fixture,
  scenario = "success",
  extra: Partial<z.infer<typeof LauncherOptionsSchema>> = {},
) {
  return runReview(
    { ...context.options, ...extra },
    {
      packageRoot: context.packageRoot,
      env: { ...process.env, PI_REVIEW_TEST_SCENARIO: scenario },
    },
  );
}

async function assertProcessStopped(pid: number): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const status = await readFile(`/proc/${pid}/stat`, "utf8");
      if (/^\d+ \(.+\) [ZX] /.test(status)) {
        return;
      }
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return;
      }
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail(`Process ${pid} remained active after cleanup`);
}

test("parses inherited profile and requires explicit remote publication target", () => {
  const options = parseArguments(
    ["--repository", "/repo", "--base", "main", "--output", "/output"],
    { PI_CODING_AGENT_DIR: "/selected" },
  );
  assert.ok(!("help" in options));
  assert.equal(options.profile, "/selected");
  assert.equal(options.publication, "local");
  assert.equal(options.timeoutMs, 1800000);
  assert.throws(
    () =>
      parseArguments([
        "--repository",
        "/repo",
        "--base",
        "main",
        "--output",
        "/output",
        "--publication",
        "github",
      ]),
    /--github is required/,
  );
  assert.throws(
    () =>
      parseArguments([
        "--repository",
        "/repo",
        "--base",
        "main",
        "--output",
        "/output",
        "--timeout",
        "NaN",
      ]),
    /timeout/,
  );
});

test("pins refs and rejects dirty checkouts and output symlinked into source", async (context) => {
  const state = await fixture(context);
  const inputs = await resolveReviewInputs(state.options, state.packageRoot);
  assert.equal(inputs.base, state.options.head);
  assert.equal(inputs.head, state.options.head);
  assert.equal(inputs.tsxLoader, loader);
  await symlink(state.repository, path.join(state.directory, "source-link"));
  await assert.rejects(
    resolveReviewInputs(
      {
        ...state.options,
        output: path.join(state.directory, "source-link/artifacts"),
      },
      state.packageRoot,
    ),
    /outside/,
  );
  await writeFile(path.join(state.repository, "untracked"), "new file");
  await assert.rejects(
    resolveReviewInputs(state.options, state.packageRoot),
    /clean/,
  );
});

test("waits for workflow entry, inherits model, validates bundle and cleans private credentials", async (context) => {
  const state = await fixture(context);
  const result = await runFixture(state);
  assert.equal(result.status, "complete");
  const capture = captureSchema.parse(
    JSON.parse(
      await readFile(path.join(state.options.output, "capture.json"), "utf8"),
    ),
  );
  assert.ok(capture.argv.includes("--mode"));
  assert.ok(capture.argv.includes("rpc"));
  assert.ok(!capture.argv.includes("--print"));
  assert.ok(!capture.argv.includes("--model"));
  assert.equal(capture.settings.defaultProvider, "fixture-provider");
  assert.equal(capture.settings.defaultModel, "inherited-model");
  assert.equal(capture.settings.defaultThinkingLevel, "high");
  assert.deepEqual(capture.settings.packages, [
    state.packageRoot,
    state.options.pluginRoot,
  ]);
  assert.equal(capture.authMode, 0o600);
  assert.equal(capture.input.notification, null);
  assert.ok(
    await readFile(path.join(state.options.output, "validator-called"), "utf8"),
  );
  await assert.rejects(stat(capture.profile), { code: "ENOENT" });
  assert.equal(
    await readFile(path.join(state.profile, "settings.json"), "utf8"),
    state.sourceSettings,
  );
  for (const name of await readdir(state.options.output)) {
    if (name.endsWith(".log") || name === "capture.json") {
      assert.ok(
        !(
          await readFile(path.join(state.options.output, name), "utf8")
        ).includes(secret),
        "Credentials leaked to output",
      );
    }
  }
});

for (const [scenario, expected] of [
  ["exit-zero", /before a terminal/],
  ["terminal-failed", /workflow failed/],
  ["stale-result", /mismatched invocationId/],
  ["invalid-bundle", /fresh validation/],
  ["incomplete", /incomplete/],
  ["unconfirmed", /not confirmed/],
  ["malformed-result", /invalid structure/],
] satisfies [string, RegExp][]) {
  test(`rejects ${scenario} instead of reporting success`, async (context) => {
    const state = await fixture(context);
    await assert.rejects(runFixture(state, scenario), expected);
  });
}

for (const publication of ["dry-run", "github"] satisfies (
  "dry-run" | "github"
)[]) {
  test(`requires ${publication} publication receipt matching the selected mode`, async (context) => {
    const state = await fixture(context);
    const result = await runFixture(state, "success", {
      publication,
      github: "example/app#123",
    });
    assert.equal(result.publication.mode, publication);
    assert.equal(
      result.publication.status,
      publication === "github" ? "confirmed" : "rendered",
    );
  });
}

test(
  "timeout stops Pi and its child process",
  { skip: process.platform !== "linux" },
  async (context) => {
    const state = await fixture(context);
    await assert.rejects(
      runFixture(state, "timeout", { timeoutMs: 1000 }),
      /timed out/,
    );
    const pid = Number(
      await readFile(path.join(state.options.output, "grandchild.pid"), "utf8"),
    );
    await assertProcessStopped(pid);
  },
);

test(
  "cancellation stops Pi and its child process",
  { skip: process.platform !== "linux" },
  async (context) => {
    const state = await fixture(context);
    const controller = new AbortController();
    const running = runReview(state.options, {
      packageRoot: state.packageRoot,
      env: { ...process.env, PI_REVIEW_TEST_SCENARIO: "cancel" },
      signal: controller.signal,
    });
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        await stat(path.join(state.options.output, "grandchild.pid"));
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
    controller.abort();
    await assert.rejects(running, /cancelled/);
    const pid = Number(
      await readFile(path.join(state.options.output, "grandchild.pid"), "utf8"),
    );
    await assertProcessStopped(pid);
  },
);
