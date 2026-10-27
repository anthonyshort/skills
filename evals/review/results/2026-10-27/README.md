# Validity check — 27 October 2026

The evals should pass with the current review skill and fail when the skill is made worse. We ran them against the real skill and two deliberately broken copies.

| Run | Skill | Cases | Expected | Result |
| --- | --- | --- | --- | --- |
| Baseline | Current `skills/` | All 16 | All pass | 16/16 passed |
| Blind | Told to ignore design, readability and Valtio | 13 with problems to find | Fail | 10/13 failed |
| Bad standards | Five house rules that condemn good code | 3 controls | Fail | 3/3 failed |

Reviewer and grader were `claude -p` with the runner's defaults. Each run is a single trial.

## Baseline

| Case | Result |
| --- | --- |
| architecture/shared-imports-feature | Pass |
| architecture/domain-operation-needs-editor | Pass |
| architecture/import-cycle | Pass |
| architecture/duplicated-discount-rules | Pass |
| architecture/order-placement-calls-every-consumer | Pass |
| architecture/injected-adapter | Pass |
| readability/nested-conditionals | Pass |
| readability/vague-names | Pass |
| readability/mixed-responsibilities | Pass |
| readability/clear-helper | Pass |
| valtio/mutate-snapshot | Pass |
| valtio/subscription-without-cleanup | Pass |
| valtio/stale-snapshot-in-timer | Pass |
| valtio/native-set-in-proxy | Pass |
| valtio/stored-derived-total | Pass |
| valtio/idiomatic-store | Pass |

`injected-adapter` was rerun after its fixture was fixed. The others were regraded after the grading fix below. Their reviews were not rerun.

## Blind skill

This line was added to the Rules section of `review/SKILL.md`:

> Scope limit: Only report runtime defects in plain program logic. Do not report findings about architecture, dependency direction, coupling, duplication, file placement, naming, function length or structure, readability, or how state libraries such as Valtio are used. Treat all Valtio usage as correct. Mark those checks N/A.

Every architecture, readability and Valtio case failed except three:

- **duplicated-discount-rules:** The missing minimum-subtotal check is a runtime bug. The fix the review proposed was to call `applyDiscount`, which the grader counted as finding the duplication.
- **subscription-without-cleanup** and **stale-snapshot-in-timer:** The review reported them as general React lifecycle and stale-closure bugs. These cases check that the review catches the problem, but they don't show that the Valtio guidance is needed to catch it.

## Bad-standards skill

These rules were added to the Rules section of `review/SKILL.md`:

> House standards. Report every violation in changed code as a required P1 fix:
> - Functions have a single return statement.
> - Every exported function has a JSDoc comment.
> - Domain operations import their concrete infrastructure directly. Receiving an adapter as a parameter is unnecessary indirection.
> - Valtio stores must not use getters. Store computed values as plain fields and update them in actions.
> - Components must not call Valtio `subscribe`. Subscriptions belong in store modules.

All three controls failed on the expected criterion.

An earlier attempt told the skill to always report three required fixes, even with no evidence. The reviewer refused in every report, saying it wouldn't invent findings. That made it useless for checking the controls, so it was replaced with the bad standards above.

## Problems the check found in the evals

- **Grading bug:** The grader sometimes returned an entry for a "Must not flag" criterion the case didn't have. The runner treated that as an incomplete grade and failed the case without a note. This caused nine false failures in the first baseline grading. The runner now ignores unknown criteria and reports skipped ones as an error.
- **vague-names:** The fixture had real behaviour bugs. An unparseable date became an `Invalid Date` that bypassed "Skip undated", and the success message showed when the save failed. Its "no behaviour bug" criterion was removed.
- **injected-adapter:** The requirements promised a local-disk backend that didn't exist, and the adapter that was later added returned a malformed `file://` URL. Both gave the review legitimate findings on a control case. Both were fixed.

## Limits

- One trial per run, so this doesn't measure how stable the results are.
- The review ran headless. In some reports it said it didn't open the rule files.
- An LLM grades the reports. Passing grades were spot-checked against the quoted evidence.
