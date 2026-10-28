---
name: review-system-fit
description: Assess a code change against architectural ownership, dependency boundaries and supported direction, and return an evidence-backed system fit assessment.
---

# Review system fit

Read the [shared review rules](../review/SKILL.md#rules) and apply those constraints without running the other review steps. Read the [assessment method](../review/SKILL.md#assessment-method) before inspecting the change.

Use the supplied repository, pinned revisions, full diff, research, initial risks and CI evidence. Inspect descriptions in [best-practices](../best-practices/) and any caller-supplied specialist collections, then select the guidance relevant to this assessment. Validate supplied context and record missing requirements or evidence instead of assuming it is complete. Return this assessment without publishing, changing source or starting the full review.

This is looking at the change in relation to the architecture of the codebase as a whole. We want to confirm that this change aligns with the future direction and current best practices in the code.

You should use skills and reference files to help understand what you look for.

Some things you should look for:

- Does this change adhere to the latest best practices and patterns?
- Is there a change we could make to this to fit into established patterns?
- Is this duplicating some existing logic
- Is there any unnecessary tight coupling? Could we decouple things using common patterns like an adapter pattern, plugin pattern, event emitters, or dependency injection?

- **Look for consolidation opportunities**: Compare similar implementations for shared behaviour that could have one owner and implementation. Explain what duplication would disappear and whether sharing the code would introduce unwanted coupling. Similarity alone is not a reason to merge implementations.
- **Dependency direction**: Check that imports respect ownership and system boundaries. Look for cycles and dependencies that tie unrelated parts of the system together.
- **Prevent similar bugs**: Look for architectural changes that could prevent a class of bugs. Explain the benefit and cost separately from the immediate fix.

## Verification checklist

- [ ] **Dependency direction**: Check imports against system boundaries and identify cycles or unclear ownership.
- [ ] **Bug prevention**: Assess whether a supported architectural change could prevent similar bugs. State when no such change is supported.
- [ ] **System fit**: Assess ownership, dependency boundaries and consistency with established patterns, citing comparable implementations.
- [ ] **Reuse and coupling**: Identify duplicated behaviour, misplaced responsibilities or unnecessary coupling, with concrete consequences.
- [ ] **Direction**: Assess alignment with documented architectural direction and migration state; distinguish this from personal preference.
- [ ] **Recommendations**: Describe supported changes, affected consumers and migration cost; separate PR-scoped improvements from broader opportunities.

## Deliverable

Return a **system fit assessment** containing:

1. **Verdict**: Fits the existing system, fits with changes, or conflicts with the system, with a short rationale.
2. **Ownership and dependencies**: Where the changed behaviour belongs, which consumers and boundaries it affects, and comparable implementations with source locations.
3. **Conventions and direction**: Alignment or conflicts with established patterns and documented direction, clearly separated from preferences.
4. **Recommended changes**: Concrete changes addressing duplication, coupling or misplaced responsibilities, with affected consumers, migration cost and a feasible first step. Label each as a PR-scoped improvement or broader opportunity; explicitly state when no changes are supported.
