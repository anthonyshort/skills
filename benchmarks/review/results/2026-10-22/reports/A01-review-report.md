# Review: A01 — Connect the retry action

**Scope:** `/tmp/review-benchmark-inputs/A01`. Complete `75c3b5d7c72e95c689098f5cad2d1b8d49dce47d..5d9cfdbeebdb335c3131a6f75872d6f6892eee69` diff. All tracked source and supported callers reviewed. node_modules supplies runtime dependencies only.

## Assessment

Changes required. Retry throws a TypeError and does not increment the client retry count. 1 new bugs. No previously reported concerns. Keep this change together. Lint, format and typecheck checks are unavailable because no configured tasks or executables exist.

| Area | Conclusion and evidence |
|---|---|
| Product | The user need is supported, but the implementation violates an explicit requirement. |
| Direction | Local ownership and capability dependencies fit the fixture. No wider migration exists. |
| Design | Small cohesive implementation. |
| Readability | Names and flat module placement are clear. No separate style finding. |
| Correctness | Retain callback, invoke plainly, assert retries=1. Fails with TypeError. |

## Findings

| ID | Type / severity | Finding | Status | Action |
|---|---|---|---|---|
| A01-F1 | Bug / P1 | Preserve the retry method receiver | New | Required fix |

### A01-F1 — Preserve the retry method receiver

- **Location:** `service.ts:6` at `5d9cfdbeebdb335c3131a6f75872d6f6892eee69`.

- **Trigger:** Invoke the registered callback as a plain function.

- **Effect:** Retry throws a TypeError and does not increment the client retry count.

- **Evidence:** Client.retry reads this.retries at line 3. connect passes the unbound method. Independent Node check throws: Cannot read properties of undefined (reading retries). SPEC.md:3 requires plain callback invocation.

- **Action:** Restore registerRetry(() => client.retry()). Keep the public retry method.

Caller comparison: `registerRetry(client.retry)` becomes `registerRetry(() => client.retry())`. The registration and public method contracts stay the same.

## Verification summary

| Check | Method | Result | Evidence or limit |
|---|---|---|---|
| Complete pinned diff and SPEC | Source inspection | Source checked | service.ts:3,6. Retained plain call loses this. |
| Independent SPEC probes | Node24.22.1 execution | Test failed | Retain callback, invoke plainly, assert retries=1. Fails with TypeError. |
| Supplied test | Inventory | N/A | No supplied test |
| Formatter | Tool inventory | Blocked | No script, local executable or PATH prettier |
| Lint and typecheck | Tool inventory | Not run | No configured tasks. Node execution strips types and does not typecheck. |
| External research | Scope restriction | N/A | Self-contained fixtures. External services explicitly excluded |

CI execution is not verified because these fixtures contain no CI configuration. No generated outputs or generators exist. Node strips TypeScript syntax and does not establish type correctness.

<details>

<summary>Research context and limits</summary>



A retained retry callback must increment its client once when invoked as a plain function. The existing public method must remain. Source: `SPEC.md:3`.

service.ts:3,6. Retained plain call loses this.

Each `SPEC.md:5` excludes linked discussions, external decisions and migrations. Research read the full diff, every tracked file, package manifests and local history. Only baseline and target commits exist. External GitHub, Slack and Notion research is N/A under the benchmark instructions.

No unresolved requirement question changes the assessment.

This is one batched workflow across eight independent targets. The same worker performed research, then five separate question tasks, then one rule pass. Previous task context was reused. No hidden scoring source or prior report was consulted.

No real application integration was available. Runtime probes cover specified ordinary data and relevant boundaries. Exotic hostile getters and proxies were not exhaustively exercised.

</details>

<details>

<summary>Complete review checklist coverage</summary>



Each check below was established before its question pass. Source checked means inspection, not runtime success. All paths are relative to the reviewed fixture unless identified as guidance.

