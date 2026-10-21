# Review output

Coordinator only: load at synthesis, not in research or concern workers. A supplied profile may replace the report layout, but not evidence, severity or publishing boundaries. Use [finding severity](finding-severity.md) and the selected profile output reference, or the [generic template](../assets/review-report.md).

## Checklist

**Findings and delivery**

- [ ] **Finding evidence** - Verify each trigger and consequence against the code.
- [ ] **Finding type** - Separate defects, conventions, preferences, direction, and open questions.
- [ ] **Severity** - Use impact and likelihood supported by evidence.
- [ ] **Duplicate findings** - Merge overlaps and omit issues already flagged in PR comments.
- [ ] **Coverage gaps** - Wait for delegates and report missing or unverified checks.
- [ ] **Actionable findings** - Include locations, recommendations, and useful snippets.
- [ ] **Review summary** - Rank issues by severity; separate aesthetic nits and verification limits.
- [ ] **Read-only scope** - Keep the review read-only unless edits are requested.
- [ ] **Inline comment drafts** - Include file-anchored drafts containing the reviewed commit, diff side and lines, code excerpt, and exact comment text.
- [ ] **Checklist coverage report** - Put checklist coverage at the top of saved reports with all selected checklist items accounted for; check verified satisfactory items and collapse fully satisfactory categories.
- [ ] **GitHub voice** - Apply writing-voice to every GitHub review body and comment before staging or posting.
- [ ] **Publishing** - Stage or publish comments only when requested.

## Guidance

### Findings and delivery

- Keep the system assessment and combined conclusions with the main agent. Wait for delegates, verify their evidence, resolve conflicts, merge overlaps, and report missing coverage.
- State each finding's location, trigger, consequence, and recommendation; include a code suggestion when useful. For UI bugs, give the clicks needed to reproduce them. Omit issues already flagged in PR comments.
- Distinguish defects, conventions, future direction, preferences, and open questions. Support design suggestions with an existing implementation or a demonstrated simplification.
- Apply the selected voice without changing evidence or severity. Use [the report template](../assets/review-report.md) for saved reviews; omit empty sections and filler. A clean review may have no findings.
- Keep code, reviewed documents, and shared skills unchanged unless edits are requested. Stage or publish only when requested.

### Four-level assessment and wider opportunities

Assess product, direction, design and correctness separately, with source evidence and explicit unknown/N/A reasons. A clean review can conclude that no supported redesign was found. Put useful product alternatives and wider architectural proposals in **Design and direction opportunities**, separate from confirmed defects and aesthetic nits. Include the problem, proposed alternative, consumer example when relevant, preserved behaviour, migration cost and a feasible first step. Scope is separate from severity; future direction alone is not a blocker. Keep proposals outside the diff in the report rather than inventing inline anchors.

#### Inline comment drafts

- Include an **Inline comment drafts** section near the end of saved review reports, grouped by PR and file. For each proposed comment, include a stable draft ID, PR link, full reviewed head commit, repository-relative file path, diff side (`RIGHT` for new code, `LEFT` for deleted code), and one-based line or line range on that side. For `LEFT` anchors, also record the full diff-base commit used for the reviewed comparison so deleted code can be reconstructed.
- Show a short excerpt from the exact source revision for that side (head for `RIGHT`, diff base for `LEFT`) with the target lines identified, followed by the exact comment body ready for GitHub. Apply [writing-voice](../../writing-voice/SKILL.md), preserving impact and uncertainty; use the GitHub attribution footer below.
- Anchor comments to relevant lines in the reviewed diff. Keep findings that cannot be anchored in the review body rather than inventing a diff location.
- Include only proposed new comments. Link already reported concerns in the assessment; do not turn them into duplicate staging candidates. For a clean review or a PR with only duplicates, state that no new inline comments are proposed.
- Drafts in the report are local proposals. Creating this section does not stage or submit a GitHub review.

#### Checklist coverage report

- Put **Review checklist coverage** at the top of saved review reports, immediately after the title and scope, grouped by PR and selected skill. Account for every item in the generic operational checklist and assigned review-check categories, and every item in selected profile references and other selected skill checklists; record excluded categories with scope reasons rather than reading unrelated references just to mark them N/A; reading a skill is not evidence its checks passed.
- Use `[x]` only when evidence shows the check’s criteria are satisfied. Use `[ ]` with a concise reason for a failure, blocked check or unverified behaviour. State `N/A` and the scope reason separately; do not use checked boxes for inapplicable checks.
- If every applicable item in a category is verified satisfactory, replace its individual items with `[x] {skill name} — {category name}`. Identify any inapplicable items excluded from that category. Expand mixed categories to show each item and its outcome; do not hide a failure or verification gap inside a checked category.
- Keep criteria, evidence and conclusions distinct: a completed investigation can reveal incorrect behaviour. Reference the existing finding or verification evidence rather than repeating it. For multi-PR reports, do not copy one PR’s passing status to another.
- Record the checklist versions used. If guidance changed after the review, identify retrospective evidence and leave unsupported new checks unverified instead of claiming they were completed in the original run.

#### GitHub review

Use only when asked to stage or submit a review.

- Use the requested findings, scope, body, and status. Read current comments before adding duplicates.
- Ask about status if submission is requested but the status is unclear.
- Always load and apply [writing-voice](../../writing-voice/SKILL.md) to GitHub review bodies, inline comments and review replies, including staged drafts. Use Anthony’s voice without changing evidence, uncertainty or severity.
- Keep comments conversational: a short, naturally worded question or request and the concrete consequence. Avoid bot introductions, attribution prefixes, report boilerplate and rule citations unless a policy link helps the author act. Record full evidence and priority in the report.
- End every GitHub review body, inline comment and review reply with exactly one blank line followed by `<sub>Sent with Pi</sub>`, once at the bottom. This footer is scoped to GitHub review output.
- When staging from a report, use the selected draft IDs and exact comment bodies. Recheck the current head, diff anchors and existing comments; if the head changed, verify or update the drafts before staging. Preserve existing pending comments and avoid duplicates.
- Leave staged reviews pending until submission is requested. A request to add inline comments without submitting authorises staging only; do not submit, approve or request changes as part of that action.
- Report the completed action and link the review when available.
