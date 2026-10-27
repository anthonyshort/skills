# Bind query values and restrict dynamic identifiers

## When to check

The change builds a database query using external values or dynamic table, column or ordering choices.

## What to check

- Trace external values into query construction. Use the driver's parameter-binding syntax instead of string interpolation.
- Check that placeholders and bound values match the actual driver's rules.
- Where identifiers cannot be bound as values, map allowed choices to known identifiers. Do not insert arbitrary caller input into SQL.

## Why it matters

Untrusted input can change the meaning of a query rather than remain data.

## Exceptions

Static query text is not untrusted input. A query builder can supply these guarantees, but verify how raw fragments and identifiers are handled before treating it as safe.

## Good and bad examples

This example uses a PostgreSQL-style driver with `$1` value placeholders. The caller controls the account ID and sort choice.

**Bad: interpolate both values and identifiers**

```typescript
await db.query(
  `SELECT id FROM invoices WHERE account_id = '${accountId}' ORDER BY ${sort}`,
);
```

**Good: bind the value and map the identifier to fixed SQL**

```typescript
const sortColumn = sort === "created" ? "created_at"
  : sort === "total" ? "total_cents"
  : undefined;

if (!sortColumn) throw new Error("Unsupported sort order");

await db.query(
  `SELECT id FROM invoices WHERE account_id = $1 ORDER BY ${sortColumn}`,
  [accountId],
);
```

Only a fixed identifier enters the SQL text. Binding a column name as `$1` does not turn it into an SQL identifier. Use the actual driver's supported syntax.
