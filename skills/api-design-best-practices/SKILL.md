---
name: api-design-best-practices
description: Use when writing, refactoring, or reviewing function, hook, store, plugin/event, module, or HTTP APIs, consumer ergonomics, failure contracts, compatibility, retries, and idempotency.
---

# API design best practices

## Goal

Make APIs clear and convenient for supported consumers while preserving caller behaviour through contract changes, failures, retries, and migrations.

## Checklist

Track checks in task notes, not here. Mark done only after verifying; explain N/A and report blocked or unverified checks. Run independent checks in parallel where useful.

**Consumer ergonomics**

- [ ] **Actual calls** - Inspect real consumers for unclear names, fake inputs, bookkeeping, and leaked internals.
- [ ] **Usage comparison** - Show before/after calls with concrete inputs, useful outputs, and error/lifecycle obligations for proposed API changes.
- [ ] **Necessary surface** - Keep configuration and extensibility proportional to demonstrated consumer needs.

**Requests and failure contracts**

- [ ] **HTTP changes** - Compare methods, statuses, and successful response shapes against supported callers.
- [ ] **Failure distinctions** - Identify caller branches for changed failures; verify their distinctions remain observable.
- [ ] **Error handling** - Verify client handlers accept changed error shapes and machine-readable codes.

**Contract shape and compatibility**

- [ ] **Transport mapping** - Keep it separate from reusable domain logic.
- [ ] **Affected callers** - Identify changed request fields, response shapes, and error codes they use.
- [ ] **Breaking changes** - Follow project versioning or migration strategy; preserve supported clients.
- [ ] **Trust boundaries** - Apply security guidance when contract changes affect them.

**Retries and review evidence**

- [ ] **Lost responses** - Trace retries after a response is lost.
- [ ] **Duplicate requests** - Trace concurrent duplicates for repeated side effects.
- [ ] **Idempotency keys** - Where supported, check reuse with different inputs.
- [ ] **Contract evidence** - Verify changes using actual caller requests, responses, and retries.

## Guidance

### Consumer ergonomics

- Review functions, hooks, stores, plugins/events, and module APIs as consumer interfaces, not only transport contracts. Ask whether the API would be pleasant to use as a library: honest inputs, domain names, useful returns, explicit errors, and clear resource ownership.
- Inspect actual calls before recommending signature changes. Show before/after usage with concrete inputs and output use; name any removed placeholders, caller bookkeeping, or internal dependencies. Preserve ordering, cancellation, failure distinctions, and cleanup where callers depend on them.
- Keep a simple API simple. Do not introduce speculative configuration, registration, versioning, or compatibility machinery merely because a module could become a public library. Follow existing compatibility requirements where they actually apply.
- For awkward function/HTTP calls, selectively read the consumer pairs in [design examples](../design-review/references/design-examples.md). For plugin/event or adapter contracts, select [TypeScript patterns](../design-review/references/typescript-patterns.md) instead. These illustrate comparisons, not mandated recipes.

### Requests and failure contracts

- Compare supported client handlers against old and new requests and responses. Test each changed method, status, shape, and machine-readable error code.
- Trace changed failures to the actual caller branches they select. Verify validation failures, conflicts, rate limits and server failures remain distinguishable where callers rely on them.

### Contract shape and compatibility

- Keep transport code separate from reusable domain logic.

  ```typescript
  import { calculateSubtotal } from "../pricing/calculateSubtotal";

  function subtotalResponse(validatedPrices: readonly number[]): Response {
    return Response.json({ subtotal: calculateSubtotal(validatedPrices) });
  }
  ```

- Trace changed fields and errors to supported callers. Use the project's migration or versioning strategy where callers cannot accept the new contract.
- Apply [security checks](../security-best-practices/SKILL.md) when the change affects a trust boundary.

### Retries and review evidence

- Exercise actual caller requests and responses, including lost responses and concurrent retries. Where idempotency keys exist, retry with the same key and different inputs to check for repeated side effects or conflicting reuse.
