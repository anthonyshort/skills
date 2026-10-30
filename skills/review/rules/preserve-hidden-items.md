# Preserve items the user cannot see

## When to check

The change filters or restricts a collection, saves its members, or adds selection and bulk actions over a partial view.

## What to check

- Trace the full collection, the visible subset and the IDs sent by save, clear, select-all and delete actions. Identify whether each action applies to visible items, selected items or the whole collection.
- Check that saving a partial view does not replace the full membership with only the members the user can see. Preserve hidden selections when changing a filter or clearing the visible selection unless the user explicitly clears everything.
- Follow select-all through the later bulk action. A visible-items action must not silently expand to filtered-out or inaccessible items. Make the affected scope clear before a destructive action runs.
- Check permission at the operation as well as in the UI. Preserve unseen members without revealing their details or assuming that visibility grants permission to edit them.
- Show the hidden member that would be dropped or acted on and the reachable interaction that causes it. A filtered list alone is not evidence of a defect.

## Why it matters

Users can lose unseen members when a filtered list replaces the original collection. A bulk action can also affect records they never saw or intended to select.

## Exceptions

An explicitly labelled whole-collection action may affect hidden items when the user has permission and its scope is clear. A view may deliberately discard selection on filter changes when that behaviour is part of the interaction and cannot silently change saved membership or delete unseen items.

## Good and bad examples

Assume selection can include hidden IDs. The action is labelled “Clear visible selection”, so IDs outside `visibleIds` must stay selected. This function only updates selection. A later delete action still needs its own explicit scope and permission checks.

```typescript
// Bad: clearing the current view also loses hidden selections.
function clearVisibleBefore(
  selected: ReadonlySet<string>,
  visibleIds: ReadonlySet<string>,
): Set<string> {
  return new Set([...selected].filter((id) => visibleIds.has(id)));
}

// Good: remove only IDs that belong to the current view.
function clearVisible(
  selected: ReadonlySet<string>,
  visibleIds: ReadonlySet<string>,
): Set<string> {
  return new Set([...selected].filter((id) => !visibleIds.has(id)));
}

const selected = new Set(["visible", "hidden"]);
const visibleIds = new Set(["visible"]);
// clearVisibleBefore returns {"visible"}, dropping the hidden selection.
// clearVisible returns {"hidden"}, matching the action's stated scope.
```
