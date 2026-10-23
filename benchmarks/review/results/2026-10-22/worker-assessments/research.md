# Batched research brief
Completed before Step 3. Eight independent exact base..head targets share this workflow context. Full manifest, SPEC.md, all tracked files and diffs read. HEADs match manifest. Only baseline and target local history exists. node_modules untracked and excluded.

| Case | Requirement and source evidence | Context and limits |
|---|---|---|
| A01 | SPEC:3 retry retained callback invoked plain must increment once, preserve retry method. service.ts:1-6 replaces closure with method reference. | Client owns mutation, external register retains callback. No supplied caller/tests. |
| A02 | SPEC:3 both clear operations empty items and close. service.ts:2-8 menu writes both fields, keyboard only items. | Same domain operation, no other consumers. |
| A03 | SPEC:3 mean counts duplicate samples, empty undefined, preserve sum. service.ts:1-7 distinct divisor. Test:3 expects 6 for [2,2,8]. | Expected arithmetic must be independently checked. |
| A04 | SPEC:3 proxy consumers subscribe, increment must publish. service.ts:1-6 writes original initial. | Installed Valtio semantics require verification. |
| A05 | SPEC:3 start A then B, stop B then A, nonthrowing cleanup, rollback A on B failure, repeat inert. service.ts:1-14. | No concrete watchers. Nonthrowing cleanup explicit. |
| A06 | SPEC:3 <=100 nonempty strings, empty valid, invalid undefined, fresh array. service.ts:1-12 validates and copies. | No canonical schema framework. |
| A07 | SPEC:3 historical invoice snapshot protects against later draft edits. service.ts:1-9 copies lines and saves total. | In-memory persistence intentional. Stronger freeze requirement unsupported. |
| A08 | SPEC:3 wrapper public untrusted boundary, await authorisation before get, propagate unchanged. service.ts:1-10. | Internal direct readers trusted, no other configuration required. |

Research checks: Scope/behaviour Source checked across full diffs and caller inventories. Intent/decisions Source checked each SPEC:3,5. Existing discussions, Slack, Notion, external PR searches N/A: self-contained fixtures explicitly exclude external context and task forbids searches. Related changes Source checked local history (all refs and last 30 days changed paths), only baseline/target. Evidence/gaps recorded. package.json has no test/lint/format/typecheck scripts. Only A03 supplies test. No runtime checks in research. No scoring/private paths or conversation artefacts accessed.
