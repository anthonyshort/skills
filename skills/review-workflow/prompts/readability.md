# Readability assessment

Perform the dedicated readability pass over changed bodies and tests. Keep correctness and architectural redesign with their own assessments.

Run a dedicated readability pass using [code-readability](../best-practices/code-readability/SKILL.md), including its example when assessing extraction, and the [extraction rule](rules/extract-decisions-only-when-useful.md) where relevant. Focus on how quickly someone can understand, read and scan the code, including tests. Keep architectural redesign and correctness investigations with their respective agents.

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

Include inspected files and bodies, individual check results and coverage gaps. The writer saves the accepted result as `readability.md` in the review artefact directory.
