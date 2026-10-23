# Design mutation tools for batches

## When to check

A new or changed mutation tool in apps/nominal-mcp handles one item at a time.

## What to check

Prefer bounded array inputs for operations users commonly perform in batches. Return meaningful per-item outcomes and preserve required ordering and failure semantics.

## Why it matters

One tool call per item adds avoidable orchestration and round trips.

## Exceptions

A genuinely single-resource operation can remain singular. Do not invent transactional batch guarantees.

## Good and bad examples

**Bad for this case**

```typescript
await renameTool({ id: "a", name: "A" });
await renameTool({ id: "b", name: "B" });
```

**Good for this case**

```typescript
await renameTool({ items: [
  { id: "a", name: "A" },
  { id: "b", name: "B" },
] });
```

The server must validate a meaningful maximum batch size and report each result. Consider Scout Code Mode instead of adding a tool that only forwards a backend endpoint.
