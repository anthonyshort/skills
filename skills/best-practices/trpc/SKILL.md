---
name: trpc
description: Use when writing, refactoring, or reviewing tRPC routers, procedures, middleware, validation, auth, typed errors, client queries, mutations, and cache behaviour.
---

# tRPC best practices

## Goal

Keep tRPC access, validation, failure behaviour, and client cache recovery consistent across server and client boundaries.

## Guidance

### Procedure composition and access

- Trace each procedure through the established base middleware and resource-permission checks. Reuse shared tracing, logging, error mapping and authentication. Authentication must precede middleware that reads the authenticated context; public exceptions must be explicit.
- Compare named query/mutation procedures with their actual reads and side effects.

- For changed contracts, use [caller compatibility](../../review/rules/keep-api-changes-compatible.md). For side effects with retry paths, use [retry checks](../../review/rules/check-retries-for-repeated-effects.md).

### Validation and errors

- Validate each procedure's untrusted input with Zod; omit input schemas only for procedures that take no input. Reuse schemas when they represent the same contract.

  ```typescript
  procedure.input(z.object({ id: z.string().uuid() }));
  ```

- Derive types from canonical schemas and bound input arrays. Parse external responses before code relies on their declared shape.
- Check output enforcement when an external or legacy producer is unchecked, a transformation can violate the declared shape, or the project requires runtime validation. Verify an output schema or another enforcing boundary. Record N/A only when a validated producer and the construction path already enforce the contract.

- Throw `TRPCError` or established typed errors mapped by middleware. Preserve meaningful codes and causes; keep internal diagnostics out of client messages.

  ```typescript
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Could not save invoice",
    cause: error,
  });
  ```

- Avoid revealing resource existence to unauthorised callers through error differences.

  ```typescript
  if (!invoice || !canReadInvoice) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
  }
  ```

- For permission checks and resource limits, load [HTTP API guidance](../http-api/SKILL.md).

### Domain work and partial failure

- Extract complex shared fetch/domain logic into functions accepting context and validated input; keep transport-specific mapping in procedures.
- Use `Promise.allSettled` for independent lookups only when partial results are acceptable. Inspect every result and define which failures are fatal; use fail-fast behaviour when the operation requires all results.

- For mapped errors and partial failure, load [error handling](../error-handling/SKILL.md).
- For batching and bounded concurrency, load [TypeScript performance guidance](../typescript/SKILL.md#performance-and-resources).

### Query state

- Use conditional-query APIs supported by the installed integration, such as `skipToken`. Check enabled and disabled query states in their UI.
- Trace pending, error, empty and success to their intended user-visible states. Empty means a successful query with zero results, not pending. Check errors expose the project's supported failure or retry affordance. Check disabled queries separately; disabled does not always mean pending.
- Trace server values to shared query keys/cache; separate local editing state from duplicate server state.

### Mutations and cache recovery

- Trace each mutation to affected cache keys. Use authoritative success data for writes; guard failed or absent `onSettled` data.
- For optimistic updates: cancel conflicting queries, snapshot, apply, roll back on failure, then reconcile. Test overlapping mutations so older responses or rollbacks cannot overwrite newer state.
- Use the established notification UI and check rapid repeat submissions.

### Verification

- For auth, cache recovery, and races, load [testing](../testing/SKILL.md).
