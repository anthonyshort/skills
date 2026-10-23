# Review: A08 — Expose an authorised invoice reader

**Scope:** `/tmp/review-benchmark-inputs/A08`. Complete `53d143346eaba0cb074388cd0d5cd5acfcfb58f3..55f01d367c3b19f9dc5452ac579d01c33dccb7c7` diff. All tracked source and supported callers reviewed. node_modules supplies runtime dependencies only.

## Assessment

No defects found within the verified scope. The implementation matches the supplied contract in the inspected source and focused runtime checks. 0 new bugs. No previously reported concerns. Keep this change together. Lint, format and typecheck checks are unavailable because no configured tasks or executables exist.

| Area | Conclusion and evidence |
|---|---|
| Product | Matches the intended task. |
| Direction | Local ownership and capability dependencies fit the fixture. No wider migration exists. |
| Design | Small cohesive implementation. |
| Readability | Names and flat module placement are clear. No separate style finding. |
| Correctness | Controlled pending authorisation prevents get. Success returns same invoice. Denial prevents get and preserves reason. Reader failure preserves reason. Passed. |

## Findings

No supported findings.

## Verification summary

| Check | Method | Result | Evidence or limit |
|---|---|---|---|
| Complete pinned diff and SPEC | Source inspection | Source checked | service.ts:5-7. Awaited authorisation precedes reader.get. No catch changes rejection reasons. |
| Independent SPEC probes | Node24.22.1 execution | Test passed | Controlled pending authorisation prevents get. Success returns same invoice. Denial prevents get and preserves reason. Reader failure preserves reason. Passed. |
| Supplied test | Inventory | N/A | No supplied test |
| Formatter | Tool inventory | Blocked | No script, local executable or PATH prettier |
| Lint and typecheck | Tool inventory | Not run | No configured tasks. Node execution strips types and does not typecheck. |
| External research | Scope restriction | N/A | Self-contained fixtures. External services explicitly excluded |

CI execution is not verified because these fixtures contain no CI configuration. No generated outputs or generators exist. Node strips TypeScript syntax and does not establish type correctness.

<details>

<summary>Research context and limits</summary>



Await successful access authorisation before underlying retrieval. Preserve rejection identities. The wrapper is the public untrusted boundary. Direct readers are trusted. Source: `SPEC.md:3`.

service.ts:5-7. Awaited authorisation precedes reader.get. No catch changes rejection reasons.

Each `SPEC.md:5` excludes linked discussions, external decisions and migrations. Research read the full diff, every tracked file, package manifests and local history. Only baseline and target commits exist. External GitHub, Slack and Notion research is N/A under the benchmark instructions.

Direct readers are explicitly trusted capabilities.

This is one batched workflow across eight independent targets. The same worker performed research, then five separate question tasks, then one rule pass. Previous task context was reused. No hidden scoring source or prior report was consulted.

No real application integration was available. Runtime probes cover specified ordinary data and relevant boundaries. Exotic hostile getters and proxies were not exhaustively exercised.

</details>

<details>

<summary>Complete review checklist coverage</summary>



Each check below was established before its question pass. Source checked means inspection, not runtime success. All paths are relative to the reviewed fixture unless identified as guidance.

