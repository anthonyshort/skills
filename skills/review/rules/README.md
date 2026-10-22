# Review rules

Use this index to select rules for Step 4 of the review skill. Assign each relevant rule to its own subagent. These rules describe trade-offs, not automatic reasons to request changes. Check the evidence and exceptions.

| Rule | When to check |
| --- | --- |
| [Avoid storing values that can be calculated](avoid-duplicate-live-state.md) | The change stores a value calculated from other changing state. |
| [Keep shared operations independent of mounted UI](keep-domain-operations-independent-of-ui.md) | A shared operation requires a component, editor or UI object. |
| [Use consistent cleanup contracts for similar resources](make-cleanup-contracts-consistent.md) | Callers manage resources with different cleanup shapes. |
| [Remove interaction steps the task does not need](remove-unnecessary-interaction-steps.md) | A UI introduces selection, confirmation or other intermediate states. |
| [Make function calls clear and direct](make-function-calls-clear.md) | A function API changes or callers supply misleading flags or placeholder values. |
| [Simplify HTTP calls without changing their meaning](simplify-http-calls.md) | An HTTP API introduces command envelopes or unnecessary response unpacking. |
| [Migrate callers in small supported steps](migrate-callers-in-small-steps.md) | Changed code uses an API that has an adopted replacement. |
| [Remove wrappers that add no value](remove-wrappers-that-add-no-value.md) | A layer mostly forwards calls to another capability. |
| [Use registries for real extension needs](use-registries-for-real-extensions.md) | A change introduces a registry, plugin system or dynamic lookup. |
| [Await operations whose results matter](await-required-operations.md) | Events or callbacks trigger work that later code depends on. |
| [Extract decisions only when it helps](extract-decisions-only-when-useful.md) | Code mixes a decision with effects, or splits small decisions into helpers. |
