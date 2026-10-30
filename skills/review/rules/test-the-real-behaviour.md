# Test the real behaviour

## When to check

The change adds or updates tests, changes behaviour covered by tests, or claims that a client, store, provider or interaction is protected by a test.

## What to check

- Name the behaviour the test claims to check, then follow the test to the code that implements it. Does the test use that code, or replace it with a mock that returns the expected answer?
- When checking request construction, response handling or stored results, use the real client or store with controlled responses at the service boundary. Include the real provider when its setup or updates are part of the behaviour being checked.
- Assert the result that matters: which candidate wins, whether the next seek advances, which state changes or what the user can do. A matching call shape alone does not prove those outcomes.
- Describe a plausible mistake and the assertion it would break. Prefer the smallest test that reaches the responsible code, including a focused failure case when the changed behaviour handles failure.

## Why it matters

A test can keep passing when a mock replaces the broken code. Assertions about internal calls can also pass while the feature produces the wrong result.

## Exceptions

Fakes are useful for dependencies outside the behaviour under test. Frontend calculations, including permission calculations, need no network when their inputs are local. A component test is useful for wiring or interaction bugs, but is not required for every change. Keep tests focused on what they claim to prove.

## Good and bad examples

Assume the feature must choose the nearest value at or after the requested position. This example includes the calculation so the difference is visible.

```typescript
function nextPosition(values: readonly number[], position: number): number | undefined {
  return values.filter((value) => value >= position).sort((a, b) => a - b)[0];
}

// Bad: replaces the calculation and checks the supplied answer.
const fakeNextPosition = (): number => 20;
expect(fakeNextPosition()).toBe(20);

// Good: checks selection and advancing through the real calculation.
expect(nextPosition([30, 10, 20], 15)).toBe(20);
expect(nextPosition([30, 10, 20], 21)).toBe(30);
expect(nextPosition([30, 10, 20], 31)).toBeUndefined();
```

These assertions check the calculation only. If a test claims that a seek updates a store or a client sends the correct request, call that real store or client and assert the result at that layer.
