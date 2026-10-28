/**
 * Exercises the saved-file gate against temporary Git repositories and files.
 * Each case damages one contract and verifies rejection, including revision,
 * rule inventory, report coverage, approval and file-integrity mismatches.
 */
import assert from "node:assert/strict";
import { writeFileSync, rmSync, symlinkSync, mkdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { FindingSchema } from "../src/review/contracts.js";
import { validateBundle } from "../src/review/validate.js";
import { fingerprint } from "../src/review/text.js";
import { savedBundleFixture } from "./fixtures/bundle.js";
import type { SavedBundleFixture } from "./fixtures/bundle.js";

async function scenario(
  action: (fixture: SavedBundleFixture) => Promise<void>,
  options: Parameters<typeof savedBundleFixture>[0] = {},
) {
  const state = savedBundleFixture(options);
  try {
    await action(state);
  } finally {
    state.close();
  }
}
const validate = (state: SavedBundleFixture) =>
  validateBundle(state.bundlePath, fingerprint(JSON.stringify(state.bundle)));

test("complete bundle validates actual pinned Git scope and canonical decision files", () =>
  scenario(async (state) => {
    assert.equal((await validate(state)).status, "complete");
  }));
test("split-only bundle validates without implementation assessments", () =>
  scenario(
    async (state) => {
      assert.equal((await validate(state)).status, "split");
    },
    { split: true },
  ));
test("decision failure preserves accepted report while remaining incomplete", () =>
  scenario(async (state) => {
    delete state.bundle.stages.decision;
    state.bundle.status = "incomplete";
    state.bundle.failures.push({
      stage: "decision",
      reason: "Both attempts failed",
    });
    state.save();
    assert.equal((await validate(state)).status, "incomplete");
    assert.equal(state.result.reportPath, null);
  }));

const acceptedMutations: [
  string,
  (state: SavedBundleFixture) => void,
  RegExp,
][] = [
  [
    "missing mandatory assessment",
    (state) => {
      delete state.bundle.stages.readability;
    },
    /missing or unexpected stages/,
  ],
  [
    "wrong revision",
    (state) => {
      if (state.bundle.stages.correctness) {
        state.bundle.stages.correctness.head = "c".repeat(40);
      }
    },
    /revisions differ/,
  ],
  [
    "incorrect whole-diff counts",
    (state) => {
      if (state.bundle.stages.setup) {
        state.bundle.stages.setup.addedLines = 9;
      }
      if (state.bundle.stages.decision) {
        state.bundle.stages.decision.approval.changed_lines = 9;
      }
    },
    /counts do not match/,
  ],
  [
    "missing indexed rule",
    (state) => {
      state.bundle.stages.setup?.rulePaths.pop();
    },
    /inventory differs|Rule coverage/,
  ],
  [
    "duplicate rule row",
    (state) => {
      const rows = state.bundle.stages.rules?.rules;
      if (rows) {
        rows[1] = rows[0];
      }
    },
    /Rule coverage/,
  ],
  [
    "lost evidence gap",
    (state) => {
      const report = state.bundle.stages.report;
      if (report) {
        report.markdown = report.markdown.replaceAll(
          "Slack unavailable in fixture",
          "",
        );
      }
    },
    /lost an evidence gap/,
  ],
  [
    "lost check outcome",
    (state) => {
      const report = state.bundle.stages.report;
      if (report) {
        report.markdown = report.markdown.replaceAll(
          "readability check",
          "omitted check",
        );
      }
    },
    /lost individual check coverage/,
  ],
  [
    "missing report section",
    (state) => {
      const report = state.bundle.stages.report;
      if (report) {
        report.markdown = report.markdown.replace(
          "## Assessment",
          "Assessment",
        );
      }
    },
    /missing required template sections/,
  ],
  [
    "contradictory approval",
    (state) => {
      const approval = state.bundle.stages.decision?.approval;
      if (approval) {
        approval.outcome = "approve";
        approval.next_steps = [];
      }
    },
    /every checklist item to pass/,
  ],
  [
    "approval line mismatch",
    (state) => {
      const approval = state.bundle.stages.decision?.approval;
      if (approval) {
        approval.changed_lines = 99;
      }
    },
    /changed_lines must match/,
  ],
];
for (const [name, mutate, reason] of acceptedMutations) {
  test(`${name} is rejected`, () =>
    scenario(async (state) => {
      mutate(state);
      state.save();
      await assert.rejects(validate(state), reason);
    }));
}

const fileMutations: [string, (state: SavedBundleFixture) => void, RegExp][] = [
  [
    "changed summary",
    (state) =>
      writeFileSync(path.join(state.artifacts, "summary.md"), "Changed"),
    /summary differs/,
  ],
  [
    "changed inline file",
    (state) => writeFileSync(path.join(state.artifacts, "inline.json"), "[{}]"),
    /inline findings differ/,
  ],
  [
    "changed approval",
    (state) => writeFileSync(path.join(state.artifacts, "approval.json"), "{}"),
    /approval differs/,
  ],
  [
    "changed bundle",
    (state) => writeFileSync(state.bundlePath, "{}"),
    /differs from accepted/,
  ],
  [
    "missing canonical report",
    (state) => rmSync(path.join(state.artifacts, "review-report.md")),
    /Missing artefact/,
  ],
  [
    "changed assessment",
    (state) =>
      writeFileSync(path.join(state.artifacts, "research.md"), "Changed"),
    /Saved assessment differs/,
  ],
  [
    "dirty source",
    (state) => writeFileSync(path.join(state.repository, "base.ts"), "Changed"),
    /uncommitted changes/,
  ],
  [
    "source at another head",
    (state) =>
      state.git("switch", "--quiet", "--detach", state.bundle.input.base),
    /HEAD differs/,
  ],
  [
    "missing result",
    (state) => rmSync(path.join(state.artifacts, "result.json")),
    /Missing artefact/,
  ],
  [
    "wrong invocation",
    (state) => {
      state.result.invocationId = "another-invocation";
      state.saveResult();
    },
    /identity mismatch: invocationId/,
  ],
  [
    "wrong fingerprint",
    (state) => {
      state.result.fingerprint = "0".repeat(16);
      state.saveResult();
    },
    /fingerprint mismatch/,
  ],
  [
    "unexpected publication flag",
    (state) =>
      writeFileSync(
        path.join(state.artifacts, "result.json"),
        JSON.stringify({ ...state.result, published: true }),
      ),
    /Unrecognized key.*published/,
  ],
];
for (const [name, mutate, reason] of fileMutations) {
  test(`${name} fails saved-file validation`, () =>
    scenario(async (state) => {
      mutate(state);
      await assert.rejects(validate(state), reason);
    }));
}

test("a symlinked canonical report cannot substitute another file", () =>
  scenario(async (state) => {
    const report = path.join(state.artifacts, "review-report.md");
    const outside = path.join(state.root, "outside.md");
    writeFileSync(outside, state.bundle.stages.report?.markdown ?? "");
    rmSync(report);
    symlinkSync(outside, report);
    await assert.rejects(validate(state), /escapes directory/);
  }));
test("wrapper rule inventory is independently inspected", () =>
  scenario(async (state) => {
    const wrapper = path.join(state.root, "wrapper");
    mkdirSync(path.join(wrapper, "rules"), { recursive: true });
    const rule = path.join(wrapper, "rules/ownership.md");
    writeFileSync(rule, "Inspect ownership.");
    writeFileSync(
      path.join(wrapper, "rules/README.md"),
      "[Ownership](ownership.md)",
    );
    state.bundle.input.wrapperSkillRoots.push(wrapper);
    state.save();
    await assert.rejects(validate(state), /inventory differs/);
  }));
test("accepted findings must survive reconciliation and cannot contradict clean approval", () =>
  scenario(async (state) => {
    const correctness = state.bundle.stages.correctness;
    const report = state.bundle.stages.report;
    const decision = state.bundle.stages.decision;
    assert.ok(correctness && report && decision && decision.approval.checks);
    correctness.findings.push(
      FindingSchema.parse({
        id: "R1",
        kind: "bug",
        disposition: "required",
        title: "Preserve update",
        location: "base.ts:1",
        trigger: "Update caller",
        effect: "Saved state stale",
        action: "Persist value",
        evidence: ["base.ts:1"],
        existingThread: null,
      }),
    );
    state.save();
    await assert.rejects(validate(state), /account for every input finding/);
    report.decisions.push({
      sourceId: "correctness:R1",
      disposition: "retained",
      reportId: "F1",
      reason: "Caller trace supports it",
    });
    report.markdown += "\nF1: Preserve the update.\n";
    state.save();
    await assert.rejects(validate(state), /Clean review cannot pass/);
    decision.approval.checks.clean_review.result = "Fail";
    state.save();
    assert.equal((await validate(state)).status, "complete");
  }));
test("inline findings must reference exact accepted new bugs", () =>
  scenario(async (state) => {
    const decision = state.bundle.stages.decision;
    assert.ok(decision?.approval.checks);
    decision.approval.checks.clean_review.result = "Fail";
    decision.inlineComments.push({
      id: "Assessment",
      path: "change.ts",
      line: 1,
      side: "RIGHT",
      body: "An unreviewed claim",
    });
    state.save();
    await assert.rejects(
      validate(state),
      /accepted new bug by exact report ID/,
    );
  }));
test("legitimate source template evidence remains valid", () =>
  scenario(async (state) => {
    const correctness = state.bundle.stages.correctness;
    assert.ok(correctness);
    correctness.markdown += "\n```handlebars\n{{ user.name }}\n```\n";
    state.save();
    assert.equal((await validate(state)).status, "complete");
  }));

test("an indexed rule directory cannot substitute for a rule file", () =>
  scenario(async (state) => {
    const file = state.bundle.stages.setup!.rulePaths[0];
    rmSync(file);
    mkdirSync(file);
    await assert.rejects(validate(state), /Indexed rule is not a file/);
  }));
