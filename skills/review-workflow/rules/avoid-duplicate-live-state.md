# Avoid storing values that can be calculated

## When to check

The change stores a value calculated from other changing state.

## What to check

Check whether the value can be calculated from one source of truth instead of maintained through multiple update paths. Check edits, removals and how callers observe changes.

## Why it matters

Duplicate mutable state can drift out of sync.

## Exceptions

Keep historical snapshots. Keep measured caches when recalculation would be too expensive, with clear invalidation.

## Good and bad examples

This comparison illustrates the trade-off. Check the actual requirements and callers before recommending a change.

When a total must always reflect current lines, remove the second mutable value and its update paths.

```typescript
type Line = { amount: number };
const lines: Line[] = [];

// Bad for this case: every mutation must also maintain total.
let total = 0;
function addLineBefore(line: Line): void {
  lines.push(line);
  total += line.amount;
}

// Good for this case: one source of truth, including edits and removals.
function currentTotal(): number {
  return lines.reduce((sum, line) => sum + line.amount, 0);
}
```

Keep a persisted invoice total when it is a historical snapshot, not a live derivation. For expensive live calculations, inspect workload and invalidation before replacing a measured cache with repeated computation. Update subscriptions if callers previously observed a stored field.
