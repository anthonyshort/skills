/**
 * Check rule accounting with small explicit inputs. No agents or files are used.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { RuleSchema } from "./schemas.js";
import { validateAnswer, validateRuleCoverage } from "./validation.js";

test("worker evidence must match the pinned revisions", () => {
  assert.throws(
    () =>
      validateAnswer({
        input: { base: "a".repeat(40), head: "b".repeat(40) },
        result: {
          base: "a".repeat(40),
          head: "c".repeat(40),
          checks: [],
          findings: [],
        },
      }),
    /revisions differ from pinned inputs/,
  );
});

const checkedRule = RuleSchema.parse({
  path: "/rules/await-operations.md",
  selection: "selected",
  result: "Satisfied",
  reason: "The caller awaits the save.",
  evidence: ["save.ts:12"],
});

test("rule coverage rejects a silently omitted rule", () => {
  assert.throws(
    () =>
      validateRuleCoverage({
        rules: [checkedRule],
        expectedPaths: [checkedRule.path, "/rules/shared-state.md"],
      }),
    /missing, duplicate or unexpected paths/,
  );
});

test("an explicitly skipped rule still counts as accounted for", () => {
  const skipped = RuleSchema.parse({
    ...checkedRule,
    selection: "skipped",
    result: "Skipped",
    reason: "No relevant asynchronous operation changed.",
    evidence: [],
  });
  assert.doesNotThrow(() =>
    validateRuleCoverage({
      rules: [skipped],
      expectedPaths: [skipped.path],
    }),
  );
});
