---
name: review-product
description: Assess whether a code change solves the intended user problem, compare supported alternatives and return an evidence-backed product assessment.
---

# Review product fit

Read the [shared review rules](../review/SKILL.md#rules) and apply those constraints without running the other review steps. Read the [assessment method](../review/references/assessment-method.md) before inspecting the change.

Use the supplied repository, pinned revisions, full diff, research, initial risks and CI evidence. Inspect descriptions in [best-practices](../best-practices/) and any caller-supplied specialist collections, then select the guidance relevant to this assessment. Validate supplied context and record missing requirements or evidence instead of assuming it is complete. Return this assessment without publishing, changing source or starting the full review.

We want to think if there is a better, simpler solution to the problem that allows users to perform this task. This is why we require the research to be completed first.

- Does this change solve the original problem?
- If this is an interaction change, is there a simpler way we could solve this? For example, rather than building some complex drag-and-drop system for a lesser used feature, this could just be a menu item.
- Does this change conflict with any requirements discovered from the research?
- Does this change conflict with any existing PRs or ongoing work?

## Verification checklist

- [ ] **Problem fit**: Assess whether the change solves the original problem and satisfies the requirements established by research.
- [ ] **Alternatives**: Identify a simpler way to meet the same user need, explain the trade-offs, or state that no supported alternative was found.
- [ ] **Conflicts**: Identify conflicts with requirements or ongoing work, with sources; state any gaps in visibility.
- [ ] **Recommendation**: Recommend proceeding, adjusting the approach, or reconsidering it, with supporting evidence.

## Deliverable

Return a **product assessment** containing:

1. **Verdict**: Proceed, adjust the approach, or reconsider, with a short rationale.
2. **Problem and requirements**: The user need, relevant requirements and sources, and whether the change meets them.
3. **Alternatives and conflicts**: Supported alternatives with trade-offs, and conflicts with requirements or ongoing work. Explicitly state when none were found or evidence is missing.
4. **Recommended action**: Any concrete change to the approach, including the behaviour that must be preserved.
