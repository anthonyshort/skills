# Review rules

Use this index to select rules for Step 4 of the review skill. One subagent works through the rules one at a time and returns evidence or a skip reason for every rule. Check the evidence and exceptions. Apply any explicit blocking policies in the rules.

| Rule | When to check |
| --- | --- |
| [Fix the code instead of disabling lint checks](fix-code-instead-of-disabling-lint.md) | Changed code is covered by a lint suppression, or the change weakens lint configuration or coverage. |
| [Avoid storing values that can be calculated](avoid-duplicate-live-state.md) | The change stores a value calculated from other changing state. |
| [Keep shared operations independent of mounted UI](keep-domain-operations-independent-of-ui.md) | A shared operation requires a component, editor or UI object. |
| [Use consistent cleanup contracts for similar resources](make-cleanup-contracts-consistent.md) | Callers manage resources with different cleanup shapes. |
| [Remove interaction steps the task does not need](remove-unnecessary-interaction-steps.md) | A UI introduces selection, confirmation or other intermediate states. |
| [Make function calls clear and direct](make-function-calls-clear.md) | A function API changes or callers supply misleading flags or placeholder values. |
| [Simplify HTTP calls without changing their meaning](simplify-http-calls.md) | An HTTP API introduces command envelopes or unnecessary response unpacking. |
| [Migrate callers in small supported steps](migrate-callers-in-small-steps.md) | Changed code uses an API that has an adopted replacement. |
| [Remove wrappers that add no value](remove-wrappers-that-add-no-value.md) | A layer forwards calls or the change adds or modifies an abstraction. |
| [Use registries for real extension needs](use-registries-for-real-extensions.md) | A change introduces a registry, plugin system or dynamic lookup. |
| [Await operations whose results matter](await-required-operations.md) | Events or callbacks trigger work that later code depends on. |
| [Extract decisions only when it helps](extract-decisions-only-when-useful.md) | Code mixes decisions with effects, combines distinct phases or abstraction levels, or splits small operations into helpers. |
| [Keep shared code independent of its consumers](keep-shared-code-independent.md) | The change adds shared-code dependencies or moves behaviour between shared and feature modules. |
| [Keep API changes compatible with callers](keep-api-changes-compatible.md) | A function, event or HTTP contract used by supported callers changes. |
| [Check retries for repeated side effects](check-retries-for-repeated-effects.md) | A changed operation has side effects and a realistic retry or duplicate-request path. |
| [Bind query values and restrict dynamic identifiers](bind-query-values.md) | External values or dynamic identifiers enter database query construction. |
| [Keep file access within allowed paths](keep-file-access-within-allowed-paths.md) | External input controls paths or a directory containment check changes. |
| [Keep shared state rules in shared actions](keep-shared-state-rules-in-shared-actions.md) | Several interactions coordinate related state or a new caller must preserve the same invariant. |
