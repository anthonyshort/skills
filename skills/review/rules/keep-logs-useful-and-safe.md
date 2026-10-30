# Keep logs useful without exposing private data

## When to check

The change adds or changes logs, error summaries, error wrapping or fields sent to monitoring tools.

## What to check

- Keep enough safe context to identify the failed operation and connect related events. Use fields approved for logging, such as a known error code or permitted request ID, rather than dumping whole requests or errors.
- Follow user text, customer names, credentials, tokens and payloads into logs. Leave them out or use the approved redaction policy. A predictable hash of a name can still reveal it through guessing.
- Keep common summaries stable and free of raw user-controlled text. Put detailed causes only in an approved diagnostic location after checking them for sensitive values.
- Check that existing monitors and alerts still read the changed level, error name and fields correctly. Do not silently remove useful failure reporting or log the same failure at every layer.

## Why it matters

Logs need to help diagnose failures without creating another copy of private data. Changes to their fields can also stop existing monitors from finding errors.

## Exceptions

Approved audit records or restricted diagnostics may need additional fields. Follow their access and retention rules rather than banning every identifier. A deliberate reduction in noisy logs is valid when it does not hide the failures the system still needs to report.

## Good and bad examples

Assume `code` is a validated error category and `detail` may include user text. The logger is an existing service. Only the operation and code are approved for this summary.

```typescript
type Failure = { code: "TIMEOUT" | "UNAVAILABLE"; detail: string };
type Logger = { warn(message: string, fields: Record<string, string>): void };

// Bad: the common log copies possibly private text.
function logBefore(logger: Logger, failure: Failure): void {
  logger.warn("Read failed", { code: failure.code, detail: failure.detail });
}

// Good: identify the operation and error without copying the private detail.
function logFailure(logger: Logger, failure: Failure): void {
  logger.warn("Read failed", { operation: "read-record", code: failure.code });
}
```

This only checks the summary shown here. Other logs, nested causes and uploaded diagnostics still need inspection.
