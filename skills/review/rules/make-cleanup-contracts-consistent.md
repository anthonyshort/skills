# Use consistent cleanup contracts for similar resources

## When to check

Callers manage resources with different cleanup shapes.

## What to check

Compare resource lifetimes and cleanup contracts. Consider one shape when it removes caller bookkeeping. Preserve cleanup order, failure handling and cleanup after partial setup.

## Why it matters

Inconsistent contracts make cleanup harder to use correctly.

## Exceptions

Do not combine unrelated owners or impose UI disposal on shared stores. A wrapper that only renames cleanup is not enough to justify migration.

## Example

This comparison illustrates the trade-off. Check the actual requirements and callers before recommending a change.

A common stop handle can remove special-case bookkeeping when subscriptions have the same lifetime.

```typescript
declare function watchA(): { stop(): void };
declare function watchB(): () => void;

// Before: each owner needs to know both cleanup shapes.
function startBefore(): () => void {
  const a = watchA();
  const stopB = watchB();
  return () => { try { stopB(); } finally { a.stop(); } };
}

// After migrating watchA's contract: callers own one cleanup shape.
declare function watchAAfter(): () => void;
function startAfter(): () => void {
  const stopA = watchAAfter();
  const stopB = watchB();
  return () => { try { stopB(); } finally { stopA(); } };
}
```

Both retain reverse cleanup order and attempt `A` cleanup if `B` throws. Neither solves partial setup failure: if starting `B` can throw, release `A` before propagating the error. Verify the existing policy if both cleanup operations throw. Do not impose view disposal on a shared session store or combine owners merely to make signatures uniform. A new wrapper alone does not justify this migration.
