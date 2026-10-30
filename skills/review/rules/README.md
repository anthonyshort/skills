# Review rules

Use this index to select rules for Step 4 of the review skill. One subagent works through the rules one at a time and returns evidence or a skip reason for every rule. Check the evidence and exceptions. Apply any explicit blocking policies in the rules.

| Rule | When to check |
| --- | --- |
| [Fix the code instead of disabling lint checks](fix-code-instead-of-disabling-lint.md) | Changed code is covered by a lint suppression, or the change weakens lint configuration or coverage. |
| [Avoid storing values that can be calculated](avoid-duplicate-live-state.md) | The change stores a value calculated from other changing state. |
| [Update state when its data changes](reconcile-state-when-its-source-changes.md) | A selected record, query, data object or store can change while the app still holds selections, saved results or work started from the old data. |
| [Keep shared operations independent of mounted UI](keep-domain-operations-independent-of-ui.md) | A shared operation requires a component, editor or UI object. |
| [Use consistent cleanup contracts for similar resources](make-cleanup-contracts-consistent.md) | Callers manage resources with different cleanup shapes. |
| [Remove interaction steps the task does not need](remove-unnecessary-interaction-steps.md) | A UI introduces selection, confirmation or other intermediate states. |
| [Make function calls clear and direct](make-function-calls-clear.md) | A function API changes or callers supply misleading flags or placeholder values. |
| [Use the app’s locale when formatting values](localise-user-facing-values.md) | The change formats money, dates, times, numbers, percentages or other values whose display depends on the user’s language and region. |
| [Simplify HTTP calls without changing their meaning](simplify-http-calls.md) | An HTTP API introduces command envelopes or unnecessary response unpacking. |
| [Migrate callers in small supported steps](migrate-callers-in-small-steps.md) | Changed code uses an API that has an adopted replacement. |
| [Remove wrappers that add no value](remove-wrappers-that-add-no-value.md) | A helper mostly forwards calls, an API is added or changed, or a feature repeats behaviour already provided by shared code. |
| [Use registries for real extension needs](use-registries-for-real-extensions.md) | A change introduces a registry, plugin system or dynamic lookup. |
| [Await operations whose results matter](await-required-operations.md) | Events or callbacks trigger work that later code depends on. |
| [Extract decisions only when it helps](extract-decisions-only-when-useful.md) | Code mixes decisions with effects, combines distinct phases or abstraction levels, or splits small operations into helpers. |
| [Keep shared code independent of its consumers](keep-shared-code-independent.md) | The change adds shared-code dependencies or moves behaviour between shared and feature modules. |
| [Keep API changes compatible with callers](keep-api-changes-compatible.md) | The change affects a function, event, HTTP API or log output that other code, monitors or alerts rely on. |
| [Keep copied types and values in sync](keep-duplicated-contracts-in-sync.md) | The change copies types, schemas, enum members, policy lists, error fields or defaults defined elsewhere. |
| [Do not allow access when permission is unknown](keep-unknown-permissions-distinct-from-allowed.md) | The change affects permission checks, defaults that allow access, saved permission results, which records a user can access or when tokens expire. |
| [Check retries for repeated side effects](check-retries-for-repeated-effects.md) | A changed operation has side effects and a realistic retry or duplicate-request path. |
| [Bind query values and restrict dynamic identifiers](bind-query-values.md) | External values or dynamic identifiers enter database query construction. |
| [Keep file access within allowed paths](keep-file-access-within-allowed-paths.md) | External input controls paths or a directory containment check changes. |
| [Keep shared state rules in shared actions](keep-shared-state-rules-in-shared-actions.md) | Several interactions coordinate related state or a new caller must preserve the same invariant. |
| [Make React component tests earn their cost](justify-react-component-tests.md) | A change adds or expands component tests, puts substantial logic in a component, or prompts a request for UI coverage. |
