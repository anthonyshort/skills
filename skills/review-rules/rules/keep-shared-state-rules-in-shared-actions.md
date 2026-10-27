# Keep shared state rules in shared actions

## When to check

Several interactions update related state, or a change adds another caller that must preserve the same invariant.

## What to check

- Identify which fields must change together and why.
- Trace all callers that perform the operation. Check whether each repeats the same coordination or can leave invalid state.
- Put the shared rule in an action owned by the domain or store. Let callers describe the operation instead of coordinating its fields.
- Preserve legitimate differences between operations. Check intermediate observations, async boundaries and failure handling. A shared function alone does not guarantee atomic updates.

## Why it matters

Duplicated coordination makes each caller responsible for remembering the rule. One missed update can create a new instance of the same bug.

## Exceptions

Keep simple independent mutations near their interaction. Do not build an action framework for every field assignment. Similar updates may have different requirements and should not be merged solely because they look alike.

## Good and bad examples

Requirement: clearing the cart removes its items and closes it.

```typescript
// Bad for this case: each caller must remember both updates.
function clearFromMenu(): void {
  cartStore.itemIds = [];
  cartStore.isOpen = false;
}

function clearFromShortcut(): void {
  cartStore.itemIds = [];
  // Missing the close update leaves the cart open.
}
```

```typescript
// Good for this case: one owner enforces the shared rule.
function clearCart(): void {
  cartStore.itemIds = [];
  cartStore.isOpen = false;
}

function clearFromMenu(): void {
  clearCart();
}

function clearFromShortcut(): void {
  clearCart();
}
```

These handlers only illustrate two entry points. Pass `clearCart` directly when wrappers add no behaviour. With Valtio, check whether synchronous subscribers can observe intermediate state and do not assume batching continues across `await`.
