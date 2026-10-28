import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import type { WorkflowJournalEntry } from "../node_modules/@tintinweb/pi-subagents/dist/workflow/journal.js";
import { scenario, questions } from "./fixtures/workflow.js";
import type { FixtureOptions } from "./fixtures/workflow.js";
test("complete review uses all required stages and validates real saved files", () =>
  scenario({}, async (state) => {
    const result = await state.run();
    assert.equal(result.status, "completed", result.error);
    assert.equal(result.value.status, "complete");
    assert.equal(result.value.published, false);
    assert.equal(result.value.publication.status, "not_requested");
    assert.equal(state.calls[0], "setup:1");
    assert.ok(
      state.calls.indexOf("research:1") < state.calls.indexOf("product:1"),
    );
    for (const name of questions) {
      assert.ok(
        state.calls.indexOf(`${name}:1`) < state.calls.indexOf("rules:1"),
      );
    }
    assert.ok(
      state.calls.indexOf("rules:1") < state.calls.indexOf("consolidation:1"),
    );
    assert.ok(
      state.calls.indexOf("editorial:1") < state.calls.indexOf("report:1"),
    );
    const report = readFileSync(result.value.reportPath!, "utf8");
    assert.match(report, /readability observable behaviour/);
    assert.ok(report.includes(state.rulePaths[1]));
  }));

test("assessment barrier waits for the slowest reviewer", () => {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started = () => {};
  const waiting = new Promise<void>((resolve) => {
    started = resolve;
  });
  return scenario(
    {
      hold: async (request) => {
        if (request.label === "readability:1") {
          started();
          await held;
        }
      },
    },
    async (state) => {
      const running = state.run();
      await waiting;
      assert.equal(state.calls.includes("rules:1"), false);
      release();
      assert.equal((await running).value.status, "complete");
    },
  );
});

test("a failed assessment gets one fresh retry and can recover", () =>
  scenario(
    { fail: (name, attempt) => name === "readability" && attempt === 1 },
    async (state) => {
      const result = await state.run();
      assert.equal(result.value.status, "complete");
      assert.ok(state.calls.includes("readability:2"));
      assert.equal(state.bundle.attempts.length, 1);
      assert.equal(state.bundle.failures.length, 0);
    },
  ));

test("missing mandatory assessment stops downstream work and saves partial evidence", () =>
  scenario({ fail: (name) => name === "readability" }, async (state) => {
    const result = await state.run();
    assert.equal(result.value.status, "incomplete");
    assert.equal(result.value.status, "incomplete");
    assert.equal(result.value.reportPath!, null);
    assert.equal(
      state.calls.filter((label) => label.startsWith("readability:")).length,
      2,
    );
    assert.equal(state.calls.includes("rules:1"), false);
    assert.ok(state.bundle.stages.correctness);
    assert.match(
      state.bundle.failures[0].reason,
      /Missing assessments: readability/,
    );
  }));

test("research failure prevents every assessment", () =>
  scenario({ fail: (name) => name === "research" }, async (state) => {
    const result = await state.run();
    assert.equal(result.value.status, "incomplete");
    assert.equal(
      state.calls.some((label) => label.startsWith("product:")),
      false,
    );
  }));

for (const [title, mutate] of [
  [
    "wrong revision",
    (value) => {
      if (value.stage === "correctness") {
        value.head = "c".repeat(40);
      }
    },
  ],
  [
    "missing required fields",
    (value) => {
      if (value.stage === "correctness") {
        Reflect.deleteProperty(value, "checks");
      }
    },
  ],
  [
    "verified check without evidence",
    (value) => {
      if (value.stage === "correctness") {
        value.checks[0].evidence = [];
      }
    },
  ],
  [
    "missing rule row",
    (value) => {
      if (value.stage === "rules") {
        value.rules.pop();
      }
    },
  ],
  [
    "duplicate rule row",
    (value) => {
      if (value.stage === "rules") {
        value.rules[1] = value.rules[0];
      }
    },
  ],
  [
    "duplicate setup rule path",
    (value) => {
      if (value.stage === "setup") {
        value.rulePaths = [...value.rulePaths, value.rulePaths[0]];
      }
    },
  ],
  [
    "report without required sections",
    (value) => {
      if (value.stage === "report") {
        value.markdown = "# report\nLooks fine";
      }
    },
  ],
] satisfies [string, NonNullable<FixtureOptions["mutate"]>][]) {
  test(`${title} cannot produce a complete review`, () =>
    scenario({ mutate }, async (state) => {
      const result = await state.run();
      assert.equal(result.value.status, "incomplete");
      assert.equal(result.value.published, false);
    }));
}

