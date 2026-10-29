/**
 * Check rule accounting with small explicit inputs. No agents or files are used.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { RuleSchema } from "./contracts.js";
import { validateRuleCoverage } from "./validation.js";

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
