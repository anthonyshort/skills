---
name: testing-best-practices
description: Write, refactor, or review tests for changed behaviour, bug fixes, error paths, concurrency, or concrete coverage gaps using observable regression evidence.
---

# Testing

## Goal

Show changed behaviour and relevant failure paths with focused, reliable tests.

## Checklist

Track checks in task notes, not here. Mark done only after verifying; explain N/A and report blocked or unverified checks. Run independent checks in parallel where useful.

**Coverage and test placement**

- [ ] **Store coverage** - Test new or changed store actions, derived state and lifecycle behaviour through their public contracts.
- [ ] **Client coverage** - Test new or changed application-client operations and their observable results.
- [ ] **Utility coverage** - Test new or changed utility logic directly, including relevant boundaries.
- [ ] **Test layer** - Use the cheapest layer that can catch the regression without bypassing the behaviour.
- [ ] **React test value** - Require a concrete interaction, wiring or lifecycle risk before requesting a React component test.
- [ ] **Colocated tests** - Put x.test.ts beside x.ts, using x.test.tsx when the test needs JSX.
- [ ] **Existing coverage** - Reuse tests that already prove the changed contract rather than add duplicate coverage.

**Behaviour and regression evidence**

- [ ] **Expected results** - Derive expected values from requirements or domain contracts independently of the implementation.
- [ ] **Observable results** - Assert behaviour, not implementation details alone.
- [ ] **No-op implementations** - Check the test fails if the implementation does nothing.
- [ ] **Regression evidence** - Where practical, show the test fails without the fix.
- [ ] **Changed risks** - Choose failure and boundary cases from changed or introduced risks.

**Test boundaries and fixtures**

- [ ] **Input boundaries** - Test changed schemas and type guards with accepted and rejected inputs.
- [ ] **Serialised results** - Check the observable output of changed serializers.
- [ ] **External mocks** - Replace external effects at their boundary without replacing the domain behaviour being tested.
- [ ] **Fixture validity** - Verify fixtures and mocks represent the claimed case without bypassing the behaviour under test.
- [ ] **Query mocks** - Avoid fragile string matching of production queries.
- [ ] **Mock isolation** - Keep mutable state separate between tests.
- [ ] **Supported helpers** - Use them instead of private implementation details.

**Readability and test cost**

- [ ] **Case names** - Name the input or action and expected outcome.
- [ ] **Local explanation** - Keep the important setup, action and assertions visible in each case.
- [ ] **Small fixtures** - Use valid focused fixtures and helpers that do not hide the scenario.
- [ ] **Independent assertions** - Assert concrete results without copying the implementation or broad incidental snapshots.
- [ ] **Table cases** - Use parameterised cases only when they share the same behaviour and assertion structure.
- [ ] **Controlled timing** - Use fake time or controlled promises rather than sleeps and enlarged timeouts.
- [ ] **Import cost** - Keep pure tests independent of unrelated UI and heavy package imports.

**Integration and asynchronous paths**

- [ ] **Integration evidence** - Test changed boundaries that isolated tests cannot verify.
- [ ] **Async failures** - Cover races, retries, timeouts, and disconnections introduced by the change.
- [ ] **Project conventions** - Follow its framework, helpers, and test locations.

## Guidance

### Coverage and test placement

- Stores, application-facing clients and utility functions are the default owners of behaviour tests. Require coverage for new or changed rules in these layers; their logic is normally straightforward to exercise without React. Cover a representative success case and the boundaries or failures introduced by the change. Existing tests can satisfy this requirement if they would catch the relevant mistake; a coverage percentage alone cannot.
- For stores, call public actions and assert resulting state, derived values or published domain effects. Test invariants across related fields, repeated actions and cleanup when those paths change. Add undo/redo, persistence or multi-store cases when the changed behaviour depends on them. Do not write assignment-only tests that set a plain field and read it back.
- For application-facing clients, exercise the real public operation and assert the resource, content, state or error callers observe. Include meaningful request fields where they carry the contract. Do not prove domain behaviour by mocking that same operation or merely checking which internal helper it calls.
- Test utility calculations, conversions, filtering, ordering and validation directly with independently worked expected values. Select useful empty, missing, duplicate, boundary or precision cases from the contract. Type-only declarations, barrel exports, generated code, trivial forwarding and formatting-only changes do not require artificial new tests. Test the meaningful consumer contract instead when it is at risk.
- Prefer stores, clients and pure functions over React rendering for domain logic. Add a component or hook test only when React-specific wiring, an important user interaction, permission gating, focus, recovery or lifecycle can break despite lower-layer tests. Name that risk. Thin wrappers, styling, prop forwarding and behaviour already guaranteed by a reused primitive do not justify another component test. Existing useful component tests remain valid; this is not a blanket request to delete them.
- Put `x.test.ts` next to the `x.ts` that owns the tested behaviour; use `x.test.tsx` when JSX is needed. Construct the unit through a supported factory when appropriate without moving its behaviour tests away from its implementation. Keep factory-specific tests with the factory. Follow explicit runner constraints for dedicated browser or bundled integration tests and explain the exception; do not use a different suffix just for a different mock setup.
- Follow scoped project requirements and report conflicts with supplied direction rather than silently inventing an exception. For framework-discovered route folders that cannot contain tests, move testable logic to a normal colocated module and keep the route thin.
- In a review, name the specific unprotected behaviour and the cheapest useful test. Do not require a test for every React file or flag unrelated legacy coverage merely because the PR touches the package.

### Behaviour and regression evidence

