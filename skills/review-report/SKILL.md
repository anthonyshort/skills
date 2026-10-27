---
name: review-report
description: Combine review assessments, rule results and research into one evidence-backed review report. Part of the review workflow.
---

# Review report

Combine the research brief, the question assessments and the rule assessment into one final review report. Follow [the review constraints](../review/references/constraints.md).

## Inputs

- The review artefact directory, containing `risk.md`, `research.md`, the question assessments and `rules.md`.
- The repository, base and head revisions, and CI evidence.

## Rules for a good report

- **Use short sentences and lists**: Do not join clauses with semicolons. Use separate sentences for related thoughts and lists for multiple points, conditions or results.
- **Explain it like a colleague:** Say what happens, why it matters and what should change. Use code names only when they help locate or explain the issue. Put detailed traces in evidence folds.
- Lead with a short assessment and findings table. Put detailed evidence and coverage in foldable sections.
- Label findings as new or already reported. Link existing PR threads.
- Separate source checks, CI results and manual checks. Keep gaps visible.

- The report must make sense without opening the worker reports.
- Include the research, evidence and conclusions needed to understand the review.
- Do not just copy findings from the subagent reports. Use their evidence to reach your own conclusions.
- Back up important claims with code locations, requirements or check results.
- Separate bugs, existing conventions, personal preferences and open questions.
- Keep wider improvements separate from required fixes. A possible future change is not a reason to block the PR.
- Say what is uncertain and what was not checked. Missing evidence does not mean a check passed.
- Do not invent findings or praise to fill the template. Remove empty finding sections.

## Create the report

1. **Read the inputs**: Read the risk assessment, research brief, every question assessment and the rule assessment. Wait for agents that are still working. Note any failed or missing assessments.
2. **Check the agents' claims**: Check the code, requirements and CI evidence. Compare checklists with their guidance. Follow up on missing checks or weak evidence. Refresh CI status before writing.
3. **Merge duplicate findings**: Combine findings about the same issue. Keep the evidence and any different effects. Link issues already raised in PR comments instead of drafting duplicate comments.
4. **Resolve disagreements**: Use evidence to decide between conflicting conclusions. If you cannot resolve a disagreement, record it as an open question or a gap in the review.
5. **Reach an overall conclusion**: Explain whether the change meets its goal, fits the system and works. Revisit the production risk level and coverage gaps. Summarise rule results from the complete coverage table, keeping concerns, unverified checks and skipped rules distinct from satisfied rules. Recommend keeping, simplifying or splitting it and explain supported alternatives. Separate fixes from optional work.
6. **Write the report**: Use [the review report template](templates/review-report.md). Save the report to `<review artefact directory>/review-report.md` and return its path.
7. **Reduce prose**: Ask an editorial subagent to shorten the completed report. Preserve findings, evidence, tables, counts, individual check outcomes and uncertainty. Do not introduce conclusions or change priorities. The parent compares the edit with the original, restores lost detail and saves the accepted version as the canonical report.

## Deliverable

One completed `review-report.md` file saved in the review artefact directory. Fill in the [review report template](templates/review-report.md) and return the file path.

## This step is complete when:

- [ ] All review inputs are included or noted as missing.
- [ ] Important claims have been checked. Duplicate findings are merged. Disagreements are resolved or recorded as open questions.
- [ ] The report gives the parent's conclusions instead of joining worker reports together.
- [ ] The initial risks have been revisited using the completed review. The scope recommendation is supported by evidence.
- [ ] The report contains enough background and evidence to make sense on its own, including what was not verified.
- [ ] Every selected check has a result. All template placeholders are filled in or removed with their optional sections.
- [ ] The report is saved and its path is returned to the user.
