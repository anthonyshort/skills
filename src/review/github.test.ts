/**
 * Check the accepted-data handoff to Picco without agents or real delivery.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { githubReviewRequest } from "./github.js";

const input = {
  github: { repository: "owner/app", pr: 42 },
  head: "a".repeat(40),
  publication: "publish" as const,
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
