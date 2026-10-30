# Use consistent cleanup contracts for similar resources

## When to check

Callers manage resources with different cleanup shapes, or subscriptions and cancellable work gain or change an owner.

## What to check

- Trace who starts each subscription or request, who stops it, and the event that ends its lifetime. Keep setup and cleanup with the owner that can observe that event.
- For an abort signal, find who creates its controller and who actually calls `abort()`. Receiving a signal does not prove that work is cancelled when its owner changes or is disposed.
- Compare resource lifetimes and cleanup contracts. Consider one shape when it removes caller bookkeeping. Preserve cleanup order and failure handling, including releasing earlier resources if a later setup step throws.
- Check the disposal path and setup failure path against the real resource implementation. A shared cleanup shape does not prove that subscriptions stop or cancellation reaches the running work.

## Why it matters

Inconsistent contracts make cleanup harder to use correctly.

## Exceptions

Do not combine unrelated owners or impose UI disposal on shared stores. A wrapper that only renames cleanup is not enough to justify migration.

## Good and bad examples

The declarations below show proposed resource API shapes. They assume each stop operation is synchronous. Check the actual requirements and callers before recommending a change.

A common stop handle can remove special-case bookkeeping when subscriptions have the same lifetime.

```typescript
declare function watchA(): { stop(): void };
declare function watchB(): () => void;

// Bad for this case: each owner needs to know both cleanup shapes.
function startBefore(): () => void {
  const a = watchA();
  let stopB: () => void;
  try {
    stopB = watchB();
  } catch (error) {
    a.stop();
    throw error;
  }
  return () => { try { stopB(); } finally { a.stop(); } };
}

// Good after migrating watchA's contract: callers own one cleanup shape.
declare function watchAAfter(): () => void;
function startAfter(): () => void {
  const stopA = watchAAfter();
  let stopB: () => void;
  try {
    stopB = watchB();
  } catch (error) {
    stopA();
    throw error;
  }
  return () => { try { stopB(); } finally { stopA(); } };
}
```

Both retain reverse cleanup order and attempt `A` cleanup if `B` throws. Both release `A` if starting `B` throws. These examples assume cleanup during failed setup does not throw. Verify the existing error policy if cleanup can also fail. Do not impose view disposal on a shared session store or combine owners merely to make signatures uniform. A new wrapper alone does not justify this migration.
