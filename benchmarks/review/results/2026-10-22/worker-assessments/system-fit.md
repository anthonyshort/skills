# System fit assessment
Distinct system-fit task reused research and product worker context. Source only. Checklist established first: D dependency direction; B bug prevention; S system fit; U reuse/coupling; F documented direction; R recommendation/cost.

| Case | D | B | S | U | F | R |
|---|---|---|---|---|---|---|
| A01 | Source checked no imports, client owns state | Concern found preserve receiver | Concern found SPEC plain call | Source checked narrow registration dependency | Source checked public method stays | Fits with changes. Restore closure, one line, no migration |
| A02 | Source checked Cart local ownership | Concern found shared invariant owner | Concern found menu precedent and SPEC | Concern found partial duplicated operation | Source checked no event migration | Fits with changes. Private shared clear, existing exports preserved |
| A03 | Source checked pure sum reuse | Concern found divisor not abstraction | Source checked pure function ownership | Source checked unnecessary Set semantics | Source checked sum preserved | Fits with changes. Divisor/test correction |
| A04 | Source checked sole import valtio/vanilla | Concern found mutate proxy | Concern found original differs from observed | Source checked alternate original write target | Source checked Valtio v1 explicit | Fits with changes. counter.count mutation, no migration |
| A05 | Source checked injected cleanup ownership | Source checked rollback/idempotence | Source checked SPEC lifetime | Source checked no overlapping manager | Source checked nonthrowing cleanup explicit | Fits. No architecture change |
| A06 | Source checked parser owns trust boundary | Source checked bounded copy validation | Source checked no canonical schema | Source checked no duplicate validator | Source checked no library requirement | Fits. No change |
| A07 | Source checked issue owns history | Source checked copies and total | Source checked existing copy pattern | Source checked historical value intentional | Source checked memory persistence explicit | Fits. No supplied caller migration |
| A08 | Source checked inward capabilities | Source checked awaited gate | Source checked public/internal split | Source checked useful one-responsibility wrapper | Source checked trusted direct reader permitted | Fits. No change |

Evidence: A01 service:3,6; A02 service:2-8; A03 service:1-7/test:3; A04 service:1-6; A05 service:3-12; A06 service:3-11; A07 service:4-7; A08 service:5-7. Each SPEC:3 establishes behaviour and SPEC:5 scope.

Guidance loaded: review/SKILL.md system question; best-practices/typescript/SKILL.md; references/api-design.md (composition, pure core, public wiring, receivers, small API); references/organisation-comments.md (ownership, cycles, promise ownership); references/schemas-narrowing.md (A06 full validation); references/performance-resources.md (A05 lifetime); best-practices/valtio/SKILL.md (A04 ownership/actions); best-practices/error-handling/SKILL.md (A05 rollback, A08 propagation). All selected checks source checked as above. CSS/HTML/React/tRPC/HTTP N/A absent. Runtime/testing deferred correctness. Performance caching, reactive collections, transport mapping and logging N/A no changed implementation. No supported broader architecture changes.
