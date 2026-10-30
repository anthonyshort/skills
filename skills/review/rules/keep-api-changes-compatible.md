# Keep API changes compatible with callers

## When to check

The change affects a function, event, HTTP API or log output that other code, monitors or alerts rely on.

## What to check

- Trace changed inputs, outputs and errors through actual callers.
- For HTTP changes, compare methods, statuses, response shapes and machine-readable error codes.
- Check that callers still handle success and can distinguish failures they react to, such as validation errors, conflicts and rate limits.
- Check ordering, cancellation and cleanup when callers depend on them.
- Find the monitors, dashboards, filters and alerts that read the changed logs. Check which log levels, error names, tags and fields they use before changing them or wrapping an error. Keep those values working for the readers, or update the readers in the same change.
- Identify callers that need migration. Follow the supported migration or versioning approach where clients cannot all move together.
- Support the result with actual calls, response handling and focused checks. Show before-and-after caller code for proposed changes.

## Why it matters

A change can work in isolation while breaking caller behaviour or sending a failure down the wrong recovery path.

## Exceptions

An intentional breaking change can be valid when affected callers move together or have a supported migration. Reducing noisy logs is valid when the effect on existing alerts is understood. Do not add versioning or monitors for possible future callers or every debug log. Say which callers or monitors you could not check.

## Good and bad examples

A supported caller offers recovery when an invoice is missing. Changing the error code without updating that caller breaks recovery.

```typescript
// Existing caller contract.
if (error.code === "INVOICE_NOT_FOUND") {
  offerInvoiceRecovery();
}
```

**Bad: change the server code while the caller still expects the old one**

```typescript
return Response.json({ code: "MISSING" }, { status: 404 });
```

**Good: preserve the supported contract**

```typescript
return Response.json({ code: "INVOICE_NOT_FOUND" }, { status: 404 });
```

If the new code is intentional, migrate the caller and test its recovery branch. Preserving the old code is not the only valid solution.

A monitor filtering `level:error` may stop detecting a failure if its log moves to warning, even when the message stays the same. Update the monitor’s query when that level change is intended. When wrapping an error, keep the error name and fields that existing filters read.
