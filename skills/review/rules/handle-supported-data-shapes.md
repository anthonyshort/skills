# Handle the supported data shapes

## When to check

The change adds an enum or union case, branches several times on the same enum, union or state value, changes runtime validation, or reads saved data that may come from another supported version.

## What to check

- Prefer a switch when several branches compare the same enum, union or state value. Follow each known case to the code that handles it. Use a `never` check for unhandled cases so adding a case fails type checking. A switch alone does not catch missing cases, and a broad default can hide them.
- Keep a complete mapping for direct value lookups when it is clearer. Check that its type requires every known case.
- Compare what validation accepts with what callers require. Required fields must be required by the schema or filled by an explicit conversion. Derive types from the schema when possible rather than casting away a missing field.
- Separate handling of known, validated cases from handling of unknown external data. Check supported older versions and future values, with a deliberate migration, unsupported state or fallback where the product needs one.
- Show the case that is missed or the accepted input that breaks a caller. Do not add a catch-all crash for future saved data merely to make a known union exhaustive.

## Why it matters

A switch keeps related cases together and makes them easier to scan than a chain of if statements. Type checking cannot protect a caller when a cast promises fields validation never checked. A default branch can hide a newly supported case or make older clients fail on saved data from a newer version.

## Exceptions

Keep if statements for unrelated conditions, ranges and short guard clauses. An intentionally partial mapping can use a documented fallback. Some protocols must reject unknown values. Saved documents may instead need to retain unknown sections or show an unsupported state. Keep that decision where external data is read and handle the known cases fully after validation.

## Good and bad examples

Assume the input requires a list of at most 100 tags. These alternatives show why the schema must require the list.

```typescript
import { z } from "zod";

// Bad: validation accepts {}, but the cast promises tags are present.
const draftBefore = z.object({ tags: z.array(z.string()).max(100).optional() });
const before = draftBefore.parse({}) as { tags: string[] };

// Good: callers and validation agree that tags must be present.
const draftSchema = z.object({ tags: z.array(z.string()).max(100) });
type Draft = z.infer<typeof draftSchema>;
const draft: Draft = draftSchema.parse({ tags: [] });
```

For several branches on the same known state, a switch makes the cases easier to follow. The `never` check makes adding a state fail type checking until its branch is added:

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

These functions receive a validated `State`. The fallback does not replace validation of external data, and it cannot hide a new known state from the compiler.

A complete mapping also makes additions to a known union visible to the compiler when each case only needs a value:

```typescript
type Kind = "note" | "image";
// Bad: silently calls every future kind a note.
const labelBefore = (kind: Kind): string => kind === "image" ? "Image" : "Note";
// Good: adding a kind requires adding its label.
const labels = { note: "Note", image: "Image" } satisfies Record<Kind, string>;
```

Validate external values before using them as `Kind`. An unknown future saved kind needs the chosen unsupported-data path, not a cast into this mapping.
