# Update state when its data changes

## When to check

A selected record, query, data object or store can change while the app still holds selections, saved results or work started from the old data.

## What to check

- Identify which record or data object the state belongs to and which edit it was created from. Include unsaved edits, not just saved commits. The same ID can refer to data that has changed.
- Follow replacements, deletion, reloads, undo/redo and updates from other users where they apply. Update selections, subscriptions and stored results in the code that handles the data change. Remove members that were included only by the old query when they no longer belong.
- Check requests that are still running when the data changes. Apply a result only if its record and version still match, or save it under the correct older version. Cancelling a request does not prove that its result cannot still arrive.
- Check that applying results or replacing data does not overwrite unsaved edits. Show an actual change that would otherwise leave old state behind, lose edits or overwrite newer results.
- Keep form drafts and useful view state after a failed submit. Reset submitted edits only after confirmed success, and do not reset newer edits made while the request was running. Capture the submitted draft or its edit version so the completion handler can tell which edits succeeded.

## Why it matters

A selection or request result can remain after the data it came from has changed. Old results can overwrite current edits or keep removed records selected.

## Exceptions

Historical snapshots and cached results can keep older data when they are clearly tied to the right record and version. State that does not depend on an edit need not reset because of it. Explicit discard or reset actions may clear drafts when that is the user’s intent. Do not rebuild everything after every change.

## Good and bad examples

Assume the code managing the data increases `version` whenever an edit or replacement changes its members, even if the ID stays the same. `loadMembers` is an existing function that fetches members. The check below discards results from an older version.

```typescript
type Source = { id: string; version: number };
declare let currentSource: Source;
declare function loadMembers(id: string): Promise<readonly string[]>;
let memberIds: readonly string[] = [];

// Bad: old results can replace members after the selected data changes.
async function refreshBefore(): Promise<void> {
  memberIds = await loadMembers(currentSource.id);
}

// Good: apply results only if the same data and edit are still selected.
async function refresh(): Promise<void> {
  const { id, version } = currentSource;
  const members = await loadMembers(id);
  if (currentSource.id !== id || currentSource.version !== version) {
    return;
  }
  memberIds = members;
}
```

This check only handles results that arrive later. Code that changes the selected data must also update the members it already holds when needed. The check does not handle deletion, cleanup or conflicting unsaved edits by itself.
