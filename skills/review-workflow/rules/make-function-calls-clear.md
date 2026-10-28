# Make function calls clear and direct

## When to check

A function API changes or callers supply misleading flags or placeholder values.

## What to check

Inspect real calls. Look for unnecessary inputs, fake values and caller bookkeeping. Show before-and-after usage, including output handling. Preserve errors and supported capabilities. Check that callers can understand returned values, errors, cancellation and resource cleanup without knowing internal implementation details.

## Why it matters

Clear calls reduce the internal knowledge callers need.

## Exceptions

Keep pagination and other real capabilities. Do not add options objects or builders to an already clear API. Migrate callers or preserve compatibility.

## Good and bad examples

This comparison illustrates the trade-off. Check the actual requirements and callers before recommending a change.

When names and fake positional values obscure the task, compare the actual call.

```typescript
declare function loadBefore(
  id: string, refresh: boolean, unusedCursor: string,
): Promise<readonly string[]>;
declare function loadAfter(
  id: string, options?: { refresh?: boolean },
): Promise<readonly string[]>;

async function labels(): Promise<void> {
  // Bad for this case: callers must know why the empty string is required.
  const oldLabels = await loadBefore("invoice-42", true, "");
  // Good for this case: the supported operation needs no pagination placeholder.
  const newLabels = await loadAfter("invoice-42", { refresh: true });
  console.log(oldLabels, newLabels);
}
```

Removing the cursor is valid only if this operation does not support pagination. Preserve pagination as a real capability where needed. Keep rejection and refresh semantics unchanged. Migrate all callers or retain the established compatibility boundary. A clear `loadLabels(id)` needs neither an options object nor a builder.
