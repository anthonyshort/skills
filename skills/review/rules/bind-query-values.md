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
