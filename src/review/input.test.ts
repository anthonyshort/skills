/**
 * Check caller defaults and the boundary needed before scheduling review work.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { parseReviewInput } from "./input.js";

const input = {
  packageRoot: "/skills",
  repository: "/app",
  target: "Review app",
  base: "a".repeat(40),
  head: "b".repeat(40),
  runId: "example",
};

test("omitted options derive sibling defaults before workers receive input", () => {
  const parsed = parseReviewInput(input);
  assert.equal(parsed.skillRoot, "/skills/skills/review");
  assert.deepEqual(parsed.notification, { messageKey: "review:example" });
  assert.equal(parsed.publication, "publish");
  assert.equal(parsed.github, null);
  assert.deepEqual(parsed.wrapperSkillRoots, []);
  assert.deepEqual(parsed.contextFiles, []);
});

test("an explicit skill root and disabled notifications retain their meaning", () => {
  const parsed = parseReviewInput({
    ...input,
    skillRoot: "/custom/review",
    notification: null,
  });
  assert.equal(parsed.skillRoot, "/custom/review");
  assert.equal(parsed.notification, null);
});

test("malformed revisions and relative paths fail before review work", () => {
  assert.throws(() => parseReviewInput({ ...input, head: "abc123" }));
  assert.throws(() => parseReviewInput({ ...input, repository: "app" }));
});

test("run labels and absolute paths need not use filename-safe formats", () => {
  const parsed = parseReviewInput({
    ...input,
    runId: "Review app PR 42",
    packageRoot: "/work/../skills",
    repository: "/work/my app",
  });
  assert.equal(parsed.repository, "/work/my app");
  assert.equal(parsed.skillRoot, "/work/../skills/skills/review");
  assert.deepEqual(parsed.notification, {
    messageKey: "review:Review app PR 42",
  });
});
