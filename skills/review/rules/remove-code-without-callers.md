# Remove code without a real caller

## When to check

A change adds a helper, prop, parameter, export or branch with no visible use, or removes the last known caller.

## What to check

- Search for reads, calls and registrations, including generated code, dynamic lookup, plugins, public exports and migration entry points. A missing direct import does not prove code is unused.
- For new code, identify the first real caller and what that caller needs. Prefer adding a helper with that caller rather than maintaining a speculative API.
- Follow a removed caller to the helpers, props and state it alone needed. Remove those too when no supported use remains.
- Before proposing deletion, explain why the code cannot be reached through a supported entry point. Check published API promises and supported saved-data versions rather than relying only on a text search.

## Why it matters

Unused code still needs reading, updating and testing. A helper written before its caller can impose assumptions the real use does not need.

## Exceptions

Public library APIs, plugin registrations, generated entry points and migrations can have callers outside the repository or outside the current code path. Keep code needed by a supported release or a staged rollout. Explain that use rather than deleting it to satisfy a search result.

## Good and bad examples

Assume this private module has no external callers, and the editor only needs a title. The unused preview helper has no registered or dynamic use.

```typescript
type Draft = { title: string };

// Bad: unused input and a helper for a feature with no caller.
function titleBefore(draft: Draft, includePreview: boolean): string {
  return draft.title.trim();
}
function previewBefore(draft: Draft): string {
  return draft.title.slice(0, 80);
}

// Good: keep what the current caller uses.
function title(draft: Draft): string {
  return draft.title.trim();
}
const label = title({ title: " Meeting notes " });
```

Add preview behaviour with the feature that uses it. If an older supported plugin calls a published preview export, keep that export or use the project’s agreed removal process.
