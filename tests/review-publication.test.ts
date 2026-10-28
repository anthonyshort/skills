import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createPublisher } from "../src/review/support/publisher.js";
import { quote } from "../src/review/text.js";
import { FindingSchema } from "../src/review/contracts.js";
import { savedBundleFixture } from "./fixtures/bundle.js";
import { BackendSchema } from "./fixtures/fake-github.js";
import type { Backend } from "./fixtures/fake-github.js";

function publicationFixture(mode: "local" | "dry-run" | "github" = "github") {
  const saved = savedBundleFixture({ mode });
  const bin = path.join(saved.root, "bin");
  mkdirSync(bin);
  const backendPath = path.join(saved.root, "github.json");
  const fixtureFile = fileURLToPath(
    new URL("./fixtures/fake-github.ts", import.meta.url),
  );
  writeFileSync(
    path.join(bin, "gh"),
    `#!/bin/sh\nexec ${quote(process.execPath)} --import ${quote(saved.bundle.input.tsxLoader)} ${quote(fixtureFile)} "$@"\n`,
    { mode: 0o700 },
  );
  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    FAKE_GITHUB_EXECUTE: "1",
    FAKE_GITHUB_STATE: backendPath,
  };
  writeFileSync(
    backendPath,
    JSON.stringify(
      BackendSchema.parse({
        head: saved.bundle.input.head,
        base: saved.bundle.input.base,
      }),
    ),
  );
  const backend = () =>
    BackendSchema.parse(JSON.parse(readFileSync(backendPath, "utf8")));
  const changeBackend = (change: (state: Backend) => void) => {
    const value = backend();
    change(value);
    writeFileSync(backendPath, JSON.stringify(value));
  };
  const result = () =>
    JSON.parse(readFileSync(path.join(saved.artifacts, "result.json"), "utf8"));
  return {
    ...saved,
    publisher: createPublisher({ env }),
    backend,
    changeBackend,
    result,
    close: saved.close,
  };
}

async function scenario(
  action: (state: ReturnType<typeof publicationFixture>) => Promise<void>,
  mode: "local" | "dry-run" | "github" = "github",
) {
  const state = publicationFixture(mode);
  try {
    await action(state);
  } finally {
    state.close();
  }
}

test("local finish and verify make no external calls", () =>
  scenario(async (state) => {
    assert.equal(
      (await state.publisher.finish(state.bundlePath)).status,
      "not_requested",
    );
    assert.equal(
      (await state.publisher.verify(state.bundlePath)).status,
      "not_requested",
    );
    assert.deepEqual(state.backend().calls, []);
  }, "local"));
test("local and dry-run progress reject live delivery", async () => {
  for (const mode of ["local", "dry-run"] as const) {
    await scenario(async (state) => {
      await assert.rejects(
        state.publisher.progress(state.bundle.input, { research: "running" }),
        /explicit GitHub/,
      );
      assert.deepEqual(state.backend().calls, []);
    }, mode);
  }
});
test("dry-run uses original helper rendering and frozen digest without GitHub requests", () =>
  scenario(async (state) => {
    assert.equal(
      (await state.publisher.finish(state.bundlePath)).status,
      "rendered",
    );
    assert.equal(
      (await state.publisher.verify(state.bundlePath)).status,
      "rendered",
    );
    assert.equal(state.result().publication.status, "rendered");
    const preview = JSON.parse(
      readFileSync(
        path.join(state.artifacts, "publication-preview.json"),
        "utf8",
      ),
    );
    assert.equal(preview.dry_run, true);
    assert.match(preview.body, /Fixture source evidence/);
    assert.deepEqual(state.backend().calls, []);
  }, "dry-run"));
test("changed dry-run preview cannot claim successful rendering", () =>
  scenario(async (state) => {
    await state.publisher.finish(state.bundlePath);
    const file = path.join(state.artifacts, "publication-preview.json");
    const preview = JSON.parse(readFileSync(file, "utf8"));
    preview.body += "\nAn unrelated replacement";
    writeFileSync(file, JSON.stringify(preview));
    await assert.rejects(
      state.publisher.verify(state.bundlePath),
      /Saved preview differs/,
    );
    assert.deepEqual(state.backend().calls, []);
  }, "dry-run"));
test("GitHub finish saves and independently verifies one full report comment", () =>
  scenario(async (state) => {
    const receipt = await state.publisher.finish(state.bundlePath);
    assert.equal(receipt.status, "confirmed");
    assert.equal(state.result().publication.status, "confirmed");
    assert.equal(state.backend().comments.length, 1);
    assert.ok(
      state
        .backend()
        .comments[0].body.includes(
          state.bundle.stages.report?.markdown ?? "MISSING REPORT",
        ),
    );
    assert.equal(
      (await state.publisher.verify(state.bundlePath)).status,
      "confirmed",
    );
  }));
test("repeated confirmed finish verifies without duplicate external writes", () =>
  scenario(async (state) => {
    await state.publisher.finish(state.bundlePath);
    const writes = state.backend().writes;
    assert.equal(
      (await state.publisher.finish(state.bundlePath)).status,
      "confirmed",
    );
    assert.deepEqual(state.backend().writes, writes);
  }));
