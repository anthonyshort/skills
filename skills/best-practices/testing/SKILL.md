---
name: testing
description: Write, refactor, or review tests for changed behaviour, bug fixes, error paths, concurrency, or concrete coverage gaps using observable regression evidence.
---

# Testing

## Goal

Prove intended behaviour with focused, reliable tests. Choose tests that would catch a real mistake.

## Choose the right test

| Changed behaviour | What to exercise and assert |
| --- | --- |
| Store | Public actions, resulting state, derived values and domain effects. Check related-field invariants, repeated actions and cleanup when affected. |
| Application client | The real public operation and the resource, content, state or error callers observe. Check request fields when they carry the contract. |
| Utility | Calculations, conversions, filtering, ordering or validation with independently worked expected values. |
| Schema or type guard | Relevant accepted and rejected inputs. |
| Serializer | The output consumers receive. |
| Component or hook | A concrete UI interaction, wiring or lifecycle risk that lower-layer tests cannot catch. |
| Integration boundary | Behaviour across changed transport, persistence or cross-module wiring. |

- **Test the owning layer**: Prefer stores, clients and pure functions for domain logic. Add undo/redo, persistence or multi-store cases when the change depends on them.
- **Justify React tests**: Default against broad suites for simple product components. Name the interaction, permission, focus, recovery, wiring or lifecycle failure that lower-layer tests cannot catch. Thin wrappers, styling and prop forwarding alone do not justify another component test. Shared interaction primitives can warrant deeper coverage. Keep existing useful tests.
- **Weigh protection against cost**: Identify the plausible regression each case catches, overlap with existing coverage, actual consumers and failure consequences. Compare that protection with providers, mocks, timing controls and coupling to implementation details. Test counts and coverage percentages are not value thresholds. Extract meaningful calculations or domain transitions to their natural owner when that improves the design. Do not add a hook or move local state into a store solely for testing.
- **Avoid artificial coverage**: Type-only changes, barrel exports, generated code, trivial forwarding and formatting do not need tests solely because they changed. Test a consumer contract if it is at risk.
- **Keep tests local**: Put `x.test.ts` beside `x.ts`. Use `x.test.tsx` when JSX is needed. Test factories beside the factory and behaviour beside its owner, even when construction uses a factory.
- **Group distinct suites when useful**: A feature with several distinct suites can use a nearby `tests/` or `perf/` folder. Keep ordinary tests colocated by default. Avoid multiplying filename suffixes just to organise cases, and verify runner discovery before moving tests.

```text
feature/
  calculate.ts
  calculate.test.ts
  perf/
    calculate.bench.ts
```

- **Respect runner constraints**: Follow supported browser or integration test locations. Keep framework-discovered routes thin if their folders cannot contain tests. Do not change suffixes just to select a mock setup.
- **Make review requests specific**: Name the unprotected behaviour and the cheapest useful test. Do not request a test for every React file or unrelated legacy coverage.

## Check that tests prove the right thing

- **Derive expectations independently**: Use requirements, domain rules or a small worked example. Current output, copied algorithms and other tests are not independent proof. Report unclear intent.
- **Assert the result**: Calling an action is not enough. Check the observable state, value or effect. Avoid tests that only assign a plain field and read it back.
- **Try a wrong implementation**: Could wrong filtering, ordering, arithmetic or state transitions still pass? A no-op check alone is not enough.
- **Check regressions**: When practical, run the test without the fix and confirm it fails for the intended defect.
- **Choose relevant cases**: Use empty, missing, duplicate, boundary or precision inputs when the changed contract makes them meaningful.

```typescript
// Contract: the arithmetic mean of all supplied values.
// Wrong: this expectation repeats a bug in the divisor.
expect(average([2, 4, 9])).toBe(7.5);

// Correct: sum 15, count 3, mean 5.
expect(average([2, 4, 9])).toBe(5);
```

Require expected failures. An assertion inside `.catch()` never runs if the promise resolves.

```typescript
// Weak: passes if readInvoice resolves.
await readInvoice("missing").catch(error => {
  expect(error).toBeInstanceOf(InvoiceNotFoundError);
});

// Requires rejection. Use the equivalent in the project's test runner.
await expect(readInvoice("missing")).rejects.toBeInstanceOf(InvoiceNotFoundError);
```

## Set useful test boundaries

- **Keep the claim real**: Do not mock the operation whose behaviour you claim to test. Keep domain collaborators real when they are part of that claim. To check how a client sends requests, saves data or handles failure, use the real client with fake responses from the service it calls. A permission calculation implemented entirely in the frontend can be tested directly without a network request.
- **Inject dependencies through supported APIs**: Use constructors, factories or providers. Avoid replacing modules or reaching into private implementation details.
- **Mock external effects**: Use a boundary handler, such as the project's MSW setup, for network calls. Assert caller-visible results and meaningful wire fields rather than internal helper calls.
- **Reuse test infrastructure**: Share the supported server and lifecycle. If none exists, configure one through the runner. Avoid duplicate interceptors. Keep unavoidable browser/runtime stand-ins in shared setup.
- **Handle requests deliberately**: Reset per-case handlers and fail unexpected requests. Do not simulate a database with fragile matching of production query strings.
- **Keep fixtures honest**: A mock must not bypass the branch being tested or manufacture the expected result. An in-memory collaborator can suit a unit test, but does not prove real transport, persistence or cross-store wiring.
- **Use call counts selectively**: Assert them when frequency is itself part of the observable contract. Otherwise assert the result.

## Keep cases readable and reliable

These naming and structure guidelines apply to Vitest, Jest, Playwright and other tests. Use the framework’s own grouping and test syntax.

- **Use simple test names**: Say what the user or caller should see. Prefer short `it("should …")` names over technical stories about internal steps. Read the name with its surrounding groups. One case should describe one behaviour, which may need several assertions.
- **Group and order by behaviour**: Use `describe` for the module, then nested groups for related features or situations when useful. Put basic behaviour before nearby variations, failures and edge cases. Make the file easy to scan and a new case easy to place. Tests must still run independently.
- **Keep bodies easy to follow**: Show the important inputs, action and assertions. Use named builders and helpers to hide shared setup or distracting wiring. Keep case-specific details visible. Prefer explicit fixture values to boolean helper switches or giant shared fixtures. Some duplication is clearer than another helper.
- **Choose assertions deliberately**: Prefer concrete expected fields. Use snapshots when the complete stable output matters and can be reviewed. Avoid broad UI or request snapshots that lock down incidental details.
- **Use tables for one rule**: Parameterise cases with the same behaviour and assertion structure. Keep unrelated scenarios separate.
- **Control async work**: Use controlled promises and scheduling APIs. Use fake clocks for timers. Await promise assertions. Do not hide flakiness with sleeps or larger timeouts.
- **Clean up**: Reset mutable fixtures and handlers. Dispose stores and subscriptions owned by the test.
- **Keep imports light**: Import the implementation directly. Avoid unrelated UI barrels in pure tests.

## Verify the change

- Read nearby tests and use the supported framework, helpers and runner setup. Report conflicts with supplied direction.
- Exercise races, retries, timeouts and disconnections when the change introduces or alters those risks.
- Run the focused test file where practical. Check import and setup cost separately when they dominate runtime.
- Record what ran, what passed or failed and what remains unverified. Expand the run when changed boundaries or failures justify it.