| Assessment / guidance | Check | Result | Evidence or reason |
|---|---|---|---|
| Product · review Step 3 | Problem fit | Source checked | Await successful access authorisation before underlying retrieval. Preserve rejection identities. The wrapper is the public untrusted boundary. Direct readers are trusted. service.ts:5-7. Awaited authorisation precedes reader.get. No catch changes rejection reasons. |
| Product · review Step 3 | Alternatives | Source checked | No supported simpler alternative preserves more required behaviour. |
| Product · review Step 3 | Conflicts | Source checked | No requirement conflict found. External ongoing work N/A.  |
| Product · review Step 3 | Recommendation | Source checked | No defects found within verified scope. Keep together. |
| System fit · review Step 3; TS API design | Dependency direction | Source checked | No local cycles. No production imports. |
| System fit · review Step 3; TS API design | Bug prevention | Source checked | Existing mechanisms preserve the specified invariant. |
| System fit · review Step 3; TS API design | System fit | Source checked | service.ts:5-7. Awaited authorisation precedes reader.get. No catch changes rejection reasons. |
| System fit · review Step 3; TS API design | Reuse and coupling | Source checked | No unsupported duplicated implementation or coupling found. |
| System fit · review Step 3; TS API design | Documented direction | Source checked | SPEC:3,5 defines local ownership. No broader migration requirement. |
| System fit · review Step 3; TS API design | Recommendations and cost | Source checked | No supported architectural change. |
| Simplicity · review Step 3; TS API design | Complexity | Source checked | Responsibilities correspond to one small specified operation.  |
| Simplicity · review Step 3; TS API design | Unused code | Source checked | All tracked consumers inspected. No obsolete export supported for removal. |
| Simplicity · review Step 3; TS API design | Simplifications | Source checked | No supported removal. Required guard, copy, ordering or boundary stays. |
| Simplicity · review Step 3; TS API design | Scope | Source checked | Keep together. No independent unrelated work and no change near 500 lines. |
| Simplicity · review Step 3; TS API design | Minimality | Source checked | Small scope. Required complexity justified by SPEC. |
| Readability · review Step 3; TS organisation/comments | Names | Source checked | Domain names describe roles. service.ts:5-7. Awaited authorisation precedes reader.get. No catch changes rejection reasons. |
| Readability · review Step 3; TS organisation/comments | Organisation | Source checked | Related types and operations colocated in flat service.ts. |
| Readability · review Step 3; TS organisation/comments | Control flow | Source checked | Short flow is directly traceable. Semantic findings reported separately. |
| Readability · review Step 3; TS organisation/comments | Comments | N/A | No changed comments or complex algorithm requiring documentation. |
| Readability · review Step 3; TS organisation/comments | Formatter | Blocked | No formatter script or executable in local dependencies or PATH. |
| Correctness · review Step 3; testing guidance | Behaviour | Test passed | Controlled pending authorisation prevents get. Success returns same invoice. Denial prevents get and preserves reason. Reader failure preserves reason. Passed. |
| Correctness · review Step 3; testing guidance | Findings | Source checked | No supported defect found. |
| Correctness · review Step 3; testing guidance | Counterexamples | Test passed | Controlled pending authorisation prevents get. Success returns same invoice. Denial prevents get and preserves reason. Reader failure preserves reason. Passed. |
| Correctness · review Step 3; testing guidance | Test correctness | Source checked | Probe expectations derived from SPEC, not implementation. |
| Correctness · review Step 3; testing guidance | Regression coverage | Source checked | Only A03 supplies a test. Keep focused regression for the exercised contract. |
| Correctness · review Step 3; testing guidance | Root cause | Source checked | service.ts:5-7. Awaited authorisation precedes reader.get. No catch changes rejection reasons. |
| Correctness · review Step 3; testing guidance | Runtime wiring | Source checked | Real exported operations imported. No extra required configuration in SPEC. |
| Correctness · review Step 3; testing guidance | CI and generated output | Not run | CI not verified: absent. Generated checks N/A: no generated code. |
| Correctness · review Step 3; testing guidance | Validation | Test passed | Controlled pending authorisation prevents get. Success returns same invoice. Denial prevents get and preserves reason. Reader failure preserves reason. Passed. No configured lint, typecheck or formatter.  |
| Correctness · review Step 3; testing guidance | Confidence | Source checked | Bounded to source and specified probe paths. No wider integration claim. |
| TS tooling/contracts | Public contracts and declarations | Source checked | Explicit public return types inspected. No configured declaration emit or typecheck, so emitted compatibility not verified. |
| TS type models | Variants, utility models and overloads | N/A | No changed variants, overloads or utility type construction. |
| TS promise ownership; error handling | Required success before dependent work and rejection identity | Test passed | Controlled pending authorisation prevents get. Success returns same invoice. Denial prevents get and preserves reason. Reader failure preserves reason. Passed. Transport mapping and logging N/A. |



Excluded guidance: CSS, HTML, React, tRPC and HTTP endpoint skills are not selected because no corresponding implementation exists. Performance caching, browser APIs, logging and reactive collections introduce no relevant changed behaviour.



**Loaded skill and reference paths:**

- Skill: `skills/review/SKILL.md`

- Skill: `skills/best-practices/typescript/SKILL.md`

- Skill: `skills/best-practices/testing/SKILL.md`

- Skill: `skills/best-practices/error-handling/SKILL.md`

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
| Remove wrappers without value (`remove-wrappers-that-add-no-value.md`) | Selected: Changed behaviour meets the rule screening scope | Satisfied | Access-enforcement exception: wrapper awaits authorisation. SPEC:3; service:5-7; gate probe passed. |
| Use registries for real extensions (`use-registries-for-real-extensions.md`) | Skipped: No registry, plugin mechanism or dynamic lookup. | Not applicable | No registry, plugin mechanism or dynamic lookup. |
| Await required operations (`await-required-operations.md`) | Selected: Changed behaviour meets the rule screening scope | Satisfied | Authorisation awaited before retrieval service:5-7; controlled gate and rejection probes passed. |
| Extract decisions only when useful (`extract-decisions-only-when-useful.md`) | Selected: Changed behaviour meets the rule screening scope | Satisfied | Access decision stays at effect boundary service:5-7. |
| Keep shared code independent (`keep-shared-code-independent.md`) | Skipped: No shared-to-feature dependency or cross-module move. A04 imports framework only. | Not applicable | No shared-to-feature dependency or cross-module move. A04 imports framework only. |
| Compatible API changes (`keep-api-changes-compatible.md`) | Skipped: New API without modified existing supported consumer contract. | Not applicable | New API without modified existing supported consumer contract. |
| Check retries for repeated effects (`check-retries-for-repeated-effects.md`) | Skipped: No realistic duplicated effect requiring idempotency. Pure calculations, harmless clear, intentional count action, snapshot construction or read-only access. | Not applicable | No realistic duplicated effect requiring idempotency. Pure calculations, harmless clear, intentional count action, snapshot construction or read-only access. |
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

Recorded Test passed: Controlled pending authorisation prevents get. Success returns same invoice. Denial prevents get and preserves reason. Reader failure preserves reason. Passed.

A03 supplied test also ran under Node24.22.1 and printed Assertions passed. A04 separate diagnostic imported the same ESM Valtio module and printed before0, after0, notifications0. The first CJS/ESM mismatch in the review harness was corrected and discarded. It is not a product finding.

Tool inventory checked PATH and local node_modules/.bin for tsc, eslint and prettier. No executables or configured package scripts found. No environment installation or source alteration was performed.

Inputs completed: research.md; product.md; system-fit.md; simplicity.md; readability.md; correctness.md; rules.md. Coordinator checked important claims against full source, SPEC and independent runtime evidence. Overlapping product, design and correctness comments were merged into one finding per defect. No unresolved disagreement changes the verdict.

</details>
