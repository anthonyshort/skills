# Keep shared operations independent of mounted UI

## When to check

A shared operation requires a component, editor or UI object.

## What to check

Check whether callers can pass domain inputs and an existing capability directly. Keep validation, permissions, persistence and history rules with the operation.

## Why it matters

Shared operations should not require fake UI objects or mounted components.

## Exceptions

Keep UI ownership for operations that concern local selection or editor undo. Do not add a forwarding helper when callers can use the existing operation.

## Example

This comparison illustrates the trade-off. Check the actual requirements and callers before recommending a change.

If a domain operation is required without an editor, pass the actual command rather than requiring a mounted component or a fake editor object.

```typescript
type Rename = (id: string, name: string) => Promise<void>;
type Editor = { selectedId: string; rename: Rename };

// Before: an unrelated caller must obtain an editor.
async function renameBefore(editor: Editor, name: string): Promise<void> {
  await editor.rename(editor.selectedId, name);
}

// After: the UI supplies selection; the operation accepts domain inputs.
async function renameAfter(rename: Rename, id: string, name: string): Promise<void> {
  await rename(id, name);
}
```

Move real validation, permission checks, persistence, and history grouping with the domain operation. Do not add this forwarding helper if callers can simply call the existing `rename(id, name)` capability. Keep editor ownership when the operation genuinely concerns editor-local selection or undo rather than a shared domain change.
