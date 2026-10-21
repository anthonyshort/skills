---
name: trpc-best-practices
description: Use when writing, refactoring, or reviewing tRPC routers, procedures, middleware, validation, auth, typed errors, client queries, mutations, and cache behaviour.
---

# tRPC best practices

## Goal

Keep tRPC access, validation, failure behaviour, and client cache recovery consistent across server and client boundaries.

## Checklist

Track checks in task notes, not here. Mark done only after verifying; explain N/A and report blocked or unverified checks. Run independent checks in parallel where useful.

**Procedure composition and access**

- [ ] **Base procedures** - Reuse established tracing, logging, error-mapping, and authentication middleware.
- [ ] **Middleware order** - Authenticate and narrow context before middleware reads authenticated values.
- [ ] **Resource access** - Check authorisation separately from authentication and make public exceptions explicit.
- [ ] **Procedure semantics** - Use named queries and mutations matching the operation.

**Validation and errors**

- [ ] **Input validation** - Validate every procedure's untrusted input with Zod.
- [ ] **Shared schemas** - Reuse equivalent contracts and derive their types.
- [ ] **Array limits** - Set meaningful maximum input-array sizes.
- [ ] **External responses** - Parse external responses before relying on their declared shape.
- [ ] **Output validation** - Identify outputs needing runtime enforcement; verify validation or another enforcing boundary.
- [ ] **Typed errors** - Use TRPCError or established errors with meaningful codes and preserved causes.
- [ ] **Client diagnostics** - Exclude internal details from client messages.
- [ ] **Resource disclosure** - Keep error differences from revealing resources to unauthorised callers.

**Domain work and partial failure**

- [ ] **Domain boundaries** - Pass context and validated input to shared logic; keep transport mapping in procedures.
- [ ] **Partial success** - Allow partial lookups only when the operation permits them.
- [ ] **Settled results** - Inspect every result and distinguish fatal from acceptable failures.

**Query state**

- [ ] **Query integration** - Use query and conditional APIs supported by the installed integration.
- [ ] **Query states** - Verify pending, error, empty and success produce their intended UI.
- [ ] **Disabled queries** - Avoid endless loading.
- [ ] **Shared cache** - Reuse keys/cache; duplicate server state only for an editing need.

**Mutations and cache recovery**

- [ ] **Mutation success** - Invalidate dependent queries or write authoritative returned data.
- [ ] **Invalidation scope** - Avoid invalidating unrelated queries by default.
- [ ] **Settled cache writes** - Reject failed or absent onSettled data.
- [ ] **Optimistic setup** - Cancel conflicting queries and snapshot data before updating.
- [ ] **Optimistic recovery** - Roll back failures and reconcile after settlement.
- [ ] **Overlapping mutations** - Prevent stale snapshots or responses overwriting newer state.
- [ ] **Mutation failures** - Surface failures through the established notification UI.
- [ ] **Duplicate submissions** - Prevent accidental repeat submissions.

**Verification**

- [ ] **Access tests** - Verify changed authentication, authorisation, and validation paths.
- [ ] **Recovery tests** - Verify changed partial failures and cache recovery, including affected races.

## Guidance

### Procedure composition and access

- Trace each procedure through the established base middleware and resource-permission checks. Authentication must precede middleware that reads the authenticated context; public exceptions must be explicit.
- Compare named query/mutation procedures with their actual reads and side effects.

- For contracts, compatibility, and idempotency, load [API design](../api-design-best-practices/SKILL.md).

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

- For permission checks and resource limits, load [security](../security-best-practices/SKILL.md).

### Domain work and partial failure

- Extract complex shared fetch/domain logic into functions accepting context and validated input; keep transport-specific mapping in procedures.
- Use `Promise.allSettled` for independent lookups only when partial results are acceptable. Inspect every result and define which failures are fatal; use fail-fast behaviour when the operation requires all results.

- For mapped errors and partial failure, load [error handling](../error-handling-best-practices/SKILL.md).
- For batching and bounded concurrency, load [performance](../performance-best-practices/SKILL.md).

### Query state

- Use conditional-query APIs supported by the installed integration, such as `skipToken`. Check enabled and disabled query states in their UI.
- Trace pending, error, empty and success to their intended user-visible states. Empty means a successful query with zero results, not pending. Check errors expose the project's supported failure or retry affordance. Check disabled queries separately; disabled does not always mean pending.
- Trace server values to shared query keys/cache; separate local editing state from duplicate server state.

### Mutations and cache recovery

- Trace each mutation to affected cache keys. Use authoritative success data for writes; guard failed or absent `onSettled` data.
- For optimistic updates: cancel conflicting queries, snapshot, apply, roll back on failure, then reconcile. Test overlapping mutations so older responses or rollbacks cannot overwrite newer state.
- Use the established notification UI and check rapid repeat submissions.

### Verification

- For auth, cache recovery, and races, load [testing](../testing-best-practices/SKILL.md).
