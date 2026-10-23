# Organisation and comments

## Modules and organisation

- Keep feature components, hooks, types, and constants together. Split utilities by responsibility; avoid directories for trivial helpers.
- Follow repository naming: typically PascalCase for component files, `useName` for hooks, descriptive camelCase for utilities, and `types.ts`/`constants.ts` for shared feature definitions.
- Prefer named re-exports for selected items. Use wildcards only for the intended module API. Avoid dependency cycles.
- Await, return or explicitly handle each promise rejection. Keep async wrappers only when they add behaviour.

## Comments

- Follow project comment conventions. When applying the caller's preference, use multi-line JSDoc for documentation and `//` for short comments.

  ```typescript
  /**
   * Cancels the pending request when its owner is disposed.
   */
  function disposeRequest() {
    // The request may outlive its UI owner.
    controller.abort();
  }
  ```

- Explain constraints and unexpected behaviour without describing obvious code.
- Document complex algorithms with multi-line JSDoc explaining their invariants and flow. Add an ASCII illustration for very complex algorithms.
- Use `//` comments for non-obvious phases, ordering constraints or state transitions that the code does not reveal. Name the actual constraint; function length alone does not require comments.
- Treat formatting as non-blocking unless project instructions require it.
