### Step 5: Create the final review report

The parent agent combines the research report, all Step 3 assessments and the Step 4 rule assessment into one final review report.

#### Consolidate the evidence

1. **Read the inputs**: Read the research report, every Step 3 assessment and the Step 4 rule assessment. Wait for agents that are still working. Note any failed or missing assessments.
2. **Check the agents' claims**: Check the code, requirements and CI evidence. Compare checklists with their guidance. Follow up on missing checks or weak evidence. Refresh CI status before writing.
3. **Merge duplicate findings**: Combine findings about the same issue. Keep the evidence and any different effects. Link issues already raised in PR comments instead of drafting duplicate comments.
   - Check readability coverage explicitly. Keep useful readability improvements visible even when no bugs are found. Merge overlaps with simplicity, system fit and extraction rules without losing the reading difficulty or concrete recommendation. Missing readability assessment or body-level evidence is a coverage gap.
4. **Resolve disagreements**: Use evidence to decide between conflicting conclusions. If you cannot resolve a disagreement, record it as an open question or a gap in the review.
5. **Reach an overall conclusion**: Explain whether the change meets its goal, fits the system and works. Revisit the production risk level and coverage gaps. Summarise rule results from the complete coverage table, keeping concerns, unverified checks and skipped rules distinct from satisfied rules. Recommend keeping, simplifying or splitting it and explain supported alternatives. Separate fixes from optional work.

Continue with [reporting](reporting.md) after reaching an evidence-backed conclusion.
