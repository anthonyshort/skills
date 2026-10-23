# Remove wrappers that add no value

## When to check

A layer mostly forwards calls to another capability, or the change adds or modifies an abstraction.

## What to check

Identify the complexity, invariant or useful boundary the abstraction handles. For wrappers, check whether they translate a real boundary or provide useful behaviour or isolation. Consider passing the existing capability directly when they do neither. Check callers and the whole design before recommending removal. Preserve required behaviour and isolation.

## Why it matters

Forwarding layers add concepts and call paths without always adding value.

## Exceptions

Keep boundaries that enforce access, translate data or errors, provide instrumentation, establish ownership or preserve compatibility.

## Good and bad examples

This comparison illustrates the trade-off. Check the actual requirements and callers before recommending a change.

Keep an adapter when it translates a real boundary. Remove forwarding that adds no contract or isolation.

```typescript
type Invoice = { id: string; totalCents: number };
type InvoiceReader = { get(id: string): Promise<Invoice> };

// Bad for this case: another name and call frame, but no adaptation.
function forward(reader: InvoiceReader): InvoiceReader {
  return { get: (id) => reader.get(id) };
}

// Good for this case: pass the existing capability directly at the wiring site.
declare const reader: InvoiceReader;
const featureReader = reader;

// Useful exception: the validated legacy boundary has a different shape.
type LegacyReader = {
  fetchInvoice(id: string): Promise<{ invoice_id: string; cents: number }>;
};
function adaptLegacy(legacy: LegacyReader): InvoiceReader {
  return {
    async get(id) {
      const row = await legacy.fetchInvoice(id);
      return { id: row.invoice_id, totalCents: row.cents };
    },
  };
}
```

The direct wiring adds no new function. The adapter owns a shape mismatch and propagates failures unchanged. If failures differ, map them according to the actual domain contract rather than silently flattening them. Retain an apparently thin boundary when it enforces access, stable ownership, instrumentation, or supported compatibility. Inspect consumers before removing it.
