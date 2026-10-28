---
name: review-simplicity
description: Assess a code change for unnecessary complexity and useful scope boundaries, and return concrete simplifications and a keep-together or split recommendation.
---

# Review simplicity

Read the [shared review rules](../review/SKILL.md#rules) and apply those constraints without running the other review steps. Read the [assessment method](../review/references/assessment-method.md) before inspecting the change.

Use the supplied repository, pinned revisions, full diff, research, initial risks and CI evidence. Inspect descriptions in [best-practices](../best-practices/) and any caller-supplied specialist collections, then select the guidance relevant to this assessment. Validate supplied context and record missing requirements or evidence instead of assuming it is complete. Return this assessment without publishing, changing source or starting the full review.

Assess whether the implementation and PR scope are reasonably small and easy to reason about. Use the risk assessment and research to decide whether simplifying or splitting would make the change easier to understand and verify.

Size alone does not establish risk. Keep justified complexity and changes that are easier to review together.

Some things to look for:

- Are there unnecessary tests, comments, or code formatting changes?
- Can we leverage existing functions, types, or other code instead of reinventing the wheel (when the cost of reuse is also low)
- Is there a library we could use instead of rolling it ourselves?
- Is this PR trying to do too much at once? Should it be split up?

## Verification checklist

- [ ] **Complexity assessment**: Count concepts, not just lines. Consider the responsibilities, abstractions and dependencies introduced by the change. Identify unnecessary complexity and explain its cost.
- [ ] **Unused code**: Identify code and exports made obsolete by the change. Check consumers before recommending removal.
- [ ] **Simplifications**: Propose concrete removals or substitutions, showing how they preserve the required behaviour.
- [ ] **Scope assessment**: Recommend keeping the PR together, simplifying it or splitting it. Explain how this affects understandability, isolation, complexity, testability and blast radius. Identify useful boundaries when splitting would help.
- [ ] **Recommendation**: State whether the implementation is reasonably minimal, including any complexity justified by the requirements.

Use [split-pr](../split-pr/SKILL.md) when a detailed slicing plan would help. During review, propose the plan without changing code or branches. Either a small end-to-end slice or a group of low-risk preparation changes can be a useful PR.

## Deliverable

Return a **simplicity assessment** containing:

1. **Verdict**: Reasonably minimal or simplification recommended, with a short rationale.
2. **Proposed simplifications**: For each, identify the current code, the removal or substitution, the complexity removed and how required behaviour is preserved. Explicitly state when no supported simplifications were found.
3. **Justified complexity**: Any complexity that should remain because of a concrete requirement or constraint.
4. **PR scope**: Keep together, simplify or split, with a rationale. If splitting is recommended, name the independently reviewable changes, their dependencies and a viable order.
