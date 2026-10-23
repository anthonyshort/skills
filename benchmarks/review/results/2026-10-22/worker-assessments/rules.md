# Rule assessment
One worker read the rule index, then full applicable rules sequentially. Shared research, previous source evidence and runtime probes were reused. No extra rule collections supplied. All results source inspection unless runtime is explicitly cited.
Loaded full rules: 1,2,3,5,8,10,11,13,14,17. Rule2 read before confirming N/A. Other rules skipped from index selection criteria.
| Rule | Case | Selection | Result | Evidence or exclusion |
|---|---|---|---|---|
| avoid-duplicate-live-state.md | A01 | Skipped | Not applicable | No calculated duplicate live value stored. |
| avoid-duplicate-live-state.md | A02 | Skipped | Not applicable | No calculated duplicate live value stored. |
| avoid-duplicate-live-state.md | A03 | Skipped | Not applicable | No calculated duplicate live value stored. |
| avoid-duplicate-live-state.md | A04 | Skipped | Not applicable | No calculated duplicate live value stored. |
| avoid-duplicate-live-state.md | A05 | Skipped | Not applicable | No calculated duplicate live value stored. |
| avoid-duplicate-live-state.md | A06 | Skipped | Not applicable | No calculated duplicate live value stored. |
| avoid-duplicate-live-state.md | A07 | Selected | Satisfied | Historical snapshot exception explicitly applies. SPEC:3; service:4-7; draft mutation probe passed. |
| avoid-duplicate-live-state.md | A08 | Skipped | Not applicable | No calculated duplicate live value stored. |
| keep-domain-operations-independent-of-ui.md | A01 | Skipped | Not applicable | No mounted component, editor or UI dependency. A02 accepts domain Cart despite entry-point names. |
| keep-domain-operations-independent-of-ui.md | A02 | Skipped | Not applicable | No mounted component, editor or UI dependency. A02 accepts domain Cart despite entry-point names. |
| keep-domain-operations-independent-of-ui.md | A03 | Skipped | Not applicable | No mounted component, editor or UI dependency. A02 accepts domain Cart despite entry-point names. |
| keep-domain-operations-independent-of-ui.md | A04 | Skipped | Not applicable | No mounted component, editor or UI dependency. A02 accepts domain Cart despite entry-point names. |
| keep-domain-operations-independent-of-ui.md | A05 | Skipped | Not applicable | No mounted component, editor or UI dependency. A02 accepts domain Cart despite entry-point names. |
| keep-domain-operations-independent-of-ui.md | A06 | Skipped | Not applicable | No mounted component, editor or UI dependency. A02 accepts domain Cart despite entry-point names. |
| keep-domain-operations-independent-of-ui.md | A07 | Skipped | Not applicable | No mounted component, editor or UI dependency. A02 accepts domain Cart despite entry-point names. |
| keep-domain-operations-independent-of-ui.md | A08 | Skipped | Not applicable | No mounted component, editor or UI dependency. A02 accepts domain Cart despite entry-point names. |
| make-cleanup-contracts-consistent.md | A01 | Skipped | Not applicable | No changed resource cleanup contract. |
| make-cleanup-contracts-consistent.md | A02 | Skipped | Not applicable | No changed resource cleanup contract. |
| make-cleanup-contracts-consistent.md | A03 | Skipped | Not applicable | No changed resource cleanup contract. |
| make-cleanup-contracts-consistent.md | A04 | Skipped | Not applicable | No changed resource cleanup contract. |
| make-cleanup-contracts-consistent.md | A05 | Selected | Satisfied | Uniform Stop handles. Reverse disposal, rollback, repeat guard service:1-13; runtime passed. Nonthrowing cleanup explicit. |
| make-cleanup-contracts-consistent.md | A06 | Skipped | Not applicable | No changed resource cleanup contract. |
| make-cleanup-contracts-consistent.md | A07 | Skipped | Not applicable | No changed resource cleanup contract. |
| make-cleanup-contracts-consistent.md | A08 | Skipped | Not applicable | No changed resource cleanup contract. |
| remove-unnecessary-interaction-steps.md | A01 | Skipped | Not applicable | No new UI confirmation, selection or intermediate interaction. |
| remove-unnecessary-interaction-steps.md | A02 | Skipped | Not applicable | No new UI confirmation, selection or intermediate interaction. |
| remove-unnecessary-interaction-steps.md | A03 | Skipped | Not applicable | No new UI confirmation, selection or intermediate interaction. |
| remove-unnecessary-interaction-steps.md | A04 | Skipped | Not applicable | No new UI confirmation, selection or intermediate interaction. |
| remove-unnecessary-interaction-steps.md | A05 | Skipped | Not applicable | No new UI confirmation, selection or intermediate interaction. |
| remove-unnecessary-interaction-steps.md | A06 | Skipped | Not applicable | No new UI confirmation, selection or intermediate interaction. |
| remove-unnecessary-interaction-steps.md | A07 | Skipped | Not applicable | No new UI confirmation, selection or intermediate interaction. |
| remove-unnecessary-interaction-steps.md | A08 | Skipped | Not applicable | No new UI confirmation, selection or intermediate interaction. |
| make-function-calls-clear.md | A01 | Selected | Satisfied | Public function inputs/results use meaningful domain values; no fake flags, placeholders or configuration. Source checked service.ts. Semantic defects evaluated separately. |
| make-function-calls-clear.md | A02 | Selected | Satisfied | Public function inputs/results use meaningful domain values; no fake flags, placeholders or configuration. Source checked service.ts. Semantic defects evaluated separately. |
| make-function-calls-clear.md | A03 | Selected | Satisfied | Public function inputs/results use meaningful domain values; no fake flags, placeholders or configuration. Source checked service.ts. Semantic defects evaluated separately. |
| make-function-calls-clear.md | A04 | Selected | Satisfied | Public function inputs/results use meaningful domain values; no fake flags, placeholders or configuration. Source checked service.ts. Semantic defects evaluated separately. |
| make-function-calls-clear.md | A05 | Selected | Satisfied | Public function inputs/results use meaningful domain values; no fake flags, placeholders or configuration. Source checked service.ts. Semantic defects evaluated separately. |
| make-function-calls-clear.md | A06 | Selected | Satisfied | Public function inputs/results use meaningful domain values; no fake flags, placeholders or configuration. Source checked service.ts. Semantic defects evaluated separately. |
| make-function-calls-clear.md | A07 | Selected | Satisfied | Public function inputs/results use meaningful domain values; no fake flags, placeholders or configuration. Source checked service.ts. Semantic defects evaluated separately. |
| make-function-calls-clear.md | A08 | Selected | Satisfied | Public function inputs/results use meaningful domain values; no fake flags, placeholders or configuration. Source checked service.ts. Semantic defects evaluated separately. |
| simplify-http-calls.md | A01 | Skipped | Not applicable | No HTTP calls or envelopes. |
| simplify-http-calls.md | A02 | Skipped | Not applicable | No HTTP calls or envelopes. |
| simplify-http-calls.md | A03 | Skipped | Not applicable | No HTTP calls or envelopes. |
| simplify-http-calls.md | A04 | Skipped | Not applicable | No HTTP calls or envelopes. |
| simplify-http-calls.md | A05 | Skipped | Not applicable | No HTTP calls or envelopes. |
| simplify-http-calls.md | A06 | Skipped | Not applicable | No HTTP calls or envelopes. |
| simplify-http-calls.md | A07 | Skipped | Not applicable | No HTTP calls or envelopes. |
| simplify-http-calls.md | A08 | Skipped | Not applicable | No HTTP calls or envelopes. |
| migrate-callers-in-small-steps.md | A01 | Skipped | Not applicable | SPEC:5 establishes no adopted replacement or migration. |
| migrate-callers-in-small-steps.md | A02 | Skipped | Not applicable | SPEC:5 establishes no adopted replacement or migration. |
| migrate-callers-in-small-steps.md | A03 | Skipped | Not applicable | SPEC:5 establishes no adopted replacement or migration. |
| migrate-callers-in-small-steps.md | A04 | Skipped | Not applicable | SPEC:5 establishes no adopted replacement or migration. |
| migrate-callers-in-small-steps.md | A05 | Skipped | Not applicable | SPEC:5 establishes no adopted replacement or migration. |
| migrate-callers-in-small-steps.md | A06 | Skipped | Not applicable | SPEC:5 establishes no adopted replacement or migration. |
| migrate-callers-in-small-steps.md | A07 | Skipped | Not applicable | SPEC:5 establishes no adopted replacement or migration. |
| migrate-callers-in-small-steps.md | A08 | Skipped | Not applicable | SPEC:5 establishes no adopted replacement or migration. |
| remove-wrappers-that-add-no-value.md | A01 | Selected | Concern found | Removed closure preserved receiver; service:3,6 plain callback throws. Restore closure. |
| remove-wrappers-that-add-no-value.md | A02 | Selected | Satisfied | Clear operation owns domain state. |
| remove-wrappers-that-add-no-value.md | A03 | Selected | Satisfied | Mean adds calculation. |
| remove-wrappers-that-add-no-value.md | A04 | Selected | Satisfied | Action owns count mutation. |
| remove-wrappers-that-add-no-value.md | A05 | Selected | Satisfied | Group owns lifecycle and rollback. |
| remove-wrappers-that-add-no-value.md | A06 | Selected | Satisfied | Parser owns validation and copy. |
| remove-wrappers-that-add-no-value.md | A07 | Selected | Satisfied | Issue owns historical conversion. |
| remove-wrappers-that-add-no-value.md | A08 | Selected | Satisfied | Access-enforcement exception: wrapper awaits authorisation. SPEC:3; service:5-7; gate probe passed. |
| use-registries-for-real-extensions.md | A01 | Skipped | Not applicable | No registry, plugin mechanism or dynamic lookup. |
| use-registries-for-real-extensions.md | A02 | Skipped | Not applicable | No registry, plugin mechanism or dynamic lookup. |
| use-registries-for-real-extensions.md | A03 | Skipped | Not applicable | No registry, plugin mechanism or dynamic lookup. |
| use-registries-for-real-extensions.md | A04 | Skipped | Not applicable | No registry, plugin mechanism or dynamic lookup. |
| use-registries-for-real-extensions.md | A05 | Skipped | Not applicable | No registry, plugin mechanism or dynamic lookup. |
| use-registries-for-real-extensions.md | A06 | Skipped | Not applicable | No registry, plugin mechanism or dynamic lookup. |
| use-registries-for-real-extensions.md | A07 | Skipped | Not applicable | No registry, plugin mechanism or dynamic lookup. |
| use-registries-for-real-extensions.md | A08 | Skipped | Not applicable | No registry, plugin mechanism or dynamic lookup. |
| await-required-operations.md | A01 | Selected | Satisfied | Synchronous retry has no async completion to await. Receiver defect separate. |
| await-required-operations.md | A02 | Skipped | Not applicable | No dependent event or callback operation. |
| await-required-operations.md | A03 | Skipped | Not applicable | No dependent event or callback operation. |
| await-required-operations.md | A04 | Selected | Concern found | Required observed publication bypassed by original-object mutation service:5. Source plus count0/notification0 diagnostic. |
| await-required-operations.md | A05 | Selected | Satisfied | Synchronous setup/cleanup order service:3-12; runtime passed. |
| await-required-operations.md | A06 | Skipped | Not applicable | No dependent event or callback operation. |
| await-required-operations.md | A07 | Skipped | Not applicable | No dependent event or callback operation. |
| await-required-operations.md | A08 | Selected | Satisfied | Authorisation awaited before retrieval service:5-7; controlled gate and rejection probes passed. |
| extract-decisions-only-when-useful.md | A01 | Skipped | Not applicable | No relevant decision/effect split or fragmented policy helper. |
| extract-decisions-only-when-useful.md | A02 | Skipped | Not applicable | No relevant decision/effect split or fragmented policy helper. |
| extract-decisions-only-when-useful.md | A03 | Skipped | Not applicable | No relevant decision/effect split or fragmented policy helper. |
| extract-decisions-only-when-useful.md | A04 | Skipped | Not applicable | No relevant decision/effect split or fragmented policy helper. |
| extract-decisions-only-when-useful.md | A05 | Selected | Satisfied | Stopped decision stays with disposal owner service:9-10. |
| extract-decisions-only-when-useful.md | A06 | Selected | Satisfied | Local validation is cohesive service:3-11; no independent consumer. |
| extract-decisions-only-when-useful.md | A07 | Skipped | Not applicable | No relevant decision/effect split or fragmented policy helper. |
| extract-decisions-only-when-useful.md | A08 | Selected | Satisfied | Access decision stays at effect boundary service:5-7. |
| keep-shared-code-independent.md | A01 | Skipped | Not applicable | No shared-to-feature dependency or cross-module move. A04 imports framework only. |
| keep-shared-code-independent.md | A02 | Skipped | Not applicable | No shared-to-feature dependency or cross-module move. A04 imports framework only. |
| keep-shared-code-independent.md | A03 | Skipped | Not applicable | No shared-to-feature dependency or cross-module move. A04 imports framework only. |
| keep-shared-code-independent.md | A04 | Skipped | Not applicable | No shared-to-feature dependency or cross-module move. A04 imports framework only. |
| keep-shared-code-independent.md | A05 | Skipped | Not applicable | No shared-to-feature dependency or cross-module move. A04 imports framework only. |
| keep-shared-code-independent.md | A06 | Skipped | Not applicable | No shared-to-feature dependency or cross-module move. A04 imports framework only. |
| keep-shared-code-independent.md | A07 | Skipped | Not applicable | No shared-to-feature dependency or cross-module move. A04 imports framework only. |
| keep-shared-code-independent.md | A08 | Skipped | Not applicable | No shared-to-feature dependency or cross-module move. A04 imports framework only. |
| keep-api-changes-compatible.md | A01 | Selected | Concern found | Plain registration contract broken by detached method service:6; SPEC:3 and runtime TypeError. |
| keep-api-changes-compatible.md | A02 | Skipped | Not applicable | New API without modified existing supported consumer contract. |
| keep-api-changes-compatible.md | A03 | Selected | Satisfied | Existing sum unchanged and probe returns12. New mean defect separate. |
| keep-api-changes-compatible.md | A04 | Skipped | Not applicable | New API without modified existing supported consumer contract. |
| keep-api-changes-compatible.md | A05 | Skipped | Not applicable | New API without modified existing supported consumer contract. |
| keep-api-changes-compatible.md | A06 | Skipped | Not applicable | New API without modified existing supported consumer contract. |
| keep-api-changes-compatible.md | A07 | Selected | Satisfied | Added invoice output intentional. No supplied construction callers need migration. |
| keep-api-changes-compatible.md | A08 | Skipped | Not applicable | New API without modified existing supported consumer contract. |
| check-retries-for-repeated-effects.md | A01 | Selected | Satisfied | Increment per invocation intentional. No external duplicate effect or idempotency requirement. |
| check-retries-for-repeated-effects.md | A02 | Skipped | Not applicable | No realistic duplicated effect requiring idempotency. Pure calculations, harmless clear, intentional count action, snapshot construction or read-only access. |
| check-retries-for-repeated-effects.md | A03 | Skipped | Not applicable | No realistic duplicated effect requiring idempotency. Pure calculations, harmless clear, intentional count action, snapshot construction or read-only access. |
| check-retries-for-repeated-effects.md | A04 | Skipped | Not applicable | No realistic duplicated effect requiring idempotency. Pure calculations, harmless clear, intentional count action, snapshot construction or read-only access. |
| check-retries-for-repeated-effects.md | A05 | Selected | Satisfied | Repeated disposal explicit; stopped guard service:9-10 and runtime verified. |
| check-retries-for-repeated-effects.md | A06 | Skipped | Not applicable | No realistic duplicated effect requiring idempotency. Pure calculations, harmless clear, intentional count action, snapshot construction or read-only access. |
| check-retries-for-repeated-effects.md | A07 | Skipped | Not applicable | No realistic duplicated effect requiring idempotency. Pure calculations, harmless clear, intentional count action, snapshot construction or read-only access. |
| check-retries-for-repeated-effects.md | A08 | Skipped | Not applicable | No realistic duplicated effect requiring idempotency. Pure calculations, harmless clear, intentional count action, snapshot construction or read-only access. |
| bind-query-values.md | A01 | Skipped | Not applicable | No database query construction. |
| bind-query-values.md | A02 | Skipped | Not applicable | No database query construction. |
| bind-query-values.md | A03 | Skipped | Not applicable | No database query construction. |
| bind-query-values.md | A04 | Skipped | Not applicable | No database query construction. |
| bind-query-values.md | A05 | Skipped | Not applicable | No database query construction. |
| bind-query-values.md | A06 | Skipped | Not applicable | No database query construction. |
| bind-query-values.md | A07 | Skipped | Not applicable | No database query construction. |
| bind-query-values.md | A08 | Skipped | Not applicable | No database query construction. |
| keep-file-access-within-allowed-paths.md | A01 | Skipped | Not applicable | No file access or external paths. |
| keep-file-access-within-allowed-paths.md | A02 | Skipped | Not applicable | No file access or external paths. |
| keep-file-access-within-allowed-paths.md | A03 | Skipped | Not applicable | No file access or external paths. |
| keep-file-access-within-allowed-paths.md | A04 | Skipped | Not applicable | No file access or external paths. |
| keep-file-access-within-allowed-paths.md | A05 | Skipped | Not applicable | No file access or external paths. |
| keep-file-access-within-allowed-paths.md | A06 | Skipped | Not applicable | No file access or external paths. |
| keep-file-access-within-allowed-paths.md | A07 | Skipped | Not applicable | No file access or external paths. |
| keep-file-access-within-allowed-paths.md | A08 | Skipped | Not applicable | No file access or external paths. |
| keep-shared-state-rules-in-shared-actions.md | A01 | Skipped | Not applicable | No several interactions coordinating the same related-state invariant. A04 is one count action. |
| keep-shared-state-rules-in-shared-actions.md | A02 | Selected | Concern found | SPEC:3 requires both entry points to empty and close. service:2-8 keyboard omits closing, runtime reproduced. Share complete action. |
| keep-shared-state-rules-in-shared-actions.md | A03 | Skipped | Not applicable | No several interactions coordinating the same related-state invariant. A04 is one count action. |
| keep-shared-state-rules-in-shared-actions.md | A04 | Skipped | Not applicable | No several interactions coordinating the same related-state invariant. A04 is one count action. |
| keep-shared-state-rules-in-shared-actions.md | A05 | Skipped | Not applicable | No several interactions coordinating the same related-state invariant. A04 is one count action. |
| keep-shared-state-rules-in-shared-actions.md | A06 | Skipped | Not applicable | No several interactions coordinating the same related-state invariant. A04 is one count action. |
| keep-shared-state-rules-in-shared-actions.md | A07 | Skipped | Not applicable | No several interactions coordinating the same related-state invariant. A04 is one count action. |
| keep-shared-state-rules-in-shared-actions.md | A08 | Skipped | Not applicable | No several interactions coordinating the same related-state invariant. A04 is one count action. |
A01 rules8/13 merge into receiver bug. A02 rule17 merges clear invariant bug. A04 rule10 merges observable mutation bug. A03 arithmetic is supported independently by correctness guidance. No compiler, formatter or CI result inferred. External callers and decisions excluded by self-contained scope.