test("stale head or base prevents progress and final publication writes", async () => {
  for (const field of ["head", "base"] as const) {
    await scenario(async (state) => {
      state.changeBackend((backend) => {
        backend[field] = "c".repeat(40);
      });
      await assert.rejects(
        state.publisher.progress(state.bundle.input, { research: "running" }),
        /live PR .* changed/,
      );
      await assert.rejects(
        state.publisher.finish(state.bundlePath),
        /live PR .* changed/,
      );
      assert.deepEqual(state.backend().writes, []);
    });
  }
});
test("lost write response is saved as failed and never automatically repeated", () =>
  scenario(async (state) => {
    state.changeBackend((backend) => {
      backend.failAfter = {
        method: "POST",
        path: "repos/fixture/app/issues/1/comments",
      };
    });
    await assert.rejects(
      state.publisher.finish(state.bundlePath),
      /Response lost/,
    );
    assert.equal(state.backend().comments.length, 1);
    assert.equal(state.result().publication.status, "failed");
    assert.equal(state.result().publication.inspectBeforeRetry, true);
    const writes = state.backend().writes;
    await assert.rejects(
      state.publisher.finish(state.bundlePath),
      /already attempted/,
    );
    assert.deepEqual(state.backend().writes, writes);
  }));
test("progress reuses one comment and cannot replace a completed report", () =>
  scenario(async (state) => {
    await state.publisher.progress(state.bundle.input, { research: "running" });
    await state.publisher.progress(state.bundle.input, {
      research: "complete",
      assessments: "running",
    });
    assert.equal(state.backend().comments.length, 1);
    assert.match(state.backend().comments[0].body, /assessments: running/);
    await state.publisher.finish(state.bundlePath);
    const backend = state.backend();
    await state.publisher.progress(state.bundle.input, { research: "running" });
    assert.deepEqual(state.backend().comments, backend.comments);
    assert.deepEqual(state.backend().writes, backend.writes);
  }));
test("changed published body is detected even when its run marker remains", () =>
  scenario(async (state) => {
    await state.publisher.finish(state.bundlePath);
    state.changeBackend((backend) => {
      backend.comments[0].body += "\nAn unrelated edit";
    });
    const writes = state.backend().writes;
    await assert.rejects(
      state.publisher.verify(state.bundlePath),
      /content differs from the accepted report/,
    );
    assert.deepEqual(state.backend().writes, writes);
  }));
test("formal approval is verified at the reviewed commit", () =>
  scenario(async (state) => {
    const decision = state.bundle.stages.decision;
    assert.ok(decision?.approval.checks);
    decision.approval.outcome = "approve";
    decision.approval.checks.low_risk.result = "Pass";
    decision.approval.next_steps = [];
    state.save();
    assert.equal(
      (await state.publisher.finish(state.bundlePath)).status,
      "confirmed",
    );
    assert.equal(state.backend().reviews[0].state, "APPROVED");
    state.changeBackend((backend) => {
      backend.reviews[0].commit_id = "c".repeat(40);
    });
    await assert.rejects(
      state.publisher.verify(state.bundlePath),
      /confirmed approval at the reviewed head/,
    );
  }));
test("accepted new inline bug is verified at the reviewed commit", () =>
  scenario(async (state) => {
    const correctness = state.bundle.stages.correctness;
    const report = state.bundle.stages.report;
    const decision = state.bundle.stages.decision;
    assert.ok(correctness && report && decision?.approval.checks);
    correctness.findings.push(
      FindingSchema.parse({
        id: "B1",
        kind: "bug",
        disposition: "required",
        title: "Preserve saved value",
        location: "change.ts:1",
        trigger: "Caller update",
        effect: "Saved value stale",
        action: "Persist update",
        evidence: ["change.ts:1"],
        existingThread: null,
      }),
    );
    report.decisions.push({
      sourceId: "correctness:B1",
      disposition: "retained",
      reportId: "F1",
      reason: "Caller trace supports it",
    });
    report.markdown += "\nF1: Preserve the saved value.\n";
    decision.approval.checks.clean_review.result = "Fail";
    decision.inlineComments.push({
      id: "F1",
      path: "change.ts",
      line: 1,
      side: "RIGHT",
      body: "F1. Preserve the saved value.",
    });
    state.save();
    assert.equal(
      (await state.publisher.finish(state.bundlePath)).status,
      "confirmed",
    );
    assert.equal(state.backend().reviews[0].state, "COMMENTED");
    state.changeBackend((backend) => {
      backend.reviews[0].commit_id = "c".repeat(40);
    });
    await assert.rejects(
      state.publisher.verify(state.bundlePath),
      /confirmed inline findings at the reviewed head/,
    );
  }));
test("incomplete review cannot publish or contact GitHub", () =>
  scenario(async (state) => {
    delete state.bundle.stages.decision;
    state.bundle.status = "incomplete";
    state.bundle.failures.push({ stage: "decision", reason: "Failed" });
    state.save();
    await assert.rejects(
      state.publisher.finish(state.bundlePath),
      /incomplete review cannot publish/,
    );
    assert.deepEqual(state.backend().calls, []);
  }));
