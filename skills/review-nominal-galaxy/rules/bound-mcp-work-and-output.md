# Bound tool requests and results

## When to check

An MCP tool lists, expands or mutates multiple resources.

## What to check

Calculate downstream requests and output growth at maximum input sizes. Enforce page, batch and result limits using actual project budgets. Verify backend paging rather than slicing an unpaged fetch.

## Why it matters

A small-looking tool input can cause large fan-out or payloads.

## Exceptions

Do not invent quotas. If budgets are missing, report the unsupported bound rather than claiming the tool is safe.

## Good and bad examples

**Bad for this case**

```typescript
const all = await backend.listAll();
return all.slice(offset, offset + pageSize);
```

**Good for this case**

```typescript
return backend.listPage({ cursor, limit: validatedPageSize });
```

The backend must actually support bounded paging. Also account for nested lookups and variable-size fields.
