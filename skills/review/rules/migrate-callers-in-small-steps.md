# Migrate callers in small supported steps

## When to check

Changed code uses an API that has an adopted replacement.

## What to check

Verify the replacement supports the affected behaviour. Compare authorisation, errors, cancellation, caching and lifecycle. Identify remaining callers and the compatibility boundary.

## Why it matters

A focused migration can move the system forward without expanding the PR unnecessarily.

## Exceptions

Do not require a planned or incomplete replacement. Keep useful intermediate states instead of requiring a wholesale rewrite.

## Example

This comparison illustrates the trade-off. Check the actual requirements and callers before recommending a change.

If an adopted client supports the changed use case, migrate that caller without forcing unrelated consumers into the PR.

```typescript
type Invoice = { id: string };
declare const legacy: { loadInvoice(id: string): Promise<Invoice> };
declare const current: { invoices: { get(id: string): Promise<Invoice> } };

// Before: the touched consumer uses a superseded entrypoint.
function loadBefore(id: string): Promise<Invoice> {
  return legacy.loadInvoice(id);
}

// After: migrate this consumer, not every legacy feature.
function loadAfter(id: string): Promise<Invoice> {
  return current.invoices.get(id);
}
```

Confirm matching auth, errors, cancellation, caching, and lifecycle before treating the clients as interchangeable. Name remaining consumers and the compatibility boundary. If the replacement is only planned or lacks required behaviour, keep the intermediate state and report the dependency instead of blocking on a wholesale rewrite.
