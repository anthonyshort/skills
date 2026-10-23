# Product assessment
Shared worker, distinct product task, research completed first. Per-case checklist P problem fit, A simplest supported alternative, C requirement/ongoing-work conflicts, R recommendation established before source verification. No runtime claims.

| Case | P result/evidence | A result/evidence | C result/evidence | R |
|---|---|---|---|---|
| A01 | Concern found service:3,6 plain callback loses this | Source checked restore closure preserving public method | Concern found SPEC:3 once retry | Adjust |
| A02 | Concern found service:6-8 leaves open | Source checked shared clear action preserves both fields | Concern found SPEC:3 both entry points | Adjust |
| A03 | Concern found service:6/test:3 12/3=4 not6 | Source checked values.length removes Set | Concern found SPEC:3 duplicates count | Adjust |
| A04 | Concern found service:5 original object write | Source checked counter.count mutation | Concern found SPEC:3 observed update | Adjust |
| A05 | Source checked service:3-12 ordering/rollback/idempotence | Source checked no supported simpler alternative | Source checked SPEC nonthrowing cleanup | Proceed |
| A06 | Source checked service:3-11 bounds/strings/copy | Source checked no canonical schema dependency needed | Source checked no conflict SPEC:3,5 | Proceed |
| A07 | Source checked service:4-7 historical copy/total | Source checked saved historical value justified | Source checked draft-edit contract | Proceed |
| A08 | Source checked service:5-7 await then delegate | Source checked wrapper owns public boundary | Source checked trusted internals permitted | Proceed |

Guidance: review product question all four checks for each case. TS API preserve receivers A01; pure calculations/small capability surface A03/A06/A07/A08. Valtio ownership A04. Error handling propagation/recovery A05/A08. Source checked. CSS/HTML/React/tRPC/HTTP N/A no corresponding implementation. Testing not selected product-only. Valtio React/snapshots/collections/batching N/A absent. Error logging/response mapping N/A no diagnostic/transport boundary. External work N/A explicit self-contained scope. No supported reason to abandon user needs.

A01 caller comparison: current registerRetry(client.retry), proposed registerRetry(() => client.retry()). A02 consumer APIs unchanged; both can delegate to private clearCart(cart). No API migration required.
