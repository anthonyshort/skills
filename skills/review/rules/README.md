# Review rules

Use this index to select rules for Step 4 of the review skill. One subagent works through the rules one at a time and returns evidence or a skip reason for every rule. Check the evidence and exceptions. Apply any explicit blocking policies in the rules.

| Rule | When to check |
| --- | --- |
| [Fix the code instead of disabling lint checks](fix-code-instead-of-disabling-lint.md) | Changed code is covered by a lint suppression, or the change weakens lint configuration or coverage. |
| [Avoid storing values that can be calculated](avoid-duplicate-live-state.md) | The change stores a value calculated from other changing state. |
| [Update state when its data changes](reconcile-state-when-its-source-changes.md) | A selected record, query, data object or store can change while the app still holds selections, saved results or work started from the old data. |
| [Keep shared operations independent of mounted UI](keep-domain-operations-independent-of-ui.md) | A shared operation requires a component, editor or UI object. |
| [Use consistent cleanup contracts for similar resources](make-cleanup-contracts-consistent.md) | Callers manage resources with different cleanup shapes, or subscriptions and cancellable work gain or change an owner. |
| [Remove interaction steps the task does not need](remove-unnecessary-interaction-steps.md) | A UI introduces selection, confirmation or other intermediate states. |
| [Make function calls clear and direct](make-function-calls-clear.md) | A function API changes, its positional argument list grows, or callers supply misleading flags or placeholder values. |
| [Use the app’s locale when formatting values](localise-user-facing-values.md) | The change formats money, dates, times, numbers, percentages or other values whose display depends on the user’s language and region. |
| [Simplify HTTP calls without changing their meaning](simplify-http-calls.md) | An HTTP API introduces command envelopes or unnecessary response unpacking. |
| [Migrate callers in small supported steps](migrate-callers-in-small-steps.md) | Changed code uses an API that has an adopted replacement. |
| [Remove wrappers that add no value](remove-wrappers-that-add-no-value.md) | A helper mostly forwards calls, an API is added or changed, or a feature repeats behaviour already provided by shared code. |
| [Use registries for real extension needs](use-registries-for-real-extensions.md) | A change introduces a registry, plugin system or dynamic lookup. |
| [Await operations whose results matter](await-required-operations.md) | Events or callbacks trigger work that later code depends on. |
| [Extract decisions only when it helps](extract-decisions-only-when-useful.md) | A file or component combines separate tasks, code mixes decisions with effects or distinct phases, or small operations are split into helpers. |
| [Keep shared code independent of its consumers](keep-shared-code-independent.md) | The change adds shared-code dependencies or moves behaviour between shared and feature modules. |
| [Keep API changes compatible with callers](keep-api-changes-compatible.md) | The change affects a function, event, HTTP API or log output that other code, monitors or alerts rely on. |
| [Keep copied types and values in sync](keep-duplicated-contracts-in-sync.md) | The change copies types, schemas, enum members, flags, policy lists, error fields or defaults defined elsewhere. |
| [Do not allow access when permission is unknown](keep-unknown-permissions-distinct-from-allowed.md) | The change affects permission checks, defaults that allow access, saved permission results, which records a user can access or when tokens expire. |
| [Check retries for repeated side effects](check-retries-for-repeated-effects.md) | A changed operation has side effects and a realistic retry or duplicate-request path. |
| [Bind query values and restrict dynamic identifiers](bind-query-values.md) | External values or dynamic identifiers enter database query construction. |
| [Keep file access within allowed paths](keep-file-access-within-allowed-paths.md) | External input controls paths or a directory containment check changes. |
| [Keep shared state rules in shared actions](keep-shared-state-rules-in-shared-actions.md) | Several interactions update related state, a change adds another caller that must preserve the same invariant, or one operation changes several related fields or records. |
| [Make React component tests earn their cost](justify-react-component-tests.md) | A change adds or expands component tests, puts substantial logic in a component, or prompts a request for UI coverage. |
| [Bound work and check that loops advance](bound-work-and-check-progress.md) | The change reads repeated chunks, handles large requests, retains buffers or starts work for many items at once. |
| [Check what package imports load](check-package-imports-and-dependencies.md) | The change adds a package import, changes a package entry point, or moves code into a worker or separately built package. |
| [Check the cost of performance changes](check-the-cost-of-performance-changes.md) | The change adds a cache, memoisation, comparison, preloading or other work intended to improve performance. |
| [Display expressions accurately](display-expressions-accurately.md) | The change renders a formula, condition, query or other expression, or substitutes display names and bindings into one. |
| [Explain why code works this way](explain-why-code-works-this-way.md) | The change introduces unclear names, unusual ordering, a workaround, or comments that no longer describe the code. |
| [Handle only the error you mean to handle](handle-only-the-intended-error.md) | The change adds a retry, fallback, broad catch or optional request whose failure can affect other content. |
| [Handle the supported data shapes](handle-supported-data-shapes.md) | The change adds an enum or union case, changes runtime validation, or reads saved data that may come from another supported version. |
| [Keep API pages within the requested data](keep-api-pages-scoped-and-bounded.md) | The change adds or changes paginated reads, page sizes or page tokens. |
| [Keep controls accessible](keep-controls-accessible.md) | The change adds or changes controls, keyboard interactions, focus handling, accessibility attributes or wrappers around rich content. |
| [Keep logs useful without exposing private data](keep-logs-useful-and-safe.md) | The change adds or changes logs, error summaries, error wrapping or fields sent to monitoring tools. |
| [Keep time values and units clear](keep-time-values-and-units-clear.md) | The change compares, stores or converts timestamps, durations, time ranges or positions on a timeline. |
| [Make component props fit together](make-component-props-fit-together.md) | A component adds paired props, mode flags or values that only make sense for some supported modes. |
| [Match checks to what is built and deployed](match-checks-to-build-and-rollout.md) | The change skips CI checks based on changed files, changes build dependencies, or enables a caller of a service that may not yet be deployed. |
| [Preserve items the user cannot see](preserve-hidden-items.md) | The change filters or restricts a collection, saves its members, or adds selection and bulk actions over a partial view. |
| [Remove code without a real caller](remove-code-without-callers.md) | A change adds a helper, prop, parameter, export or branch with no visible use, or removes the last known caller. |
| [Show the actual loading and result state](show-loading-and-error-states.md) | The change displays asynchronous results, progress, success messages or actions that can become unavailable. |
| [Test the real behaviour](test-the-real-behaviour.md) | The change adds or updates tests, changes behaviour covered by tests, or claims that a client, store, provider or interaction is protected by a test. |
| [Use stable IDs and predictable ordering](use-stable-ids-and-ordering.md) | The change identifies selected items, stores references to them, or sorts and pages results. |
| [Use switches for related cases](use-switches-for-related-cases.md) | The change branches several times on the same enum, union or state value. |
