# Risk and slicing guidance check — 23 October 2026

A separate read-only agent exercised the updated review workflow, templates and split-pr skill against four hypothetical changes. This was a guidance check, not a real PR review or execution test.

| Scenario | Decision supported by the guidance |
| --- | --- |
| 80-line shared loader with broad active use and no isolated tests | Investigate consumers and failures despite the small diff. Record testability gaps. Keep together if cohesive. Missing tests alone do not prove a bug or justify splitting. |
| 1,200 lines of tested replacement code with no activation effects | Distinguish substantial review effort from low immediate production exposure. Consider useful splits without enforcing a line limit. Plan later activation. |
| 250-line feature spanning loader, state, UI and tests | Keep the small vertical slice together. Splitting solely by technical layer would obscure the behaviour. |
| Inactive replacement followed by a tiny consumer switch | Verify preparation first. Treat the switch as potentially high impact. Retain the old path for rollback and check data and contract compatibility. |

No blocking instruction conflicts were found. One template placeholder still offered only keep/split. It was aligned with the keep/simplify/split choices elsewhere.

The parent also checked that horizontal slices may group small, safe changes supporting different outcomes. The skill asks for a reason to group them and evidence of safety. It does not demand a single feature or a fixed layer order.

## Structural checks

- Both changed skills passed the skill-creator validator.
- Skill names were unique and local Markdown links resolved.
- Temporary discovery found all 19 skills in both generated skill directories, including split-pr.
- `git diff --check` passed.

No production PR, code change, branch operation or GitHub publication was tested. The size thresholds and proposed risk assessment have not yet been measured against real reviews.
