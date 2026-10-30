# Handle only the error you mean to handle

## When to check

The change adds a retry, fallback, broad catch or optional request whose failure can affect other content.

## What to check

- Identify the exact error that permits retry or fallback. Check its actual type or code. Do not treat a permission failure, timeout or invalid response as a missing record unless the API says they mean the same thing.
- Keep unrelated failures visible to the code that can handle them. Do not catch a whole operation and report success because one part was optional.
- Put optional work’s failure handling around that work. Keep useful main content visible, and show or record the failed part instead of pretending it was empty or successful.
- Check whether retries or fallback calls can repeat writes. A catch block does not make repeated effects safe.

## Why it matters

A broad catch can hide a real failure, make the wrong fallback request or blank useful content because an optional part failed.

## Exceptions

A genuinely optional widget can report even an unexpected failure locally while leaving the page usable. It must still show or record that failure. An agreed fallback can cover several error types, but name those types and preserve failures outside that agreement.

## Good and bad examples

Assume the fallback is valid only when the primary read reports that the item does not exist. The functions are existing read operations, not writes.

```typescript
class MissingItemError extends Error {}
type ReadText = () => Promise<string>;

// Bad: also falls back on denied access and broken responses.
async function readBefore(primary: ReadText, fallback: ReadText): Promise<string> {
  try {
    return await primary();
  } catch {
    return fallback();
  }
}

// Good: fall back only for the agreed error and pass other failures through.
async function readWithFallback(primary: ReadText, fallback: ReadText): Promise<string> {
  try {
    return await primary();
  } catch (error) {
    if (error instanceof MissingItemError) {
      return fallback();
    }
    throw error;
  }
}
```

For optional content, use a visible failed state for the failed request. Keep its catch separate from required reads so their errors cannot be mistaken for this optional failure.
