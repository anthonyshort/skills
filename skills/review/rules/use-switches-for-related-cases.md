# Use switches for related cases

## When to check

The change branches several times on the same enum, union or state value.

## What to check

- Prefer a switch when several branches compare the same value. Keep the known cases together so the reader can see how each one is handled.
- Use a `never` check for unhandled cases so adding a case fails type checking. A switch alone does not catch missing cases, and a broad default can hide them.
- Separate known, validated cases from unknown external data. Keep the chosen unsupported-data path for future saved values rather than casting them into a known union.

## Why it matters

A switch makes related cases easier to scan than a chain of if statements. A `never` check prevents a new known case from silently taking a default meant for another case.

## Exceptions

Keep if statements for unrelated conditions, ranges and short guard clauses. Use a complete mapping when each case only needs a value, with a type that requires every known case. Unknown external values may need a deliberate fallback or rejection before the code handles known cases.

## Good and bad examples

These functions receive a validated `State`. Both display the same labels for current states. The if chain silently treats any added state as done, while the checked switch fails type checking until its new case is handled.

```typescript
type State = "queued" | "running" | "done";

// Bad: any added state silently becomes "Done".
function labelBefore(state: State): string {
  if (state === "queued") {
    return "Queued";
  }
  if (state === "running") {
    return "Running";
  }
  return "Done";
}

// Good: adding a state requires choosing how to display it.
function label(state: State): string {
  switch (state) {
    case "queued": return "Queued";
    case "running": return "Running";
    case "done": return "Done";
    default: {
      const unhandled: never = state;
      void unhandled;
      return "Unknown";
    }
  }
}
```

The runtime fallback does not replace validation of external data, and it cannot hide a new known state from the compiler.
