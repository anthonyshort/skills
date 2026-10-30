# Reconcile dependent state when its source changes

## When to check

A selected resource, query, source object, version or owner can change while dependent state or asynchronous work survives.

## What to check

- Identify which source identity and version the dependent state belongs to. Check relevant local edits as well as saved commits. An unchanged resource ID does not prove the source is unchanged.
- Trace replacement, deletion, reload, undo/redo and concurrent updates where they apply. Reconcile selections, subscriptions and runtime state at the owning boundary, including members referenced only by the previous source.
- Follow pending work across those transitions. Apply a result only while its captured source/version is still current, or retain it under the correct historical/cache key. Cancellation alone does not prove an obsolete completion cannot be applied.
- Preserve unsaved changes when applying or replacing state. Use a representative transition to show what would otherwise be retained, lost or overwritten.

## Why it matters

State and asynchronous results can outlive the source that made them valid. Stale results can replace current edits or leave removed resources selected.

## Exceptions

Historical snapshots and deliberately retained caches can survive source replacement when ownership and keys are explicit. Independent state need not reset with every source edit. Choose the smallest relevant version boundary rather than rebuilding everything after any change.

## Good and bad examples

Assume the source owner increments `version` for every edit or replacement that changes membership, including replacements with the same ID. `loadMembers` is an existing I/O boundary. The example implements the stale-result check rather than hiding it in a helper.

```typescript
type Source = { id: string; version: number };
declare let currentSource: Source;
declare function loadMembers(id: string): Promise<readonly string[]>;
let memberIds: readonly string[] = [];

// Bad: a completion can replace members after the selected source changes.
async function refreshBefore(): Promise<void> {
  memberIds = await loadMembers(currentSource.id);
}

// Good: commit only to the source version that requested this result.
async function refresh(): Promise<void> {
  const { id, version } = currentSource;
  const members = await loadMembers(id);
  if (currentSource.id !== id || currentSource.version !== version) {
    return;
  }
  memberIds = members;
}
```

This guards the completion. The source-changing operation must also reconcile already-held members when its contract requires that. Do not claim the guard alone handles deletion, resource disposal or unsaved-edit conflicts.
