# Correctness assessment
Distinct correctness task reused shared worker context. Checklist established first: behaviour, finding, counterexamples, independent expectations, coverage, root cause, runtime wiring, CI/generated discovery, validation, confidence. Worker inspected coordinator script/results and independently inspected source and installed Valtio implementation. No reruns or edits.

| Case | Behaviour/counterexamples | Finding/root cause | Independent expectations/coverage | Conclusion |
|---|---|---|---|---|
| A01 | Test failed plain retained callback | Concern found receiver lost service:3,6 | Source checked retries must equal1. No supplied test | Defect |
| A02 | Test failed keyboard leaves open; menu succeeds | Concern found incomplete shared operation service:6-8 | Source checked both fields required. No supplied test | Defect |
| A03 | Test failed mean duplicates6 vs4, sum12/empty correct | Concern found distinct divisor service:6 | Concern found supplied test:3 expects6, though 12/3=4. Supplied test passes | Defect |
| A04 | Test failed observed count remains0 | Concern found original-object write service:5; Valtio copies initial into independent baseObject esm/vanilla.mjs:135,190-200 | Source checked real action and same ESM subscribe. No supplied test | Defect |
| A05 | Test passed ordering, repeat stop, B rollback/error identity, A failure prevents B | Source checked rollback/guard service:3-12 | Source checked public API honest expected order. Cleanup throws excluded | No defect found |
| A06 | Test passed invalid values, holes, bounds0/100/101, fresh output | Source checked boundary/copy service:3-11 | Source checked concrete independent cases. No supplied test | No defect found |
| A07 | Test passed draft amount edit/push isolation, total5 and empty0 | Source checked copy/total service:4-7 | Source checked full output independent. No supplied test | No defect found |
| A08 | Test passed pending gate, allowed retrieval, denial/no get, same rejection, reader failure | Source checked await/return service:5-7 | Source checked controlled promises, required rejections, public factory | No defect found |

Per-case shared checklist outcomes: runtime wiring Source checked and exercised exported operations; CI Not verified no pipeline/package scripts; generated files N/A no generators/files; confidence bounded to supplied contracts, no wider integration. Four defect causes source-traced above; other mechanisms align with SPEC. No supplied regressions except A03. Relevant gaps: retain callback A01, both entry points A02, corrected duplicate mean A03, proxy subscription A04, lifecycle A05, parser boundary/copy A06, draft isolation A07, controlled permission A08.

Validation: coordinator `source /home/anthonyshort/.nvm/nvm.sh && nvm use 24.22.1 >/dev/null && node /tmp/review-benchmark-output/independent-checks.mjs` inspected, Node24.22.1; A01-A04 contract failures, A05-A08 pass. A03 `node /tmp/review-benchmark-inputs/A03/service.test.ts` passed, wrong expectation independently identified. A04 separate ESM diagnostic printed before0/after0/notifications0. Initial mismatched CJS subscription harness discarded/corrected, not a product finding.

Worker command -v tsc/eslint/prettier and all local node_modules/.bin paths found none. No lint/format/typecheck configuration or scripts. Suites blocked/unavailable, not passed. No tool installed.

Loaded: skills/review/SKILL.md correctness; best-practices/testing/SKILL.md; typescript/SKILL.md; references/api-design.md, schemas-narrowing.md, tooling-contracts.md, performance-resources.md, organisation-comments.md; valtio/SKILL.md; error-handling/SKILL.md. Testing owning layer, independent expectations, boundaries, real public operation, controlled async and cleanup checked in probes above. TS receivers A01, narrow input A06, lifetimes A05, promise ownership A08 checked. Valtio identity A04 checked. Error recovery/identity A05/A08 checked. React/UI/transport/browser/logging/collections N/A absent. Exotic throwing getters/proxies not established by SPEC input contract. No freezing requirement beyond specified historical draft isolation asserted.
