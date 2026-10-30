# Explain why code works this way

## When to check

The change introduces unclear names, unusual ordering, a workaround, or comments that no longer describe the code.

## What to check

- Read the names and comments beside the changed code. Can a reader tell what the code does without knowing the original discussion or an obscure abbreviation?
- For an unexpected delay, branch, ordering choice or fallback, find the constraint that requires it. Explain that reason near the code when it cannot be made clear through names and structure.
- Compare existing comments with the new behaviour. Correct claims made false by the change. Keep useful comments and avoid adding the history of earlier implementations.
- Show what a reader could misunderstand and how a clearer name or short explanation prevents it. Do not request comments that repeat each statement.

## Why it matters

A future change can remove a necessary step when the code hides its purpose. A stale comment can lead a reader to rely on behaviour that no longer exists.

## Exceptions

Clear code needs no commentary. A recognised domain term can be more precise than a longer substitute. Keep detailed background in documentation when it would obscure the nearby code, with a useful link where needed.

## Good and bad examples

Assume the remote search service rejects queries shorter than three characters. The threshold must stay even if local filtering accepts shorter text.

```typescript
// Bad: the name hides the condition and the comment repeats the return.
function ok(value: string): boolean {
  // Return whether the length is at least three.
  return value.length >= 3;
}

// Good: the name explains the check and the comment explains the limit.
function canSearchRemotely(query: string): boolean {
  // The remote search service rejects queries shorter than three characters.
  return query.length >= 3;
}
```

If the service starts accepting one-character queries, update the check and its explanation together. Do not preserve the old comment as a record of the previous behaviour.