test("skipped rules need reasons but do not count as passing", () =>
  scenario(
    {
      mutate: (value) => {
        if (value.stage === "rules") {
          Object.assign(value.rules[0], {
            selection: "skipped",
            result: "Skipped",
            reason: "No relevant operation changed",
            evidence: [],
          });
        }
      },
    },
    async (state) => {
      const result = await state.run();
      assert.equal(result.value.status, "complete");
      assert.match(
        readFileSync(result.value.reportPath!, "utf8"),
        /skipped, Skipped/,
      );
    },
  ));

test("split output omits research, assessments and full report coverage", () =>
  scenario({ split: true, addedLines: 2001 }, async (state) => {
    const result = await state.run();
    assert.equal(result.value.status, "split");
    assert.deepEqual(state.calls, [
      "setup:1",
      "split-plan:1",
      "decision:1",
      "save-artefacts",
    ]);
  }));

test("over 2,000 added lines requires split or a documented exception", () =>
  scenario({ addedLines: 2001 }, async (state) => {
    const result = await state.run();
    assert.equal(result.value.status, "incomplete");
    assert.equal(state.calls.includes("research:1"), false);
  }));

test("documented size exception permits full review", () =>
  scenario(
    { addedLines: 2001, exception: "Explicit request to review despite size" },
    async (state) => {
      assert.equal((await state.run()).value.status, "complete");
    },
  ));

test("unaccounted finding prevents report acceptance", () =>
  scenario(
    {
      mutate: (value) => {
        if (value.stage === "readability") {
          value.findings.push({
            id: "R1",
            kind: "readability",
            disposition: "optional",
            title: "Separate nested decisions",
            location: "example.ts:4",
            trigger: "Reading the update path",
            effect: "Reader tracks unrelated branches",
            action: "Group the two decisions",
            evidence: ["example.ts:4"],
            existingThread: null,
          });
        }
      },
    },
    async (state) => {
      const result = await state.run();
      assert.equal(result.value.status, "incomplete");
      assert.equal(state.bundle.stages.report, undefined);
    },
  ));

test("notification uncertainty never retries or fails review stages", () =>
  scenario({ notify: true, notificationStatus: "uncertain" }, async (state) => {
    const result = await state.run();
    assert.equal(result.value.status, "complete");
    assert.ok(result.value.notifications.length > 0);
    assert.equal(
      state.calls.filter((label) => label === "research:1").length,
      1,
    );
    assert.equal(
      state.calls.filter((label) => label === "notify:research:running").length,
      1,
    );
    assert.equal(result.value.notifications[0].receipt.status, "uncertain");
  }));

for (const [title, corrupt] of [
  [
    "missing canonical report",
    ({ root }) => {
      rmSync(path.join(root, "review-report.md"));
    },
  ],
  [
    "changed assessment",
    ({ root }) => {
      writeFileSync(path.join(root, "readability.md"), "Lost evidence");
    },
  ],
  [
    "changed bundle",
    ({ bundle, root }) => {
      bundle.status = "incomplete";
      writeFileSync(path.join(root, "bundle.json"), JSON.stringify(bundle));
    },
  ],
  [
    "invented setup inventory",
    ({ bundle }) => {
      writeFileSync(
        path.join(bundle.input.skillRoot, "rules/README.md"),
        "[Extra](missing.md)",
      );
    },
  ],
  [
    "dirty reviewed checkout",
    ({ bundle }) => {
      writeFileSync(
        path.join(bundle.input.repository, "example.ts"),
        "unreviewed changes",
      );
    },
  ],
  [
    "different checkout head",
    ({ bundle }) => {
      execFileSync("git", ["switch", "--detach", bundle.input.base], {
        cwd: bundle.input.repository,
        stdio: "pipe",
      });
    },
  ],
] satisfies [string, NonNullable<FixtureOptions["corrupt"]>][]) {
  test(`${title} fails the real filesystem gate`, () =>
    scenario({ corrupt }, async (state) => {
      const result = await state.run();
      assert.equal(result.status, "failed");
      assert.match(result.error ?? "", /Artefact validation failed/);
      assert.equal(
        state.calls.filter((label) => label === "save-artefacts").length,
        1,
      );
    }));
}

