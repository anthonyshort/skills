# Keep series data out of stores

## When to check

Workbook store methods or state start carrying computed series data.

## What to check

Keep series data in its compute/cache owner. Store domain inputs and durable configuration instead. Do not pass series payloads through store methods.

## Why it matters

Stores otherwise retain large transient data and couple domain state to compute lifetimes.

## Exceptions

A local variable outside the store is not persisted store state. Verify the actual data owner and supported API.

## Good and bad examples

**Bad for this case**

```typescript
store.setThresholdFromSeries(seriesData);
```

**Good for this case**

```typescript
const threshold = calculateThreshold(seriesData);
store.setThreshold(threshold);
```

The calculation owns the transient input. The store receives the domain value and enforces its own invariants.
