# Remove interaction steps the task does not need

## When to check

A UI introduces selection, confirmation or other intermediate states.

## What to check

Compare a simpler interaction with the actual user requirements. Preserve loading feedback, error feedback and protection against duplicate actions.

## Why it matters

Extra steps and state can complicate both the task and implementation.

## Exceptions

Keep confirmation, batching, preview and accessibility behaviour when required. Support an interaction change with product evidence.

## Good and bad examples

This comparison illustrates the trade-off. Check the actual requirements and callers before recommending a change.

If the task is immediate single-item activation, a selection-and-confirm interaction may be unnecessary.

```typescript
declare function activate(id: string): Promise<void>;

// Bad for this case: selection can exist independently of the action.
let selectedId: string | undefined;
function select(id: string): void { selectedId = id; }
async function confirm(): Promise<void> {
  if (selectedId === undefined) return;
  await activate(selectedId);
  selectedId = undefined;
}

// Good for this case: a button's awaited action needs no pending selection.
async function activateItem(id: string): Promise<void> {
  await activate(id);
}
```

This intentionally changes the interaction, not just implementation. Recommend it only with product evidence. Retain confirmation for destructive work, batching, preview, or accessibility requirements. Preserve error feedback, loading state, and duplicate-action protection at the UI boundary.
