---
name: nominal-galaxy-stores
description: Use for Galaxy valtio-store effects, watch and derive APIs, scope disposal and legacy or explicit history.
---

# Galaxy store best practices

## Effects and scopes

- Galaxy wraps Valtio in `valtio-store`. Inspect its implementation for current API mechanics.
- Use `watch` and `derive` for new store code, including additions to legacy stores. They replace `computeBatched` and related helpers. Verify current availability before recommending migration.
- In `BaseStore`, use `this.watch` and `this.derive` to register effects with `this.scope`.
- For effects outside a store, check scope registration and cleanup.
- Keep watched dependencies narrow. Trace watch frequency and retained data.
- Disposal must stop owned effects without stopping borrowed dependencies. Do not assume a parent scope disposes child stores.

## History

- Identify whether the affected consumer uses legacy or explicit history. An injected manager does not prove explicit history is active.
- Preserve the whole-store proxy while legacy history requires it.
- Distinguish durable user state from transient runtime state, such as request IDs, controllers, provider handles and readiness flags.
- Under legacy whole-store history, use the current history-exclusion mechanism for transient fields. Verify the actual `noHistory` and `ref` behaviour before choosing one.
- Do not use `ref` merely to exclude history if consumers still need reactive updates.
- Distinguish permanently excluding a field from suppressing history for one system update. User edits may still need undo and redo.
- Explicit history must register durable edited state and start its manager. `BaseStore.registerHistory` does nothing without an injected manager.
- Verify undo and redo through the actual editing path.
