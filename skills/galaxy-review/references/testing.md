# Galaxy test coverage and harnesses

## Checklist

**Test coverage and harnesses**

- [ ] **Store tests** - Exercise changed Galaxy store behaviour with real stores, valid fixtures, deterministic updates and owned-resource cleanup.
- [ ] **Domain client tests** - Cover new or changed WorkbookClient, ReportClient, WorkbookTemplateClient and related domain-client operations through their real public APIs.
- [ ] **Backend test harness** - Use the real client/context and the selected Vitest project's MSW network handlers for backend behaviour.
- [ ] **Provider wiring** - Supply stores through supported providers rather than mocking shared modules or internal event targets.
- [ ] **Reactive test timing** - Flush the package's actual reactive scheduler and use fake time for changed debounce, timer or disposal paths.

## Guidance

### Test coverage and harnesses

- Apply the generic [testing guidance](../../testing-best-practices/SKILL.md) for store/client/utility coverage, test placement, readability and selective React testing. These are default coverage requirements for changed behaviour, not a request to backfill every untouched legacy file or manufacture tests for plain field assignments.
- Galaxy stores are normally cheap to test directly. Use the real store and the smallest valid workbook/report fixtures; invoke public methods and inspect state, derived results and domain effects. Cover changed selection/normalisation invariants, query transitions, history, persistence and disposal where relevant. Use the package's supported flushing helpers so scheduled effects have actually run; dispose stores and subscriptions owned by the case.
- Require tests for implemented new or changed operations in `WorkbookClient`, `ReportClient`, `WorkbookTemplateClient` and analogous application-facing domain clients. Exercise creation, copying, conversion, operation application or saving without mounting React or editor UI just to reach the operation. Assert preserved content, layout, resource kind, relevant wire fields and failure outcomes according to the changed contract. Use the real composed clients; do not mock the domain operation whose behaviour the test claims to prove.
- Put tests beside the implementation that owns the behaviour. For these class-owned methods use `WorkbookClient.test.ts` beside `WorkbookClient.ts`, `ReportClient.test.ts` beside `ReportClient.ts`, and equivalent names for other clients. Supported factories can remain test setup. Factory-specific tests belong beside the factory; avoid duplicating effective existing coverage solely because a legacy suite has a factory name, and migrate naming when reorganising the affected suite.
- For calls to the backend, inspect the package/app's current test harness: real generated clients, production context/provider construction and MSW at the routed backend URL. Reuse the selected project's shared server lifecycle when one exists, with per-case handlers and unexpected requests failing. If a suitable shared harness is missing, report the verification gap and recommend setup at its owning layer. An endpoint stand-in for a pure store unit does not prove the real compilation/refetch or wire boundary. Evaluate mocks by the behaviour they can establish, without loading repository test-policy files.
- Prefer providers/injected collaborators over swapping feature/shared modules. Keep the actual event publisher and subscriber when checking event wiring; assert the visible/state effect and cleanup, not just a mocked publisher call. A supplied public callback is different and can be a spy.
- Utility logic should have direct adjacent tests; keep imports specific so a pure test does not load the UI package. Component/hook tests should protect a useful UI-only contract, such as keyboard-to-store wiring, focus or unmount cleanup, rather than repeat store/client/utility tests. Honour the supplied acceptance criteria and actual test-discovery constraints, without importing repository test-policy checklists. Do not put tests in non-API Next.js `pages/`: move testable logic and its adjacent test into `client/` instead.
- Verify the active Vitest project's inclusion/exclusion patterns before claiming a new test runs. Use `.test.ts` or `.test.tsx` for ordinary adjacent tests; dedicated bundled integration/browser projects have their own explicit discovery requirements. Run scoped checks when practical and distinguish local results from exact-head CI evidence. Do not pad assertions to meet a numerical gate or treat a plan-specific coverage target as repository-wide policy.