- Review assertions as claims about intended behaviour. Independently derive expected values from requirements, domain rules, or a small worked example before comparing them with the implementation. Check changed expectations and snapshots against that source; agreement with current output, a copied algorithm, or another test is not proof of correctness. If intent is unclear, report it as unverified.
- Try a plausible wrong result as well as a no-op: wrong filtering, ordering, arithmetic, or state transitions can still satisfy weak assertions. A passing regression test proves correctness only when its expectation is justified.

  ```javascript
  // Contract: arithmetic mean of every supplied value.
  // Bad: a passing assertion can endorse the implementation's wrong divisor.
  assert.equal(average([2, 4, 9]), 7.5);

  // Good: independently worked expectation: sum 15, count 3, mean 5.
  assert.equal(average([2, 4, 9]), 5);
  ```

- Identify the observable result each test should prove. Check whether assertions could pass without that behaviour; checking that setup ran does not prove the result.

  **Avoid — exercising code without asserting the result**

  ```javascript
  import { test } from "node:test";
  import { createCart } from "./cart.js";

  test("adds an item", () => {
    const cart = createCart();
    cart.addItem("item-1");
  });
  ```

  **Prefer — verifying the public result**

  ```javascript
  import { test } from "node:test";
  import assert from "node:assert/strict";
  import { createCart } from "./cart.js";

  test("adds an item", () => {
    const cart = createCart();
    cart.addItem("item-1");
    assert.deepEqual(cart.getItemIds(), ["item-1"]);
  });
  ```

- For regressions, test the unfixed behaviour when practical; confirm the failure shows the intended defect.
- Trace changed risks to the inputs and failure paths that exercise them. Prefer those cases over unrelated exhaustive coverage.

  **Avoid — checking rejection only if it happens**

  ```javascript
  import { test } from "node:test";
  import assert from "node:assert/strict";
  import { readInvoice, InvoiceNotFoundError } from "./invoices.js";

  test("rejects a missing invoice", async () => {
    await readInvoice("missing").catch(error => {
      assert.ok(error instanceof InvoiceNotFoundError);
    });
  });
  ```

  **Prefer — requiring the expected rejection**

  ```javascript
  import { test } from "node:test";
  import assert from "node:assert/strict";
  import { readInvoice, InvoiceNotFoundError } from "./invoices.js";

  test("rejects a missing invoice", async () => {
    await assert.rejects(() => readInvoice("missing"), InvoiceNotFoundError);
  });
  ```

### Test boundaries and fixtures

- Test changed schemas and type guards directly where they accept or reject values. For serializers, assert the output consumers observe.
- Keep the unit and the domain collaborators whose behaviour is part of the claim real. Supply dependencies through supported constructors or providers rather than replacing modules. Fake a genuinely external effect at its boundary, matching the contract being tested. A controlled callback or clock can be supplied when it is part of the public API; assert internal call counts only when they are themselves an external observable contract.
- For backend behaviour, use the real client/context with a network-boundary handler, such as the project’s MSW harness. Assert returned state/errors or the relevant wire field, not calls to a mocked internal API client. Reuse a project-owned server and its lifecycle when available. If the package has no shared MSW setup, establish one through the supported runner configuration rather than assume a helper exists or start a second interceptor beside an existing server. Reset per-case handlers and fail unexpected requests. A small in-memory collaborator is suitable for a pure unit test only if it preserves the relevant contract and the test does not claim to verify transport, persistence or cross-store wiring.
- Verify fixtures represent the claimed inputs and preserve relevant boundary behaviour; do not have a mock supply the answer or bypass the logic the test claims to verify. Avoid simulating a database by parsing production query strings with fragile matching. Keep unavoidable browser/runtime stand-ins in the project’s shared setup rather than repeat module mocks per file.
- Inspect fixture setup and cleanup for mutable state shared between tests. Use supported helpers so tests do not depend on private implementation details.

### Readability and test cost

- Use names that state the scenario and result, such as “keeps the zoom when equivalent bounds arrive”, rather than “works”. Keep arrange, act and assert easy to follow without compulsory comments for each phase. One test should express one coherent behaviour; several assertions can describe that result.
- Keep the values driving the branch and the important assertions in the case. Extract repeated mechanical setup into small named fixtures or helpers, and use explicit overrides for the scenario. Avoid giant shared mutable fixtures, boolean helper switches and abstractions that hide which action ran or what is expected.
- Use explicit expected fields or values for the contract. Use snapshots only for stable output whose complete structure matters and can be reviewed; avoid broad UI or whole-request snapshots that pin incidental details. Use table cases for the same rule with different inputs, not unrelated scenarios forced through one helper.
- Control asynchronous completion with promises and scheduling APIs; control timers with the runner’s fake clock. Await assertions on promises. Do not make a flaky test pass with real sleeps or larger timeouts. Reset handlers and mutable fixtures between cases, and dispose stores or subscriptions owned by the test.
- Keep pure modules and their tests light. Import the implementation directly rather than loading an unrelated UI package barrel. Run the focused test file when practical and record execution versus import/setup cost; do not rerun the whole repository to validate a small unit.

### Integration and asynchronous paths

- Trace changed wiring, persistence, and transport boundaries. Add integration coverage where isolated tests cannot demonstrate the required behaviour across them.
- Exercise races, retries, timeouts, and disconnections when the patch introduces those paths; tie the expected outcome to the changed contract.
- Read neighbouring tests and project instructions before selecting framework APIs, helpers, or test locations. The examples use Node's test runner; use equivalent assertions in the project's framework.
