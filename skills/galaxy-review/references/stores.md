# Galaxy store effects and history

## Checklist

**Store effects**

- [ ] **Store framework** - Read the affected package's instructions and internal store APIs.
- [ ] **New watchers** - Check newly written watchers use `watch`, not older helpers.
- [ ] **New derived values** - Check newly written derivations use `derive`, not older helpers.
- [ ] **Watch scope** - Check watchers do not observe broader data than their work needs.
- [ ] **Effect ownership** - Check effects stop with their owning store's scope.

**Store history**

- [ ] **Active history** - Identify whether the consumer uses legacy or explicit history.
- [ ] **Legacy proxy** - Keep the whole store proxied where legacy history requires it.
- [ ] **History wiring** - Check explicit history is registered and started before relying on it.
- [ ] **Undo behaviour** - Verify affected user edits remain undoable and redoable.

## Guidance

### Store effects

- Galaxy wraps Valtio in the `valtio-store` package. Read its instructions and implementation for API mechanics; standard Valtio guidance alone does not cover these wrappers.
- Use `watch` and `derive` for all new store code, including additions to legacy stores. They use the shared scheduler and replace `computeBatched` and related helpers. Existing uses are being migrated separately.
- In `BaseStore`, use `this.watch` and `this.derive`; these attach effects to `this.scope`. For effects outside a store, verify scope registration and cleanup against the package API.
- Trace watch frequency and retained data to catch over-watching or runaway memory.
- Disposal must stop owned effects without stopping borrowed dependencies. Do not assume disposing a parent scope disposes child stores.

### Store history

- Explicit history is the intended replacement for the legacy history proxy. Check the consumer's actual wiring; availability or injection of a manager does not mean it is active.
- Until a consumer is migrated, preserve the whole-store Valtio proxy required by its legacy history. Do not remove it solely because explicit history APIs exist.
- For explicit history, inspect the history implementation and targeted API documentation in Galaxy. Registration must cover the durable state being edited, and the manager must be started. `BaseStore.registerHistory` does nothing without an injected manager.
- Verify undo and redo through the affected editing path. Do not assume a migration is complete from types or constructor wiring alone.
