# Work context questions

These are research and review questions, not assertions about the work repository.
Select relevant categories from the requested change and integrated context brief.
For selected categories, gather exact local sources and the current contract before
making a recommendation. Record excluded categories with a scope reason. Do not
bulk-load private documentation merely to mark unrelated questions inapplicable.

## Navigation hints

These paths are lookup hints from the original profile, not assertions that their
contents or conventions are current. Check that they exist in the reviewed revision
and read only what is relevant:

| Area | Paths to inspect |
| --- | --- |
| Shared UI | `packages/ui`, `apps/scout/src/client/components` |
| Compute | `apps/scout/src/client/hooks/compute`, `docs/arrow.md` |
| Agent tools | `apps/nominal-mcp` |
| Generated-code CI | `.github/workflows/build.yml` |

Derive API names, behaviour, ownership and migration state from the authorised
checkout. Do not copy the resulting internal context back into this skill.

## Domain ownership and design

- [ ] Locate the owner of affected types, operations and persisted invariants.
- [ ] Compare existing supported APIs with any duplicated consumer implementation.
- [ ] Check whether reusable domain operations require mounted UI unnecessarily.
- [ ] Trace the contract between reusable features and the host that embeds them.
- [ ] Assess simpler interactions that preserve the supported user task while removing
  state, branching or synchronisation.
- [ ] For migrations, establish current adoption, agreed intermediate states and
  representative persisted fixtures. Check repeated loading preserves intended state.

## UI and resources

- [ ] Discover existing components, variants, hooks and their actual defining packages.
- [ ] Check preserved defaults, consumer overrides, error recovery and resource states.
- [ ] Inspect local conventions for copy, locale/timezone, accessibility and feature flags.
- [ ] Verify supported flag states and relevant exported-component examples or stories.
- [ ] Compare the cost of deep comparisons with the work they avoid.

## API and backend boundaries

- [ ] Inspect shared type ownership, exported declarations, validation, authorisation
  and adopted middleware at the changed boundary.
- [ ] Trace where queries and data assembly belong; assess redundant pass-through
  layers against supported alternatives in the reviewed revision.
- [ ] Check pagination, eager fetching, large-payload delivery and request frequency.
- [ ] For agent tools, establish batch contracts, per-item outcomes, downstream fan-out,
  enforced input/output budgets and any locally documented execution alternatives.

## Compute and subscriptions

- [ ] Locate current subscription APIs and owners before adding another mechanism.
- [ ] Check identity stability, narrowly scoped dependencies, streaming inputs and cleanup.
- [ ] Read local data-format contracts before interpreting raw or cached data.
- [ ] Cover relevant empty, sparse, high-frequency and disconnected cases.
- [ ] For claimed performance gains, seek comparable baseline evidence and an appropriate
  runtime metric; distinguish measured results from proposals.
- [ ] Check repeated notifications and warnings remain useful to users.

## State effects and history

- [ ] Inspect the actual state wrapper and scheduler APIs; generic library guidance
  does not establish project-wrapper behaviour.
- [ ] Verify effect ownership, observation scope and disposal of owned versus borrowed resources.
- [ ] Establish which history mechanism is active for the changed consumer and whether
  registration/startup covers the durable state being edited.
- [ ] Check undo/redo and persistence through the affected user operation. Do not infer
  completed migration from API availability or constructor wiring alone.

## Tests and build

- [ ] Exercise changed store, domain-client and utility behaviour at the owning public boundary.
- [ ] Use valid fixtures, deterministic reactive timing and owned-resource cleanup.
- [ ] Inspect the current network/provider harness before claiming a mock proves a real boundary.
- [ ] Verify test discovery and placement in the selected test project.
- [ ] Keep UI tests focused on meaningful UI contracts rather than duplicating domain tests.
- [ ] For code generation changes, inspect the actual CI workflow for stale-output detection.
- [ ] Record available scoped checks and exact-head CI separately from behavioural conclusions.