test("an explicit package location is required before any agent is scheduled", () =>
  scenario({}, async (state) => {
    const result = await state.run({ packageRoot: null });
    assert.equal(result.status, "failed");
    assert.equal(state.calls.length, 0);
  }));

test("path traversal is rejected before any agent is scheduled", () =>
  scenario({}, async (state) => {
    const result = await state.run({ artifacts: "/tmp/../etc" });
    assert.equal(result.status, "failed");
    assert.equal(state.calls.length, 0);
  }));

test("evidence gaps remain visible in the report and result", () =>
  scenario(
    {
      mutate: (value) => {
        if (value.stage === "research") {
          value.gaps = [
            "Notion is unavailable; ownership decision remains unverified",
          ];
        }
      },
    },
    async (state) => {
      const result = await state.run();
      assert.equal(result.value.status, "complete");
      assert.match(
        readFileSync(result.value.reportPath!, "utf8"),
        /Notion is unavailable/,
      );
      assert.deepEqual(result.value.coverageGaps, [
        {
          stage: "research",
          reason:
            "Notion is unavailable; ownership decision remains unverified",
        },
      ]);
    },
  ));

test("fresh invocation identity prevents stale journal replay", () =>
  scenario({}, async (state) => {
    const entries: WorkflowJournalEntry[] = [];
    const first = await state.run(
      {},
      { journal: { append: (entry) => entries.push(entry) } },
    );
    assert.equal(first.value.status, "complete");
    rmSync(first.value.reportPath!);
    const second = await state.run(
      { invocationId: "invocation-two" },
      { journal: { entries } },
    );
    assert.equal(second.value.status, "complete");
    assert.equal(second.replayedCount, 0);
    assert.ok(readFileSync(second.value.reportPath!, "utf8"));
  }));

test("parent validation detects missing files even if a caller reuses journal identity", () =>
  scenario({}, async (state) => {
    const entries: WorkflowJournalEntry[] = [];
    const first = await state.run(
      {},
      { journal: { append: (entry) => entries.push(entry) } },
    );
    rmSync(first.value.reportPath!);
    const replay = await state.run({}, { journal: { entries } });
    assert.ok(replay.replayedCount > 0);
    const validation = spawnSync("sh", ["-c", replay.value.validationCommand], {
      encoding: "utf8",
    });
    assert.notEqual(validation.status, 0);
    assert.match(validation.stderr, /Missing artefact/);
  }));

test("persistence failure reports blocked progress without retrying the writer", () =>
  scenario(
    {
      notify: true,
      corrupt: ({ root }) => {
        rmSync(path.join(root, "review-report.md"));
      },
    },
    async (state) => {
      const result = await state.run();
      assert.equal(result.status, "failed");
      assert.ok(state.calls.includes("notify:save-artefacts:blocked"));
      assert.equal(
        state.calls.includes("notify:save-artefacts:complete"),
        false,
      );
      assert.equal(
        state.calls.filter((label) => label === "save-artefacts").length,
        1,
      );
    },
  ));

test("wrapper rule collections participate in full coverage", () =>
  scenario({ wrapper: true }, async (state) => {
    const result = await state.run();
    assert.equal(result.value.status, "complete");
    assert.equal(state.bundle.stages.rules!.rules.length, 3);
    assert.match(
      readFileSync(result.value.reportPath!, "utf8"),
      /ownership\.md/,
    );
  }));

test("a review with retained defects completes without claiming publication or approval", () =>
  scenario(
    {
      mutate: (value) => {
        if (value.stage === "correctness") {
          value.findings.push({
            id: "F1",
            kind: "bug",
            disposition: "required",
            title: "Caller loses the update",
            location: "example.ts:4",
            trigger: "Updating an existing item",
            effect: "The saved value stays stale",
            action: "Persist the updated value",
            evidence: ["example.ts:4 caller trace"],
            existingThread: null,
          });
        }
        if (value.stage === "report") {
          value.decisions = [
            {
              sourceId: "correctness:F1",
              disposition: "retained",
              reportId: "F1",
              reason: "Caller trace supports the defect",
            },
          ];
          value.markdown +=
            "\nF1: Existing-item updates leave the saved value stale. Persist the updated value.\n";
        }
        if (value.stage === "decision" && value.approval.checks) {
          value.approval.checks.clean_review.result = "Fail";
        }
      },
    },
    async (state) => {
      const result = await state.run();
      assert.equal(result.value.status, "complete");
      assert.equal(result.value.published, false);
      assert.match(
        readFileSync(result.value.reportPath!, "utf8"),
        /F1: Existing-item updates/,
      );
    },
  ));

