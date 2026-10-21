# Behaviour, design and build checks

Use only the assigned categories. The coordinator assigns a primary owner for each check; loading this file does not assign every category to every worker. For design opportunities, also apply the selected design-review guidance.

## Checklist

**Behaviour and contracts**

- [ ] **Expected behaviour** - Establish expected outputs, side effects, and invariants from requirements and domain contracts.
- [ ] **Logic correctness** - Compare actual execution with expected behaviour for representative inputs and state transitions.
- [ ] **Counterexamples** - Try relevant boundary cases that could disprove the implementation.
- [ ] **Preserved behaviour** - Compare supported cases before and after the change for unintended regressions.
- [ ] **Production paths** - Trace changes through production callers and consumers.
- [ ] **Root cause** - Check bug fixes repair the owning layer rather than mask a symptom.
- [ ] **Contract assumptions** - Check helper guarantees beyond current callers and data.
- [ ] **Dependency wiring** - Look for missing inputs that compile but fail at runtime.
- [ ] **Failure paths** - Trace propagation, recovery, and user-visible failures.
- [ ] **UI behaviour** - Check changed interactions and feature-flag states.
- [ ] **Logic tests** - Check changed store, application-client and utility behaviour has meaningful tests at its owning layer.
- [ ] **Test correctness** - Verify test expectations against intended behaviour independently of the implementation.
- [ ] **Focused checks** - Inspect tests, run practical checks, and record results.
- [ ] **Unrelated changes** - Identify work that should be reviewed separately.

**Design and ownership**

- [ ] **Ownership** - Identify owners of changed state, rules, and contracts.
- [ ] **Folders and names** - Check the layout makes responsibilities and owners clear.
- [ ] **Dependency direction** - Check imports respect established boundaries.
- [ ] **Existing solutions** - Compare shared APIs before accepting duplication or new abstractions.
- [ ] **Safe simplification** - Preserve required behaviour and isolation.
- [ ] **Design intent** - Compare the design with the stated goal and supplied direction.
- [ ] **Comment style** - Prefer multi-line JSDoc and // comments where supported.

**Build and CI**

- [ ] **Dependency paths** - Resolve dependencies without machine-specific absolute paths.
- [ ] **Configuration sources** - Derive configuration from package or generated metadata.
- [ ] **Package conventions** - Check new packages use standard compiler and lint configuration.
- [ ] **CI scale** - Compare repository-wide CI work and runtime with the project's CI budget.
- [ ] **Test discovery** - Verify new tests actually run in CI.
- [ ] **Generated artifacts** - Verify CI checks changed generated output is up to date.

## Guidance

### Behaviour and contracts

- Establish the behaviour to preserve before proposing design alternatives. Independent concern agents may work in parallel after the integrated context gate. Establish expected outputs, side effects, and invariants from requirements and domain contracts; label assumptions and report missing intent rather than treating current code or tests as authoritative.
- Work through representative inputs and state transitions, comparing the actual result with the independently established expectation. Inspect predicates, branches, loop bounds and termination, ordering, filtering, aggregation, and updates where relevant; successful execution and type safety do not prove the result is correct.
- Try counterexamples selected from the changed logic: empty or single inputs, equality at thresholds, zero versus missing values, duplicates, reordered inputs, and units or precision. Use relevant cases rather than an exhaustive checklist. Compare supported cases before and after the change, including behaviour intended to remain unchanged.
- Review the correctness of tests as well as the implementation. Apply [testing guidance](../../testing-best-practices/SKILL.md) to independently verify expected values, fixtures, and mocks; passing tests can encode the same mistaken assumption as the code.
- For bug fixes, trace the root cause to its owning layer. Recommend moving the fix there when a local patch only hides the symptom, including an upstream service when appropriate.
- Check helpers enforce relationships between their inputs; current caller habits, resolution, or data are not contract guarantees. Load TypeScript guidance for composed bounds, semantic boundaries, and actual data extent.
- Trace changed paths through production callers, failures, and tests. Verify supported consumer behaviour rather than relying on isolated tests.
- For UI changes, check interactions and feature flags; include reproduction steps and screenshots when available.
- Apply [testing guidance](../../testing-best-practices/SKILL.md) to require meaningful coverage for changed store, application-client and utility behaviour. Prefer tests at the owning logic layer; request React tests only for a concrete UI-specific risk those tests cannot catch.
- Run focused checks where practical and report actual results. Identify unrelated changes separately.

### Design and ownership

- Assess the whole design after establishing intent. Count added or removed concepts, not just files or lines. Check the design meets its goal and preserves behaviour and isolation. Look for simpler interactions.
- Load [architecture](../../architecture-best-practices/SKILL.md) for new layers, moved ownership, changed dependencies, abstractions, or reuse. Trace consumers, coupling, migration cost, and supplied RFC direction.
- Future direction is not a blocker without a current consequence.
- Use architecture guidance to assess folders and names. Treat alternate layouts as preferences unless they breach a boundary or cause a concrete maintenance problem.
- Prefer multi-line JSDoc and // short comments where supported; use [TypeScript comment guidance](../../typescript-best-practices/SKILL.md#comments). Formatting is non-blocking unless the project requires it.

#### Design discussion

Use when a choice needs the user's judgement.

- State the decision, alternatives, consequence, and recommendation. Use project terms and clarify ambiguous wording.
- Separate choices needing input from confirmed findings. Ask one dependent question at a time; resolve earlier decisions first.
- Test proposals against current code, actual usage, and edge cases. Record agreed decisions and open questions; continue independent review work.
- Suggest guidance updates separately; do not edit shared skills during discussion.

### Build and CI

- Use supported module resolution, such as the ESM equivalent of `require.resolve`, rather than absolute paths to another package.
- Derive configuration from authoritative metadata before adding special cases. Check new packages use the repository's standard `tsconfig` and lint rules; flag unjustified overrides.
- For repository-wide CI changes, identify files or packages visited, invocation frequency, and repeated scans. Compare measured runtime and growth with the project's CI budget. If no budget exists, report observed cost and the assumption; linear growth alone is not a failure.
- Trace new tests through CI selection and execution; a locally passing test is not proof CI runs it. Check generation jobs detect stale or missing generated output.
