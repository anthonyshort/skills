/**
 * Check the accepted-data handoff to Picco without agents or real delivery.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { githubReviewBody, githubReviewRequest } from "./index.js";
import type { ReviewResults } from "../../steps.js";

const input = {
  github: { repository: "owner/app", pr: 42 },
  head: "a".repeat(40),
  publication: "publish" as const,
};

const check = { result: "Pass", reason: "Source checked." } as const;
const checks: NonNullable<ReviewResults["decision"]["approval"]["checks"]> = {
  focused: check,
  low_risk: check,
  no_sensitive_changes: check,
  clean_review: { result: "Fail", reason: "F1 needs correction." },
  complete_review: check,
  verification: check,
  concerns_resolved: check,
};
const approval: ReviewResults["decision"]["approval"] = {
  outcome: "changes_needed",
  changed_lines: 25,
  checks,
  reason: "F1 needs correction.",
  next_steps: ["Correct F1 and request another review."],
};

test("only an eligible publish request may approve", () => {
  assert.equal(
    githubReviewRequest({
      input,
      outcome: "approve",
      comments: [],
      body: "Report",
    }).action,
    "approve",
  );
  assert.equal(
    githubReviewRequest({
      input: { ...input, publication: "comment-only" },
      outcome: "approve",
      comments: [],
      body: "Report",
    }).action,
    "comment",
  );
  assert.equal(
    githubReviewRequest({
      input,
      outcome: "changes_needed",
      comments: [],
      body: "Report",
    }).action,
    "comment",
  );
});

test("review submission pins accepted findings and omits internal finding IDs", () => {
  assert.deepEqual(
    githubReviewRequest({
      input,
      outcome: "changes_needed",
      body: "Accepted report",
      comments: [
        {
          id: "bug-1",
          path: "src/app.ts",
          line: 12,
          side: "RIGHT",
          body: "The empty input throws.",
        },
      ],
    }),
    {
      repository: "owner/app",
      pullRequest: 42,
      action: "comment",
      commitId: "a".repeat(40),
      body: "Accepted report",
      comments: [
        {
          path: "src/app.ts",
          line: 12,
          side: "RIGHT",
          body: "The empty input throws.",
        },
      ],
    },
  );
});

for (const heading of ["Findings", "Opportunities"]) {
  test(`should show next steps before ${heading.toLowerCase()} and fold detailed evidence`, () => {
    const assessment = [
      "- **Overall:** One correction is needed.",
      "<details>\n<summary>Research sources</summary>\n\n#### Inspected sources\n\nSource evidence.\n\n</details>",
      "<details>\n<summary>Approach and alternatives</summary>\n\nThe approach fits.\n\n</details>",
    ].join("\n\n");
    const findings = `#### ${heading}\n\n- **F1 — Correct the empty input:** Keep this finding and its ID.`;
    const report = "# Canonical report\n\nDetailed evidence for F1.";
    const body = githubReviewBody({
      summaryMarkdown: `${assessment}\n\n${findings}`,
      approval,
      report,
    });

    assert.ok(body.startsWith(assessment));
    assert.ok(
      body.includes(
        `#### Next steps\n\n- Correct F1 and request another review.\n\n${findings}`,
      ),
    );
    const [visible, fullReport] = body.split(
      "<details>\n<summary>Full report</summary>",
    );
    assert.ok(visible.includes(findings));
    assert.ok(!visible.includes("Approval checks"));
    assert.ok(!visible.includes(report));
    assert.ok(
      fullReport.includes("- clean_review: Fail. F1 needs correction."),
    );
    assert.ok(fullReport.includes(report));
    assert.ok(fullReport.endsWith("\n\n</details>"));
  });
}

test("should append split actions after summary folds without approval checks", () => {
  const summaryMarkdown =
    "- **Overall:** Split the change first.\n\n<details>\n<summary>Approach and alternatives</summary>\n\nImplementation review was deferred.\n\n</details>";
  const body = githubReviewBody({
    summaryMarkdown,
    approval: {
      outcome: "split",
      changed_lines: 2500,
      checks: null,
      reason: "The change needs smaller review boundaries.",
      next_steps: ["Separate the migration from the feature."],
    },
    report: "# Split plan\n\nMigration first, feature second.",
  });

  assert.ok(
    body.startsWith(
      `${summaryMarkdown}\n\n#### Next steps\n\n- Separate the migration from the feature.\n\n<details>\n<summary>Full report</summary>`,
    ),
  );
  assert.ok(!body.includes("Approval checks"));
  assert.ok(body.includes("# Split plan\n\nMigration first, feature second."));
});

test("should omit next steps when no action is required", () => {
  const body = githubReviewBody({
    summaryMarkdown: "- **Overall:** No supported bugs were found.",
    approval: {
      ...approval,
      outcome: "approve",
      reason: "No corrections are needed.",
      checks: { ...checks, clean_review: check },
      next_steps: [],
    },
    report: "# Canonical report",
  });

  assert.ok(!body.includes("#### Next steps"));
});
