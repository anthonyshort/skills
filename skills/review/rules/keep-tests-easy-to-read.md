# Keep tests easy to read

## When to check

A change adds tests or changes their names, grouping, order or setup helpers.

Vitest and Jest are the usual examples. Apply the same checks to Playwright and other tests, using that framework’s grouping and test syntax.

## What to check

- **Names:** Use simple English to say what should happen. Read the name with its `describe` groups. Replace wordy phrases such as “receives validation feedback before its fresh attempt” with “should show feedback before trying again”.
- **Groups:** Start with the module or thing being tested. Group related cases by feature or situation in nested `describe` blocks. Prefer short `it("should …")` names that complete the group’s meaning.
- **Order:** Put related cases together. Start with basic behaviour, then variations, failures and edge cases. Make it clear where a new test belongs.
- **Behaviour:** Describe what the user or caller can do and observe. Avoid names tied to private helpers, mock calls or internal steps unless those are the contract being tested.
- **Size:** Keep each test about one behaviour. Several assertions are fine when they prove that behaviour.
- **Body:** Make setup, action and expected result easy to follow. Use named builders and helpers for shared setup or distracting detail. Keep important inputs and assertions visible. Avoid vague helpers and boolean options that hide what the test does.
- **Independence:** File order helps readers. Tests must not depend on earlier tests having run. Keep shared setup small and give each test fresh state.

Naming and organisation matter even when the assertions are correct.

## When reviewing

- If a new test is hard to read or does not fit the suite, ask for the tests to be updated where practical. Do not just point out the problem.
- Suggest a structure using the actual feature and case names. Show where the new test belongs and which nearby cases to group or rename. For a noisy body, suggest named setup helpers and show the main actions and assertions.
- Keep the change focused on the affected feature and nearby tests. Do not require a whole-file rewrite for one new case. Preserve useful assertions and independent setup.

For example, suggest an outline like this, adapted to the cases in the file:

```text
Answer form
  submitting an answer
    should accept a complete answer
    should explain why an answer is too short
  trying again
    should clear the feedback after a successful answer
    should show new feedback if the answer is still too short
```

## Why it matters

Tests explain the module to the next developer. Clear names and groups make behaviour easy to scan. Small, readable cases are easier to extend and less tied to implementation details.

## Exceptions

A small suite may not need nested groups. Add a group only when it helps readers. A clear name without “should” is fine. Keep real domain terms and useful technical detail. Some repeated setup is better than hiding the case inside a helper. Use table tests when the cases share the same behaviour and each case has a readable name.

## Good and bad examples

Bad title: “a rejected answer receives validation feedback before its fresh attempt”.

Use groups for context and a short name for the result. This excerpt uses an existing builder for the real form. Its methods perform public form actions.

```typescript
describe("Answer form", () => {
  describe("when an answer is too short", () => {
    it("should show feedback before trying again", async () => {
      const form = createAnswerForm({ minimumLength: 20 });

      await form.submit("Too short");
      expect(form.feedback).toBe("Use at least 20 characters.");

      await form.submit("An answer with enough detail.");
      expect(form.acceptedAnswer).toBe("An answer with enough detail.");
      expect(form.feedback).toBeUndefined();
    });
  });
});
```

The builder hides wiring. The test shows the rejection, feedback and successful retry as one user journey.

## References

- [Software Engineering at Google: Unit Testing](https://abseil.io/resources/swe-book/html/ch12.html): Behaviour-focused tests, clear names and bodies, and useful helpers without excessive deduplication.
- [Jest: describe](https://jestjs.io/docs/api#describename-fn): Grouping related cases and nesting suites.
- [Jest: order of execution](https://jestjs.io/docs/setup-teardown#order-of-execution): Suite collection and test execution. The suggested reading order above is a house style, not a framework requirement.
- [Playwright: testing philosophy](https://playwright.dev/docs/best-practices#testing-philosophy): User-visible behaviour and independent tests.
