# Await operations whose results matter

## When to check

Events or callbacks trigger work that later code depends on.

## What to check

Trace completion, returned results, ordering and failures. Use an awaited call when the caller needs success or a result. For notifications, check publication timing, listener errors, asynchronous rejections and subscription cleanup.

## Why it matters

Notifications without a completion contract can race required work or hide failures.

## Exceptions

Events suit independent observers. Keep direct calls when a known consumer is simpler. Do not replace required commands with fire-and-forget notifications or change listener semantics silently.

## Example

This comparison illustrates the trade-off. Check the actual requirements and callers before recommending a change.

An emitter can decouple independent observers. It cannot replace an awaited command when the caller needs its result or must stop on failure.

```typescript
declare const events: { emit(name: "save", id: string): void };
declare function save(id: string): Promise<{ revision: number }>;
declare function showSaved(revision: number): void;

// Before: no completion or failure contract; notification races persistence.
function saveBefore(id: string): void {
  events.emit("save", id);
  showSaved(0);
}

// After: the real revision is available only after successful persistence.
async function saveAfter(id: string): Promise<void> {
  const saved = await save(id);
  showSaved(saved.revision);
}
```

The before form is a defect only if “saved” requires successful persistence. Request/response belongs in a returned value/promise, not a correlation-ID event protocol for one known owner. Preserve serial ordering if several required steps depend on each other; do not replace awaited calls with fire-and-forget notifications.

For a genuine notification, the observer owns its subscription lifetime:

```typescript
type Saved = { id: string; revision: number };
type SavedEvents = {
  onSaved(listener: (event: Saved) => void): () => void;
};
declare function invalidate(id: string): void;

// Before: mounting repeatedly retains every observer.
function mountBefore(events: SavedEvents): void {
  events.onSaved((event) => invalidate(event.id));
}

// After: the mounting owner calls the returned stop handle on disposal.
function mountAfter(events: SavedEvents): () => void {
  return events.onSaved((event) => invalidate(event.id));
}
```

Specify actual publication semantics: emit only after save succeeds; define synchronous listener order and whether one throw stops later listeners. If observers run asynchronously, own every rejection and define whether completion is awaited. Do not silently change these semantics when replacing direct calls with an emitter or async iterable. Keep direct calls when a single known consumer is simpler; no event infrastructure is required by this example.
