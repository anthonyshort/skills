---
name: error-handling-best-practices
description: Use when writing, refactoring, or reviewing failure propagation, recovery, error mapping, diagnostic logging, or multi-step updates that can partially fail.
---

# Error handling best practices

## Goal

Keep failures detectable and report recovery accurately. Preserve caller contracts and multi-step invariants.

## Checklist

Track checks in task notes, not here. Mark done only after verifying; explain N/A and report blocked or unverified checks. Run independent checks in parallel where useful.

**Handling and propagation**

- [ ] **Version skew** - Return reasonable defaults for unknown variants; do not throw.
- [ ] **Failed operations** - Keep failures visible; report success only after recovery completes.
- [ ] **Useful catches** - Catch only to add context, recover, map errors, or release resources.
- [ ] **Unhandled failures** - Trace them, including async rejections, to the responsible handler.
- [ ] **Failure paths** - Trace changed failures through partial work, caller results, retries, and recovery.
- [ ] **Partial updates** - Identify the invariant each changed multi-step update could break.
- [ ] **Invariant recovery** - Preserve it through atomic commits or explicit recovery.

**Error contracts and responses**

- [ ] **Caller contracts** - Preserve handling of changed error codes, causes, and shapes.
- [ ] **Known failures** - Map them to the appropriate response.
- [ ] **Unknown failures** - Keep them distinct from invalid client input.

**Logging and diagnostics**

- [ ] **Useful logs** - Verify diagnostics identify the failed operation and preserve its cause.
- [ ] **Duplicate logs** - Avoid logging the same failure again at every layer.
- [ ] **Lost diagnostics** - Check propagation or logging changes preserve them.
- [ ] **Sensitive errors** - Exclude credentials, tokens and sensitive data from responses and diagnostic logs.

## Guidance

### Handling and propagation

- Handle unknown variants with reasonable defaults rather than throwing, so version skew does not crash consumers. Use a `never` assignment to expose missing known variants at build time; see [TypeScript](../typescript-best-practices/SKILL.md).
- Keep genuine operation failures distinct from unknown variants. Preserve input validation and access checks, and report success only after the operation or its recovery completes.
- Catch errors to add context, recover, map errors at a boundary, or release resources. Let other failures, including asynchronous ones, reach the responsible handler; avoid catch-and-rethrow blocks that add nothing.

  ```typescript
  async function readChunk(stream: ReadableStream<Uint8Array>) {
    const reader = stream.getReader();
    try {
      return await reader.read();
    } finally {
      reader.releaseLock();
    }
  }
  ```

- Trace what users and callers observe on changed failure paths: partial work, lost failures, retries, and recovery.
- For multi-step updates, identify the invariant a partial failure could break. Check that atomic commits or explicit recovery preserve it.

### Error contracts and responses

- Check error contracts where callers depend on their codes, causes, or shapes. Flag changes that break caller handling; a different error representation alone is not a defect.
- Map known failures to the correct response. Keep unknown failures distinct from invalid client input.

  ```typescript
  class InvalidInputError extends Error {}

  function errorResponse(error: unknown): Response {
    if (error instanceof InvalidInputError) {
      return Response.json({ code: "INVALID_INPUT" }, { status: 400 });
    }
    return Response.json({ code: "INTERNAL_ERROR" }, { status: 500 });
  }
  ```

### Logging and diagnostics

- Trace a representative failure to its diagnostic at the responsible boundary. Verify the operation can be identified and correlated with its original cause; include safe request or resource identifiers where needed to diagnose it. Avoid duplicate logs through every layer and preserve diagnostics when changing propagation. Apply privacy checks before adding context.
- Keep useful diagnostic causes on the server while excluding credentials, tokens and sensitive data from responses and logs. Inspect nested error objects and attached context before logging them.