test("wrong complete-diff counts cannot pass the saved-bundle gate", () =>
  scenario(
    {
      mutate: (value) => {
        if (value.stage === "setup") {
          value.addedLines = 99;
        }
      },
    },
    async (state) => {
      const result = await state.run();
      assert.equal(result.status, "failed");
      assert.match(result.error ?? "", /Artefact validation failed/);
    },
  ));

test("workers load their assigned sections from the packaged review skill", () =>
  scenario({}, async (state) => {
    const result = await state.run();
    assert.equal(result.value.status, "complete");
    assert.equal(
      state.instructions.get("research"),
      path.join(state.args.skillRoot, "SKILL.md") + "#step-2-research",
    );
    assert.equal(
      state.instructions.get("correctness"),
      path.join(state.args.skillRoot, "SKILL.md") +
        "#q-is-this-implementation-correct",
    );
    assert.equal(
      state.instructions.get("rules"),
      path.join(state.args.skillRoot, "SKILL.md") +
        "#step-4-check-review-rules",
    );
  }));

test("dry-run publication renders the existing helper payload without network writes", () =>
  scenario(
    {
      publication: { mode: "dry-run", repository: "fixture/app", prNumber: 1 },
    },
    async (state) => {
      const result = await state.run();
      assert.equal(result.status, "completed", result.error);
      assert.equal(result.value.publication.status, "rendered");
      assert.equal(result.value.published, false);
      const preview = JSON.parse(
        readFileSync(
          path.join(state.args.artifacts, "publication-preview.json"),
          "utf8",
        ),
      );
      assert.equal(preview.dry_run, true);
    },
  ));

test("publication failure is not retried or reported as complete delivery", () =>
  scenario(
    {
      publication: { mode: "github", repository: "fixture/app", prNumber: 1 },
      failPublication: true,
    },
    async (state) => {
      const result = await state.run();
      assert.equal(result.status, "failed");
      assert.equal(
        state.calls.filter((label) => label === "publication").length,
        1,
      );
      assert.match(result.error ?? "", /Publication was not confirmed/);
    },
  ));

test("large generated coverage can be split into publication continuation comments", () =>
  scenario(
    {
      publication: { mode: "dry-run", repository: "fixture/app", prNumber: 1 },
      mutate: (value) => {
        if (questions.some((question) => question === value.stage)) {
          value.checks = [0, 1, 2].map((index) => ({
            ...value.checks[0],
            item: `${value.stage} check ${index}`,
            reason: "Source evidence and coverage detail. ".repeat(400),
          }));
        }
      },
    },
    async (state) => {
      const result = await state.run();
      assert.equal(result.status, "completed", result.error);
      assert.equal(result.value.publication.status, "rendered");
      const preview = JSON.parse(
        readFileSync(
          path.join(state.args.artifacts, "publication-preview.json"),
          "utf8",
        ),
      );
      assert.ok(preview.report_parts.length > 1);
    },
  ));

test("semantic approval errors retry the decision stage before writing", () =>
  scenario(
    {
      mutate: (value, attempt) => {
        if (value.stage === "decision" && attempt === 1) {
          value.approval.outcome = "approve";
          value.approval.checks!.verification.result = "Fail";
        }
      },
    },
    async (state) => {
      const result = await state.run();
      assert.equal(result.value.status, "complete");
      assert.equal(
        state.calls.filter((label) => label === "decision:2").length,
        1,
      );
      assert.equal(
        state.calls.filter((label) => label === "correctness:1").length,
        1,
      );
      assert.equal(
        state.calls.filter((label) => label === "save-artefacts").length,
        1,
      );
      assert.match(state.bundle.attempts[0].reason, /every checklist item/);
    },
  ));

test("template source evidence survives stage validation and persistence", () =>
  scenario(
    {
      mutate: (value) => {
        if (value.stage === "correctness") {
          value.markdown +=
            "\nThe template renders `{{ user.name }}`.\n```handlebars\n# Review: {{ target }}\n```\n";
        }
      },
    },
    async (state) => {
      const result = await state.run();
      assert.equal(result.value.status, "complete");
      assert.match(
        readFileSync(path.join(state.args.artifacts, "correctness.md"), "utf8"),
        /\{\{ user.name \}\}/,
      );
    },
  ));