| Assessment / guidance | Check | Result | Evidence or reason |
|---|---|---|---|
| Product · review Step 3 | Problem fit | Concern found | A retained retry callback must increment its client once when invoked as a plain function. The existing public method must remain. service.ts:3,6. Retained plain call loses this. |
| Product · review Step 3 | Alternatives | Source checked | Restore the closure. |
| Product · review Step 3 | Conflicts | Concern found | Requirement conflict in finding. |
| Product · review Step 3 | Recommendation | Source checked | Changes required. Keep together. |
| System fit · review Step 3; TS API design | Dependency direction | Source checked | No local cycles. No production imports. |
| System fit · review Step 3; TS API design | Bug prevention | Concern found | Immediate correction prevents the supported defect. |
| System fit · review Step 3; TS API design | System fit | Concern found | service.ts:3,6. Retained plain call loses this. |
| System fit · review Step 3; TS API design | Reuse and coupling | Source checked | No unsupported duplicated implementation or coupling found. |
| System fit · review Step 3; TS API design | Documented direction | Source checked | SPEC:3,5 defines local ownership. No broader migration requirement. |
| System fit · review Step 3; TS API design | Recommendations and cost | Source checked | Local correction with unchanged consumer contracts. |
| Simplicity · review Step 3; TS API design | Complexity | Source checked | Responsibilities correspond to one small specified operation.  |
| Simplicity · review Step 3; TS API design | Unused code | Source checked | All tracked consumers inspected. No obsolete export supported for removal. |
| Simplicity · review Step 3; TS API design | Simplifications | Concern found | Use the behaviour-preserving local correction in findings. |
| Simplicity · review Step 3; TS API design | Scope | Source checked | Keep together. No independent unrelated work and no change near 500 lines. |
| Simplicity · review Step 3; TS API design | Minimality | Source checked | Small scope. Correction needed. |
| Readability · review Step 3; TS organisation/comments | Names | Source checked | Domain names describe roles. service.ts:3,6. Retained plain call loses this. |
| Readability · review Step 3; TS organisation/comments | Organisation | Source checked | Related types and operations colocated in flat service.ts. |
| Readability · review Step 3; TS organisation/comments | Control flow | Source checked | Short flow is directly traceable. Semantic findings reported separately. |
| Readability · review Step 3; TS organisation/comments | Comments | N/A | No changed comments or complex algorithm requiring documentation. |
| Readability · review Step 3; TS organisation/comments | Formatter | Blocked | No formatter script or executable in local dependencies or PATH. |
| Correctness · review Step 3; testing guidance | Behaviour | Test failed | Retain callback, invoke plainly, assert retries=1. Fails with TypeError. |
| Correctness · review Step 3; testing guidance | Findings | Concern found | Supported source trace and reproduction above. |
| Correctness · review Step 3; testing guidance | Counterexamples | Test failed | Retain callback, invoke plainly, assert retries=1. Fails with TypeError. |
| Correctness · review Step 3; testing guidance | Test correctness | Source checked | Probe expectations derived from SPEC, not implementation. |
| Correctness · review Step 3; testing guidance | Regression coverage | Source checked | Only A03 supplies a test. Keep focused regression for the exercised contract. |
| Correctness · review Step 3; testing guidance | Root cause | Concern found | service.ts:3,6. Retained plain call loses this. |
| Correctness · review Step 3; testing guidance | Runtime wiring | Source checked | Real exported operations imported. No extra required configuration in SPEC. |
| Correctness · review Step 3; testing guidance | CI and generated output | Not run | CI not verified: absent. Generated checks N/A: no generated code. |
| Correctness · review Step 3; testing guidance | Validation | Test failed | Retain callback, invoke plainly, assert retries=1. Fails with TypeError. No configured lint, typecheck or formatter.  |
| Correctness · review Step 3; testing guidance | Confidence | Source checked | Bounded to source and specified probe paths. No wider integration claim. |
| TS tooling/contracts | Public contracts and declarations | Source checked | Explicit public return types inspected. No configured declaration emit or typecheck, so emitted compatibility not verified. |
| TS type models | Variants, utility models and overloads | N/A | No changed variants, overloads or utility type construction. |
| TS API design: receivers | Callback receiver | Concern found | service.ts:3,6. Retained plain call loses this. |



Excluded guidance: CSS, HTML, React, tRPC and HTTP endpoint skills are not selected because no corresponding implementation exists. Performance caching, browser APIs, logging and reactive collections introduce no relevant changed behaviour.



**Loaded skill and reference paths:**

- Skill: `skills/review/SKILL.md`

- Skill: `skills/best-practices/typescript/SKILL.md`

- Skill: `skills/best-practices/testing/SKILL.md`

- Reference: `skills/best-practices/typescript/references/api-design.md`

- Reference: `skills/best-practices/typescript/references/organisation-comments.md`

- Reference: `skills/best-practices/typescript/references/tooling-contracts.md`



Run-wide loaded guidance and SHA-256 versions are recorded in `guidance-versions.json`. TS schema, bounds and resource references were read during shared review context, then applied only where relevant.

</details>

<details>

<summary>Complete rule coverage</summary>



Rules are from `skills/review/rules/README.md`. One worker checked applicable rules sequentially across all eight cases.

