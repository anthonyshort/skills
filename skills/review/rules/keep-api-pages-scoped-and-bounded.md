# Keep API pages within the requested data

## When to check

The change adds or changes paginated reads, page sizes or page tokens.

## What to check

- Check that every page uses the same user permissions, workspace and filters as the requested list. A page token must not switch those values or bypass a fresh access check.
- Validate page sizes and bound the work of reading a page. Check stable ordering and what happens when results change between pages.
- If tokens contain encoded data, verify them according to the API before using their fields. Check that a token cannot be reused for a different workspace or filter unless the API explicitly supports that.
- Define how the caller knows the list is finished. Check repeated tokens and empty pages so the caller cannot loop forever. Keep retries separate from automatically walking every page.

## Why it matters

An unchecked token can read a different list or expose data the caller cannot access. Unbounded pages and repeated tokens can also turn one request into too much work.

## Exceptions

Opaque server-held cursors can enforce these checks without exposing token fields. Public lists may not have a workspace. Follow the real API rather than requiring one token format or pagination scheme everywhere.

## Good and bad examples

Assume a token has already been decoded and its signature verified. The request’s workspace and filter have been validated, but the caller still needs an access check. A token from a different list must be rejected.

```typescript
type PageToken = { workspace: string; filter: string; cursor: string };
type PageRequest = { workspace: string; filter: string; limit: number };

// Bad: takes a cursor without checking which list it belongs to.
function cursorBefore(token: PageToken): string {
  return token.cursor;
}

// Good: compare the token with the current request before using its cursor.
function checkedCursor(token: PageToken, request: PageRequest): string {
  if (!Number.isInteger(request.limit) || request.limit < 1 || request.limit > 1000) {
    throw new Error("Invalid page size");
  }
  if (token.workspace !== request.workspace || token.filter !== request.filter) {
    throw new Error("Page token belongs to a different list");
  }
  return token.cursor;
}
```

The check does not validate a token signature or authorise the user. It only checks the fields described above. Do not present it as complete endpoint protection.
