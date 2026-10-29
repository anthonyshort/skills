/**
 * Runs the generated script in the real pi-subagents VM with canned workers.
 * Covers stage order, the five-assessment barrier, retries, partial results,
 * notifications and real filesystem gates. It does not test model judgement.
 */
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
    assert.equal(state.calls[0], "setup:1");
    assert.ok(
      state.calls.indexOf("research:1") <
        state.calls.indexOf("researchCheck:1"),
    );
    assert.ok(
      state.calls.indexOf("researchCheck:1") < state.calls.indexOf("product:1"),
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

test("the next review step waits for asynchronous completion updates", () => {
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
      notify: true,
      hold: async (request) => {
        if (request.label === "notify:research:complete") {
          started();
          await held;
        }
      },
    },
    async (state) => {
      const running = state.run();
      await Promise.race([waiting, running]);
      try {
        assert.ok(state.calls.includes("notify:research:complete"));
        assert.equal(state.calls.includes("researchCheck:1"), false);
      } finally {
        release();
      }
      assert.equal((await running).value.status, "complete");
      assert.ok(
        state.calls.indexOf("notify:research:complete") <
          state.calls.indexOf("researchCheck:1"),
      );
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
  scenario(
    { notify: true, fail: (name) => name === "readability" },
    async (state) => {
      const result = await state.run();
      assert.equal(result.value.status, "incomplete");
      assert.equal(result.value.reportPath, null);
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
      const terminal = state.prompts.get("notify:review:incomplete");
      assert.ok(terminal);
      for (const stage of [
        "product",
        "systemFit",
        "simplicity",
        "correctness",
      ] as const) {
        assert.ok(
          state.bundle.stages[stage],
          `${stage} evidence remains accepted`,
        );
        assert.ok(
          !terminal.includes(`${stage}: complete`),
          "assessment progress stays grouped",
        );
      }
      for (const stage of [
        "setup",
        "research",
        "researchCheck",
        "save-artefacts",
      ]) {
        assert.ok(terminal.includes(`${stage}: complete`), stage);
      }
      assert.match(terminal, /assessments: blocked/);
      assert.doesNotMatch(terminal, /assessments: (?:complete|running)/);
      assert.doesNotMatch(
        terminal,
        /(?:rules|consolidation|draft|editorial|report|decision): (?:complete|running|blocked)/,
      );
    },
  ));

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
] satisfies [string, NonNullable<FixtureOptions["mutate"]>][]) {
  test(`${title} cannot produce a complete review`, () =>
    scenario({ mutate }, async (state) => {
      const result = await state.run();
      assert.equal(result.value.status, "incomplete");
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
      "splitPlan:1",
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

test("a review with retained defects completes with a withheld approval assessment", () =>
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

for (const split of [false, true]) {
  test(`${split ? "split" : "full"} review receives embedded instructions without runtime prompt files`, () =>
    scenario({ split }, async (state) => {
      const result = await state.run();
      assert.equal(result.value.status, split ? "split" : "complete");
      const sharedRules = readFileSync(
        new URL("../src/review/prompts/common.md", import.meta.url),
        "utf8",
      );
      for (const stage of Object.keys(state.bundle.stages)) {
        const instructions = readFileSync(
          new URL(`../src/review/prompts/${stage}.md`, import.meta.url),
          "utf8",
        );
        const prompt = state.prompts.get(`${stage}:1`);
        assert.ok(prompt);
        assert.ok(instructions.trim());
        assert.ok(
          prompt.startsWith(sharedRules),
          `${stage} needs shared rules first`,
        );
        assert.ok(
          prompt.includes(instructions),
          `${stage} instructions must be embedded`,
        );
        assert.doesNotMatch(prompt, /^Assigned instructions:/m);
      }
    }));
}

test("large generated coverage stays in bounded detail sections", () =>
  scenario(
    {
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
      const report = readFileSync(result.value.reportPath!, "utf8");
      const folds = report.match(/<details>[\s\S]*?<\/details>/g) ?? [];
      assert.ok(folds.length > 5);
      assert.ok(folds.every((fold) => fold.length < 41_000));
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

test("custom report headings survive review acceptance and saved-file validation", () =>
  scenario(
    {
      mutate: (value) => {
        if (value.stage === "report") {
          value.markdown =
            "# Review outcome\n\nSource inspection found no supported defects.";
        }
      },
    },
    async (state) => {
      const result = await state.run();
      assert.equal(result.value.status, "complete");
      const report = readFileSync(result.value.reportPath!, "utf8");
      assert.match(report, /^# Review outcome/);
      assert.match(report, /correctness observable behaviour/);
      assert.doesNotMatch(report, /^## Assessment$/m);
    },
  ));

test("research acceptance failure stops assessments and preserves the initial brief", () =>
  scenario({ fail: (name) => name === "researchCheck" }, async (state) => {
    const result = await state.run();
    assert.equal(result.value.status, "incomplete");
    assert.ok(state.bundle.stages.research);
    assert.equal(state.calls.includes("product:1"), false);
    assert.equal(
      state.calls.filter((name) => name.startsWith("researchCheck:")).length,
      2,
    );
  }));

test("GitHub progress starts after setup and final publication follows the real save gate", () =>
  scenario({ github: true, notify: true }, async (state) => {
    const result = await state.run();
    assert.equal(result.status, "completed", result.error);
    assert.equal(result.value.publication.status, "confirmed");
    assert.equal(result.value.publication.approval?.status, "withheld");
    const checklist = readFileSync(
      `${state.args.artifacts}/github-checklist.md`,
      "utf8",
    );
    assert.match(checklist, /\[x\] publication: complete/);
    assert.doesNotMatch(checklist, /publication: running/);
    const start = state.calls.findIndex((name) =>
      name.startsWith("github:start:"),
    );
    const finish = state.calls.findIndex((name) =>
      name.startsWith("github:finish:"),
    );
    assert.ok(start > state.calls.indexOf("setup:1"));
    assert.ok(start < state.calls.indexOf("research:1"));
    assert.ok(finish > state.calls.indexOf("save-artefacts"));
    assert.equal(
      state.calls.filter((name) => name.startsWith("github:finish:")).length,
      1,
    );
    for (const stage of [
      "setup",
      "research",
      "researchCheck",
      "rules",
      "consolidation",
      "draft",
      "editorial",
      "report",
      "decision",
    ]) {
      assert.equal(state.phases.get(`${stage}:1`), stage, `${stage} UI phase`);
    }
    for (const stage of questions) {
      assert.equal(state.phases.get(`${stage}:1`), "assessments");
    }
    assert.equal(state.phases.get("save-artefacts"), "save-artefacts");
    const terminal = state.prompts.get("notify:review:complete");
    assert.ok(terminal);
    assert.match(
      terminal,
      /https:\/\/github.com\/fixture\/app\/pull\/7#issuecomment-1/,
    );
    assert.match(terminal, /Approval submission: withheld/);
    assert.equal(result.value.approval?.outcome, "human_review");
  }));

for (const publication of ["local-only", "staged"] as const) {
  test(`${publication} saves review output without scheduling either delivery destination`, () =>
    scenario({ github: true, notify: true, publication }, async (state) => {
      const result = await state.run();
      assert.equal(result.value.status, "complete");
      assert.equal(result.value.publication.status, "skipped");
      assert.deepEqual(result.value.notifications, []);
      assert.equal(
        state.calls.some((name) => /^(github|notify):/.test(name)),
        false,
      );
      assert.ok(readFileSync(result.value.reportPath!, "utf8"));
    }));
}

for (const deliveryFailure of ["start", "update", "finish"] as const) {
  test(`lost GitHub ${deliveryFailure} response leaves assessments and host notifications running`, () =>
    scenario({ github: true, notify: true, deliveryFailure }, async (state) => {
      const result = await state.run();
      assert.equal(result.value.status, "complete");
      assert.equal(
        state.calls.filter((name) => name === "correctness:1").length,
        1,
      );
      assert.ok(state.calls.includes("notify:review:complete"));
      assert.equal(
        result.value.publication.status,
        deliveryFailure === "finish" ? "uncertain" : "confirmed",
      );
      if (deliveryFailure === "finish") {
        assert.equal(
          state.calls.filter((name) => name.startsWith("github:finish:"))
            .length,
          1,
        );
        assert.match(result.value.publication.reason, /Inspect .*github.json/);
      }
    }));
}

test("failed saving interrupts progress and never publishes final GitHub results", () =>
  scenario(
    {
      github: true,
      corrupt: ({ root }) => rmSync(path.join(root, "review-report.md")),
    },
    async (state) => {
      const result = await state.run();
      assert.equal(result.status, "failed");
      assert.equal(
        state.calls.some((name) => name.startsWith("github:finish:")),
        false,
      );
      assert.ok(
        state.calls.some((name) => name.startsWith("github:interrupt:")),
      );
      const checklist = readFileSync(
        `${state.args.artifacts}/github-checklist.md`,
        "utf8",
      );
      assert.match(checklist, /\[x\] report: complete/);
      assert.match(checklist, /save-artefacts: blocked/);
    },
  ));

test("incomplete review interrupts GitHub and returns accepted partial evidence", () =>
  scenario(
    { github: true, fail: (name) => name === "readability" },
    async (state) => {
      const result = await state.run();
      assert.equal(result.value.status, "incomplete");
      assert.equal(result.value.publication.status, "rejected");
      assert.ok(state.bundle.stages.correctness);
      assert.equal(
        state.calls.some((name) => name.startsWith("github:finish:")),
        false,
      );
    },
  ));

test("missing host notify tool records rejected delivery without preventing GitHub publication", () =>
  scenario(
    { github: true, notify: true, notificationAvailable: false },
    async (state) => {
      const result = await state.run();
      assert.equal(result.value.status, "complete");
      assert.equal(result.value.publication.status, "confirmed");
      assert.ok(
        result.value.notifications.every(
          (entry) => entry.receipt.status === "rejected",
        ),
      );
    },
  ));

test("changing notification scope is reported as uncertain rather than claiming one-message updates", () =>
  scenario(
    { notify: true, notificationScope: (attempt) => `session-${attempt}` },
    async (state) => {
      const result = await state.run();
      assert.equal(result.value.status, "complete");
      assert.equal(result.value.notifications[0].receipt.status, "confirmed");
      assert.equal(result.value.notifications[1].receipt.status, "uncertain");
      assert.match(
        result.value.notifications[1].receipt.reason,
        /scope changed/,
      );
      for (const entry of result.value.notifications) {
        assert.equal(entry.receipt.broadcast?.messageKey, "fixture-run");
      }
    },
  ));

test("unaccepted setup saves incomplete evidence without starting delivery", () =>
  scenario(
    { github: true, notify: true, fail: (name) => name === "setup" },
    async (state) => {
      const result = await state.run();
      assert.equal(result.value.status, "incomplete");
      assert.equal(result.value.publication.status, "skipped");
      assert.equal(
        state.calls.some((name) => /^(github|notify):/.test(name)),
        false,
      );
    },
  ));

for (const deliveryFailure of [undefined, "interrupt"] as const) {
  test(`freshness refusal survives ${deliveryFailure ? "a failed" : "a confirmed"} progress interruption`, () =>
    scenario(
      {
        github: true,
        notify: true,
        deliveryFailure,
        publicationRefusal: "New discussion contradicts the accepted scope",
      },
      async (state) => {
        const result = await state.run();
        assert.equal(result.value.status, "complete");
        assert.equal(result.value.publication.status, "rejected");
        assert.equal(
          result.value.publication.reason,
          "New discussion contradicts the accepted scope",
        );
        const finish = state.calls.findIndex((name) =>
          name.startsWith("github:finish:"),
        );
        assert.ok(
          state.calls
            .slice(finish + 1)
            .some((name) => name.startsWith("github:interrupt:")),
        );
        assert.equal(
          state.calls.filter((name) => name.startsWith("github:finish:"))
            .length,
          1,
        );
        const terminal = state.prompts.get("notify:review:complete");
        assert.ok(terminal);
        assert.match(
          terminal,
          /GitHub: rejected\. New discussion contradicts the accepted scope/,
        );
        assert.match(terminal, /publication: rejected/);
        assert.doesNotMatch(terminal, /GitHub: (?:confirmed|uncertain)/);
      },
    ));
}

test("omitted notification settings still schedule host updates with a stable run key", () =>
  scenario({}, async (state) => {
    Reflect.deleteProperty(state.args, "notification");
    const result = await state.run();
    assert.equal(result.value.status, "complete");
    assert.ok(result.value.notifications.length > 0);
    for (const entry of result.value.notifications) {
      assert.equal(entry.receipt.broadcast?.messageKey, "review:fixture-run");
    }
  }));

test("assessment outputs keep question order when correctness finishes before product", () => {
  let releaseProduct = () => {};
  const correctnessFinished = new Promise<void>((resolve) => {
    releaseProduct = resolve;
  });
  return scenario(
    {
      hold: async (request) => {
        if (request.label === "product:1") {
          await correctnessFinished;
        }
      },
    },
    async (state) => {
      const result = await state.run(
        {},
        {
          journal: {
            append: (entry) => {
              if (entry.text?.includes('"stage":"correctness"')) {
                releaseProduct();
              }
            },
          },
        },
      );
      assert.equal(result.value.status, "complete");
      assert.deepEqual(
        Object.keys(state.bundle.stages).filter((name) =>
          questions.some((question) => question === name),
        ),
        questions,
      );
    },
  );
});

test("all named assessments receive only the accepted research context", () =>
  scenario({}, async (state) => {
    assert.equal((await state.run()).value.status, "complete");
    for (const question of questions) {
      const serialized = state.prompts
        .get(`${question}:1`)
        ?.match(/^Prior accepted results: (.+)$/m)?.[1];
      assert.ok(serialized);
      const context: unknown = JSON.parse(serialized);
      assert.ok(context && typeof context === "object");
      assert.deepEqual(Object.keys(context), [
        "setup",
        "research",
        "researchCheck",
      ]);
    }
  }));

for (const failedStep of ["researchCheck", "draft", "editorial"] as const) {
  test(`${failedStep} failure blocks that step and retains the precise failure`, () =>
    scenario(
      { notify: true, fail: (name) => name === failedStep },
      async (state) => {
        const result = await state.run();
        assert.equal(result.value.status, "incomplete");
        assert.equal(result.value.failures[0].stage, failedStep);
        const terminal = state.prompts.get("notify:review:incomplete");
        assert.ok(terminal);
        assert.match(terminal, new RegExp(`${failedStep}: blocked`));
        assert.doesNotMatch(terminal, new RegExp(`${failedStep}: running`));
        assert.match(
          terminal,
          new RegExp(`${failedStep} failed after two attempts`),
        );
      },
    ));
}
