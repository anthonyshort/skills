# Extract decisions only when it helps

## When to check

Code mixes a decision with effects, or splits small decisions into helpers.

## What to check

Check whether extracting a meaningful decision removes hidden state or supports another caller or useful test. Compare the total concepts and caller code. Keep transaction checks at the effect boundary.

## Why it matters

Useful separation can improve reuse, but tiny helpers can fragment a clear operation.

## Exceptions

Keep a small cohesive function when the decision is not needed independently. A pure precheck does not guarantee concurrent safety or idempotency.

## Example

This comparison illustrates the trade-off. Check the actual requirements and callers before recommending a change.

Separate a meaningful decision from I/O when it removes hidden state and makes the decision reusable. Do not split every expression into a policy framework.

```typescript
type Invoice = { totalCents: number; sent: boolean };
type Sender = { send(invoice: Invoice): Promise<void> };

// Before: the decision is only accessible through an effectful operation.
async function sendBefore(invoice: Invoice, sender: Sender): Promise<void> {
  if (invoice.totalCents > 0 && !invoice.sent) await sender.send(invoice);
}

// After: a second caller can use the same decision without performing I/O.
function canSend(invoice: Invoice): boolean {
  return invoice.totalCents > 0 && !invoice.sent;
}
async function sendAfter(invoice: Invoice, sender: Sender): Promise<void> {
  if (canSend(invoice)) await sender.send(invoice);
}

// Avoid: fragmenting the same small decision without separate responsibilities.
const positive = (value: number): boolean => value > 0;
const not = (value: boolean): boolean => !value;
const both = (a: boolean, b: boolean): boolean => a && b;
function fragmented(invoice: Invoice): boolean {
  return both(positive(invoice.totalCents), not(invoice.sent));
}
```

If no other caller or test needs the decision independently, the original cohesive function may be best. Both forms await the send and propagate rejection; neither guarantees concurrent-send idempotency. Preserve transaction checks at the effect boundary rather than treating a pure precheck as authority. Judge the total concepts and call sites, not the number of pure functions.
