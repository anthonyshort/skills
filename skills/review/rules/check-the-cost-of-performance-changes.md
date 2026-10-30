# Check the cost of performance changes

## When to check

The change adds a cache, memoisation, comparison, preloading or other work intended to improve performance.

## What to check

- Find where the work runs, how often and with how much data. Include rendering, cache-key creation, comparisons, invalidation and retained memory, not only the work being avoided.
- Compare the proposed approach with the simplest working one. Use existing measurements or a clear account of the work done. Do not claim a change is faster merely because it adds a cache or avoids one function call.
- Check whether the key covers changes that affect the result and whether cached entries are released when no longer useful. Preserve correctness when removing an optimisation too.
- Ask for a focused measurement when the trade-off cannot be settled from the code. Name the workload and expected result instead of requesting a benchmark for every small change.

## Why it matters

An optimisation can do as much work as the calculation it replaces, retain too much data or return old results. It can also make simple code harder to maintain without a useful improvement.

## Exceptions

Caches and memoisation can help with expensive work and repeated inputs. A cheap, obvious improvement may need no benchmark. A drag preview or placeholder may deliberately do less work than the full UI. Keep any behaviour the smaller version still needs.

## Good and bad examples

Assume these are small arrays and summing them is cheap. Serialising every array to build a cache key already walks the same data. No useful cache benefit has been shown for this caller.

```typescript
const totals = new Map<string, number>();

// Bad for this case: key creation and retained entries add work.
function sumBefore(values: readonly number[]): number {
  const key = JSON.stringify(values);
  const cached = totals.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const result = values.reduce((total, value) => total + value, 0);
  totals.set(key, result);
  return result;
}

// Good for this caller: do the cheap calculation directly.
function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
```

This does not prove caches are always slower. For an expensive calculation, check the real key cost, reuse rate and memory limit before recommending removal.
