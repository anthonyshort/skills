# Keep shared code independent of its consumers

## When to check

The change adds dependencies to shared code or moves behaviour between shared and feature modules.

## What to check

Trace imports and callers. Check that generic modules do not depend on specialised features that use them. Look for UI, transport or feature details leaking into shared domain logic. Recommend a move only when you can identify the responsible owner and explain the boundary it restores.

For shared UI, follow the context providers, hooks and store types it imports. Pass the values and callbacks the component needs instead of making it import one screen’s concrete store. Keep a screen-specific adapter where it connects the shared component to that screen.

Do not combine callbacks merely because they have similar names. Two screens may need different permission checks, undo behaviour or cleanup. Share only the part that has the same meaning for both.

## Why it matters

Shared code becomes harder to reuse and change when it needs knowledge of its consumers. Reversed dependencies can also create cycles.

## Exceptions

An integration module may intentionally connect domain code to UI or transport code. Check its responsibility before treating the dependency as a leak. Do not introduce interfaces or adapters when direct code already has a clear owner.

A component used by one screen can use that screen’s context. Ask for a more general API when there is a real shared caller or a dependency that blocks the intended use, not just because reuse is imaginable.

## Good and bad examples

A subtotal calculation is needed by HTTP and non-HTTP callers.

**Bad: shared pricing logic returns a transport object**

```typescript
export function calculateSubtotal(prices: readonly number[]): Response {
  const subtotal = prices.reduce((sum, price) => sum + price, 0);
  return Response.json({ subtotal });
}
```

**Good: return a domain value and build the response at the HTTP boundary**

```typescript
// Shared pricing logic
export function calculateSubtotal(prices: readonly number[]): number {
  return prices.reduce((sum, price) => sum + price, 0);
}

// HTTP boundary
const subtotal = calculateSubtotal(prices);
return Response.json({ subtotal });
```

Returning an HTTP Response directly from shared pricing logic would make non-HTTP consumers depend on transport details.
