---
name: testing-best-practices
description: Write, refactor, or review tests for changed behaviour, bug fixes, error paths, concurrency, or concrete coverage gaps using observable regression evidence.
---

# Testing

## Goal

Prove intended behaviour with focused, reliable tests. Choose tests that would catch a real mistake.

## Verification checklist

Use the checks relevant to the change. Record evidence and explain skipped or blocked checks. Reading this list does not complete a check.

- [ ] **Coverage**: Cover changed behaviour and the boundaries or failures it introduces. Reuse existing tests when they already catch the risk.
- [ ] **Test layer**: Use the cheapest layer that can catch the regression without bypassing the behaviour.
- [ ] **Placement**: Keep tests beside the code that owns the behaviour, subject to runner constraints.
- [ ] **Correct expectations**: Verify the inputs and expected outputs independently of the implementation.
- [ ] **Useful assertions**: Check that the test rejects both a no-op and plausible wrong results.
- [ ] **Regression evidence**: Where practical, show that the test fails without the fix for the intended reason.
- [ ] **Real behaviour**: Keep the behaviour under test real. Mock external effects at their boundary.
- [ ] **Valid fixtures**: Check that fixtures and mocks represent the claimed case and do not supply the answer.
- [ ] **Readable cases**: Keep the scenario, action and expected result clear. Avoid helpers and snapshots that hide the contract.
- [ ] **Isolation and timing**: Reset shared state, release owned resources and control time or promises instead of sleeping.
- [ ] **Integration risks**: Cover changed wiring and async paths that isolated tests cannot prove.
- [ ] **Execution**: Run focused checks and report actual results. Keep import and setup costs proportionate.

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
- **Justify React tests**: Name the interaction, permission, focus, recovery or lifecycle risk. Thin wrappers, styling and prop forwarding alone do not justify another component test. Keep existing useful tests.
- **Avoid artificial coverage**: Type-only changes, barrel exports, generated code, trivial forwarding and formatting do not need tests solely because they changed. Test a consumer contract if it is at risk.
- **Keep tests local**: Put `x.test.ts` beside `x.ts`. Use `x.test.tsx` when JSX is needed. Test factories beside the factory and behaviour beside its owner, even when construction uses a factory.
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

- **Keep the claim real**: Do not mock the operation whose behaviour you claim to test. Keep domain collaborators real when they are part of that claim.
- **Inject dependencies through supported APIs**: Use constructors, factories or providers. Avoid replacing modules or reaching into private implementation details.
- **Mock external effects**: Use a boundary handler, such as the project's MSW setup, for network calls. Assert caller-visible results and meaningful wire fields rather than internal helper calls.
- **Reuse test infrastructure**: Share the supported server and lifecycle. If none exists, configure one through the runner. Avoid duplicate interceptors. Keep unavoidable browser/runtime stand-ins in shared setup.
- **Handle requests deliberately**: Reset per-case handlers and fail unexpected requests. Do not simulate a database with fragile matching of production query strings.
- **Keep fixtures honest**: A mock must not bypass the branch being tested or manufacture the expected result. An in-memory collaborator can suit a unit test, but does not prove real transport, persistence or cross-store wiring.
- **Use call counts selectively**: Assert them when frequency is itself part of the observable contract. Otherwise assert the result.

## Keep cases readable and reliable

- **Name the scenario and result**: Prefer “keeps zoom when equivalent bounds arrive” over “works”. One case should describe one behaviour. Several assertions may establish that result.
- **Keep important details visible**: Show the branch-driving inputs, action and assertions in the case. Extract only repeated mechanical setup. Prefer explicit fixture overrides to boolean helper switches or giant shared fixtures.
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
