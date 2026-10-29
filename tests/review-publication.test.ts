/**
 * Exercise the GitHub command bridge with real accepted files and a simulated
 * subprocess boundary. The copied Python helper has its own recovery suite;
 * these cases establish validation, restrictions and receipt consistency.
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import test from "node:test";
import { z } from "zod";
import {
  checkGitHubReceipt,
  rejectGitHubPublication,
  runGitHubOperation,
} from "../scripts/review/github.js";
import { GitHubRequestSchema } from "../src/review/contracts.js";
import type { GitHubRequest } from "../src/review/contracts.js";
import { savedBundleFixture } from "./fixtures/bundle.js";

/**
 * Simulate only Python/gh responses and helper state. Accepted bundles still
 * pass through the real saved-file gate before a finish command can be issued.
 */
function publicationFixture() {
  const fixture = savedBundleFixture();
  const input = fixture.bundle.input;
  input.github = { repository: "fixture/app", pr: 7 };
  input.publication = "publish";
  fixture.save();
  const calls: string[][] = [];
  let head = input.head;
  const statePath = `${input.artifacts}/github.json`;
  const url = "https://github.com/fixture/app/pull/7#issuecomment-1";
  const command = async (file: string, args: string[]) => {
    calls.push([file, ...args]);
    if (file === "gh")
      return JSON.stringify({ head: { sha: head }, base: { sha: input.base } });
    assert.equal(file, "python3");
    assert.equal(args[0], `${input.skillRoot}/scripts/github_progress.py`);
    assert.equal(args[2], statePath);
    const operation = args[3];
    const status =
      operation === "finish"
        ? "complete"
        : operation === "interrupt"
          ? "interrupted"
          : "reviewing";
    const approval =
      operation === "finish"
        ? { status: "withheld", reason: "Needs human review" }
        : null;
    writeFileSync(
      statePath,
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
  const request = (operation: GitHubRequest["operation"]) =>
    GitHubRequestSchema.parse({
      input,
      operation,
      id: `test-${operation}`,
      checklist: "- [x] Review\n- [ ] Publish results\n",
      reason: "Fixture interruption",
      fingerprint: operation === "finish" ? fixture.result.fingerprint : null,
    });
  return {
    ...fixture,
    input,
    calls,
    command,
    request,
    statePath,
    url,
    advanceHead: () => {
      head = "c".repeat(40);
    },
  };
}

test("finish revalidates saved output then uses existing helper with exact accepted files", async () => {
  const state = publicationFixture();
  try {
    const request = state.request("finish");
    const result = await runGitHubOperation(request, state.command);
    assert.equal(result.status, "confirmed");
    assert.equal(result.approval?.status, "withheld");
    assert.equal(result.url, state.url);
    const finish = state.calls.find((args) => args[4] === "finish");
    assert.ok(finish);
    assert.equal(
      finish[finish.indexOf("--report") + 1],
      `${state.input.artifacts}/review-report.md`,
    );
    assert.equal(
      finish[finish.indexOf("--inline") + 1],
      `${state.input.artifacts}/inline.json`,
    );
    assert.deepEqual(await checkGitHubReceipt(request), result);
  } finally {
    state.close();
  }
});

test("changed accepted report stops finish before any subprocess or remote operation", async () => {
  const state = publicationFixture();
  try {
    writeFileSync(`${state.input.artifacts}/review-report.md`, "Lost evidence");
    await assert.rejects(
      runGitHubOperation(state.request("finish"), state.command),
      /Canonical report differs/,
    );
    assert.deepEqual(state.calls, []);
  } finally {
    state.close();
  }
});

test("comment-only derives a withheld publication decision without changing accepted approval", async () => {
  const state = publicationFixture();
  try {
    state.input.publication = "comment-only";
    const decision = state.bundle.stages.decision;
    assert.ok(decision?.approval.checks);
    for (const check of Object.values(decision.approval.checks))
      check.result = "Pass";
    decision.approval.outcome = "approve";
    decision.approval.next_steps = [];
    state.save();
    const accepted = readFileSync(
      `${state.input.artifacts}/approval.json`,
      "utf8",
    );
    await runGitHubOperation(state.request("finish"), state.command);
    const published = z
      .object({ outcome: z.string(), next_steps: z.array(z.string()).max(20) })
      .parse(
        JSON.parse(
          readFileSync(
            `${state.input.artifacts}/publication-approval.json`,
            "utf8",
          ),
        ),
      );
    assert.equal(published.outcome, "not_submitted");
    assert.ok(published.next_steps.length);
    assert.equal(
      readFileSync(`${state.input.artifacts}/approval.json`, "utf8"),
      accepted,
    );
  } finally {
    state.close();
  }
});

test("newer revisions remain explicit after publishing the pinned report", async () => {
  const state = publicationFixture();
  try {
    state.advanceHead();
    const result = await runGitHubOperation(
      state.request("finish"),
      state.command,
    );
    assert.equal(result.newerCommits, true);
    assert.match(result.reason, /unreviewed/);
    assert.equal(result.approval?.status, "withheld");
  } finally {
    state.close();
  }
});

test("receipt gate rejects missing files and operation or approval mismatches", async () => {
  const state = publicationFixture();
  try {
    const request = state.request("start");
    await runGitHubOperation(request, state.command);
    await assert.rejects(
      checkGitHubReceipt({ ...request, checklist: "Another checklist" }),
      /another operation/,
    );
    const receiptFile = `${state.input.artifacts}/github-${request.id}.json`;
    const receipt = JSON.parse(readFileSync(receiptFile, "utf8"));
    receipt.result.status = "confirmed";
    writeFileSync(receiptFile, JSON.stringify(receipt));
    await assert.rejects(
      checkGitHubReceipt(request),
      /does not confirm this operation/,
    );
    await runGitHubOperation(request, state.command);
    const remoteState = JSON.parse(readFileSync(state.statePath, "utf8"));
    remoteState.status = "complete";
    writeFileSync(state.statePath, JSON.stringify(remoteState));
    await assert.rejects(
      checkGitHubReceipt(request),
      /does not confirm this operation/,
    );
    remoteState.status = "reviewing";
    remoteState.approval = {
      status: "approved",
      html_url: "https://github.com/fixture/app/pull/7#review-1",
    };
    writeFileSync(state.statePath, JSON.stringify(remoteState));
    await assert.rejects(
      checkGitHubReceipt(request),
      /approval receipt differs/,
    );
    rmSync(`${state.input.artifacts}/github-${request.id}.json`);
    await assert.rejects(checkGitHubReceipt(request), /ENOENT/);
  } finally {
    state.close();
  }
});

for (const mode of ["local-only", "staged"] as const) {
  test(`${mode} rejects a direct delivery command before any external effect`, async () => {
    const state = publicationFixture();
    try {
      state.input.publication = mode;
      await assert.rejects(
        runGitHubOperation(state.request("start"), state.command),
        /disabled/,
      );
      assert.deepEqual(state.calls, []);
    } finally {
      state.close();
    }
  });
}

test("freshness refusal survives the receipt gate without any GitHub command", async () => {
  const state = publicationFixture();
  try {
    const request = state.request("finish");
    const reason =
      "Relevant CI now fails; refresh the accepted assessment before publishing.";
    const result = await rejectGitHubPublication(request, reason);
    assert.equal(result.status, "rejected");
    assert.equal(result.reason, reason);
    assert.equal(result.approval, null);
    assert.deepEqual(await checkGitHubReceipt(request), result);
    assert.deepEqual(state.calls, []);
  } finally {
    state.close();
  }
});

test("interrupt updates the blocked checklist before marking the run interrupted", async () => {
  const state = publicationFixture();
  try {
    const request = state.request("interrupt");
    request.checklist = "- [ ] readability: blocked\n- [ ] Publish results\n";
    await runGitHubOperation(request, state.command);
    assert.deepEqual(
      state.calls.map((args) => args[4]),
      ["update", "interrupt"],
    );
    const update = state.calls[0];
    assert.equal(
      readFileSync(update[update.indexOf("--checklist") + 1], "utf8"),
      request.checklist,
    );
  } finally {
    state.close();
  }
});
