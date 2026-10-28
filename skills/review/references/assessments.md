### Step 3: Code review

After research is complete, delegate each review question using its skill:

| Question | Skill | Saved assessment |
| --- | --- | --- |
| Does this solve the intended user problem? | [review-product](../../review-product/SKILL.md) | `product.md` |
| Does this fit the system and supported direction? | [review-system-fit](../../review-system-fit/SKILL.md) | `system-fit.md` |
| Is this reasonably simple and focused? | [review-simplicity](../../review-simplicity/SKILL.md) | `simplicity.md` |
| Is the changed code clear and maintainable? | [review-readability](../../review-readability/SKILL.md) | `readability.md` |
| Does the implementation work correctly? | [review-correctness](../../review-correctness/SKILL.md) | `correctness.md` |

Each worker returns its named assessment, checklist results, evidence and reasons for N/A or blocked checks. The parent saves the assessments and uses them to create the final report. These are distinct review questions, not exhaustive checklists. Adapt the briefs to the change and investigate other supported risks when needed.

#### Delegate the assessments

- **Give each agent a clear brief**: Supply its skill, scope, repository, exact base and head revisions, full diff, completed research, initial risks, CI evidence and applicable wrapper additions. Pass on the shared no-install and no-local-check rules.
- **Select guidance by relevance**: Ask each worker to inspect available best-practice skill descriptions and caller-supplied specialist collections. Do not impose a fixed technology list. Require the [shared assessment method](assessment-method.md) and a task-specific checklist.
- **Keep context focused**: Give each worker what it needs for its question. Report templates and writing voice belong to the parent.
- **Use parallel work after research**: Independent assessments can run together within the available agent limit. Group work by review question rather than creating an agent for each file or skill.
- **Reserve a readability agent**: Keep readability separate from correctness, architecture and simplicity. Queue it when slots are full. For changes without readable source, retain the assessment and record why its checks are not applicable.
- **Let agents reach their own conclusions**: Describe the question and context without steering workers towards a preferred finding.

#### Check completion and evidence

Require all five assessments. Read every checklist and check coverage against its selected guidance. Follow up on missing checks, weak evidence, unanswered questions and newly discovered risks. Missing information is a coverage gap, not a passing result. Keep source inspection distinct from CI and manual checks.

The parent verifies important claims, resolves or records disagreements and merges overlapping findings during consolidation. Do not merely concatenate worker conclusions. Preserve substantive readability improvements even when no runtime defects were found.
