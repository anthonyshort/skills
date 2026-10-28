---
name: review-readability
description: Review changed source and tests for reading difficulty and maintainability, and return a readability assessment with body-level evidence and concrete improvements.
---

# Review readability

Read the [shared review rules](../review/SKILL.md#rules) and apply those constraints without running the other review steps. Read the [assessment method](../review/references/assessment-method.md) before inspecting the change.

Use the supplied repository, pinned revisions, full diff, research, initial risks and CI evidence. Inspect descriptions in [best-practices](../best-practices/) and any caller-supplied specialist collections, then select the guidance relevant to this assessment. Validate supplied context and record missing requirements or evidence instead of assuming it is complete. Return this assessment without publishing, changing source or starting the full review.

Run a dedicated readability pass using [code-readability](../best-practices/code-readability/SKILL.md), including its example when assessing extraction, and the [extraction rule](../review/rules/extract-decisions-only-when-useful.md) where relevant. Focus on how quickly someone can understand, read and scan the code, including tests. Keep architectural redesign and correctness investigations with their respective agents.

## Verification checklist

- [ ] **Reading pass**: Read changed bodies and surrounding code, not just declarations or the diff. Apply each relevant readability check and record evidence or an exclusion reason.
- [ ] **Concrete improvements**: Identify the reading difficulty, location and a specific alternative. For extractions, name the operations and explain what a reader no longer has to track.
- [ ] **Assessment evidence**: Support a positive verdict with evidence from inspected bodies. Clear names, one feature, correct branches and passing tests do not establish cohesion. Report supported readability problems even without a runtime bug. Separate substantive improvements, conventions and optional polish.

## Deliverable

Return a **readability assessment** containing:

1. **Verdict**: Clear and easy to maintain, or improvements recommended, with a short reason.
2. **Names and placement**: Explain any unclear names, misplaced files or folder structures that hide ownership. Include source locations and concrete alternatives.
3. **Readability and style**: Identify code, comments or formatting that make the change harder to understand. Distinguish broken conventions from preferences.
4. **Recommended changes**: Explain what each change would make clearer or simpler. For proposed extractions, name the operations and the complexity they remove. Support a no-improvements conclusion with concrete evidence.

Include inspected files and bodies, individual check results and coverage gaps. The caller saves this as `readability.md` in the review artefact directory.