| Rule | Selection and reason | Result | Evidence and limits |
|---|---|---|---|
| Avoid duplicate live state (`avoid-duplicate-live-state.md`) | Skipped: No calculated duplicate live value stored. | Not applicable | No calculated duplicate live value stored. |
| Keep domain operations independent of UI (`keep-domain-operations-independent-of-ui.md`) | Skipped: No mounted component, editor or UI dependency. A02 accepts domain Cart despite entry-point names. | Not applicable | No mounted component, editor or UI dependency. A02 accepts domain Cart despite entry-point names. |
| Consistent cleanup contracts (`make-cleanup-contracts-consistent.md`) | Skipped: No changed resource cleanup contract. | Not applicable | No changed resource cleanup contract. |
| Remove unnecessary interaction steps (`remove-unnecessary-interaction-steps.md`) | Skipped: No new UI confirmation, selection or intermediate interaction. | Not applicable | No new UI confirmation, selection or intermediate interaction. |
| Make function calls clear (`make-function-calls-clear.md`) | Selected: Changed behaviour meets the rule screening scope | Satisfied | Public function inputs/results use meaningful domain values; no fake flags, placeholders or configuration. Source checked service.ts. Semantic defects evaluated separately. |
| Simplify HTTP calls (`simplify-http-calls.md`) | Skipped: No HTTP calls or envelopes. | Not applicable | No HTTP calls or envelopes. |
| Migrate callers in small steps (`migrate-callers-in-small-steps.md`) | Skipped: SPEC:5 establishes no adopted replacement or migration. | Not applicable | SPEC:5 establishes no adopted replacement or migration. |
| Remove wrappers without value (`remove-wrappers-that-add-no-value.md`) | Selected: Changed behaviour meets the rule screening scope | Concern found | Removed closure preserved receiver; service:3,6 plain callback throws. Restore closure. |
| Use registries for real extensions (`use-registries-for-real-extensions.md`) | Skipped: No registry, plugin mechanism or dynamic lookup. | Not applicable | No registry, plugin mechanism or dynamic lookup. |
| Await required operations (`await-required-operations.md`) | Selected: Changed behaviour meets the rule screening scope | Satisfied | Synchronous retry has no async completion to await. Receiver defect separate. |
| Extract decisions only when useful (`extract-decisions-only-when-useful.md`) | Skipped: No relevant decision/effect split or fragmented policy helper. | Not applicable | No relevant decision/effect split or fragmented policy helper. |
| Keep shared code independent (`keep-shared-code-independent.md`) | Skipped: No shared-to-feature dependency or cross-module move. A04 imports framework only. | Not applicable | No shared-to-feature dependency or cross-module move. A04 imports framework only. |
| Compatible API changes (`keep-api-changes-compatible.md`) | Selected: Changed behaviour meets the rule screening scope | Concern found | Plain registration contract broken by detached method service:6; SPEC:3 and runtime TypeError. |
| Check retries for repeated effects (`check-retries-for-repeated-effects.md`) | Selected: Changed behaviour meets the rule screening scope | Satisfied | Increment per invocation intentional. No external duplicate effect or idempotency requirement. |
| Bind query values (`bind-query-values.md`) | Skipped: No database query construction. | Not applicable | No database query construction. |
| Bound file access (`keep-file-access-within-allowed-paths.md`) | Skipped: No file access or external paths. | Not applicable | No file access or external paths. |
| Shared state rules in shared actions (`keep-shared-state-rules-in-shared-actions.md`) | Skipped: No several interactions coordinating the same related-state invariant. A04 is one count action. | Not applicable | No several interactions coordinating the same related-state invariant. A04 is one count action. |

</details>

<details>

<summary>Commands, inputs and consolidation</summary>



The coordinator ran:

```sh

source /home/anthonyshort/.nvm/nvm.sh && nvm use 24.22.1 >/dev/null && node /tmp/review-benchmark-output/independent-checks.mjs

```

Recorded Test failed: Retain callback, invoke plainly, assert retries=1. Fails with TypeError.

A03 supplied test also ran under Node24.22.1 and printed Assertions passed. A04 separate diagnostic imported the same ESM Valtio module and printed before0, after0, notifications0. The first CJS/ESM mismatch in the review harness was corrected and discarded. It is not a product finding.

Tool inventory checked PATH and local node_modules/.bin for tsc, eslint and prettier. No executables or configured package scripts found. No environment installation or source alteration was performed.

Inputs completed: research.md; product.md; system-fit.md; simplicity.md; readability.md; correctness.md; rules.md. Coordinator checked important claims against full source, SPEC and independent runtime evidence. Overlapping product, design and correctness comments were merged into one finding per defect. No unresolved disagreement changes the verdict.

</details>
