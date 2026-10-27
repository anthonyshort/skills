# Extract decisions only when it helps

## When to check

Code mixes decisions with effects, combines distinct phases or abstraction levels in one body, or splits small operations into helpers.

## What to check

Check whether extracting a meaningful operation removes hidden state, exposes the main flow or supports another caller or useful test. Identify the phases and local state a reader must track together. Look for orchestration buried in protocol details, validation, mapping or independent state machines.

Readability can justify a helper with one caller. It earns its place when it hides incidental detail, gives a phase a clear contract or reduces the state a reader must track. Reuse and independent testing are additional benefits, not prerequisites. Name the proposed operations and show how they simplify the caller rather than recommending smaller functions in general.

Compare the total concepts and caller code. Preserve batching, cursor ownership, validation and state invariants. Keep transaction checks at the effect boundary.

## Why it matters

Useful separation lets a reader understand the main operation without mentally executing every detail. Tiny helpers can instead fragment a clear operation.

## Exceptions

Keep a cohesive operation when extraction adds indirection without reducing the reasoning burden. A long declarative mapping or one unified state transition may belong together. Explain that cohesion rather than relying on length or a shared feature name.

A pure precheck does not guarantee concurrent safety or idempotency.

## Good and bad examples

This comparison illustrates the trade-off. Check the actual requirements and callers before recommending a change.

Separate a meaningful decision from I/O when it clarifies the flow or makes the decision reusable. Do not split every expression into a policy framework.

```typescript
type Invoice = { totalCents: number; sent: boolean };
type Sender = { send(invoice: Invoice): Promise<void> };

// Bad for this case: the decision is only accessible through an effectful operation.
async function sendBefore(invoice: Invoice, sender: Sender): Promise<void> {
  if (invoice.totalCents > 0 && !invoice.sent) {
    await sender.send(invoice);
  }
}

// Good for this case: a second caller can use the same decision without performing I/O.
function canSend(invoice: Invoice): boolean {
  return invoice.totalCents > 0 && !invoice.sent;
}
async function sendAfter(invoice: Invoice, sender: Sender): Promise<void> {
  if (canSend(invoice)) {
    await sender.send(invoice);
  }
}

// Bad for this case: fragmenting the same small decision without separate responsibilities.
const positive = (value: number): boolean => value > 0;
const not = (value: boolean): boolean => !value;
const both = (a: boolean, b: boolean): boolean => a && b;
function fragmented(invoice: Invoice): boolean {
  return both(positive(invoice.totalCents), not(invoice.sent));
}
```

Without another caller or test, extraction may still help if it reveals a meaningful phase or reduces local reasoning. Otherwise, keep the cohesive original. Both forms await the send and propagate rejection. Neither guarantees concurrent-send idempotency. Preserve transaction checks at the effect boundary rather than treating a pure precheck as authority. Judge the total concepts and call sites, not the number of pure functions.
