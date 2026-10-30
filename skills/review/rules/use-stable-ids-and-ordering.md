# Use stable IDs and predictable ordering

## When to check

The change identifies selected items, stores references to them, or sorts and pages results.

## What to check

- Check whether an item’s key stays the same after renaming, sorting, filtering or reloading it. A label can repeat, and an array position can move. Use an existing stable ID when the app must remember the same item.
- Find what happens when sort values tie. Add a stable tie-breaker when paging or repeated reads need predictable order. Keep the same comparison in page queries and cursors.
- Check selection and page edges with repeated labels and equal sort values. Explain an actual wrong selection, missing row or repeated row before reporting a defect.

## Why it matters

A changing key can make the app act on the wrong item. An unstable sort can move rows between pages, causing duplicates or omissions.

## Exceptions

An array index can be enough for a fixed list whose positions are its identity. Random or changing order can be intentional. Do not add IDs or tie-breakers to an operation that does not need stable identity or order. Stable sorting does not by itself make paging safe while data is changing.

## Good and bad examples

Assume rows have unique, stable string IDs. Paging must show the same order when values tie.

```typescript
type Row = { id: string; startedAt: number };

// Bad for this paging contract: equal times have no defined tie-breaker.
function compareBefore(a: Row, b: Row): number {
  return a.startedAt - b.startedAt;
}

// Good: equal times use the same stable ordering on every page.
function compareRows(a: Row, b: Row): number {
  const timeOrder = a.startedAt - b.startedAt;
  if (timeOrder !== 0) {
    return timeOrder;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
```

Use the row ID, rather than its title or current array position, to store a selection that must survive these sorts.
