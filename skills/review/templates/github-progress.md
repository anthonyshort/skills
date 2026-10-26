# Live PR comment

The helper renders the linked commit header, Status, Result and Full report fold. Supply the progress checklist and assessment-first summary. The helper inserts Next steps after the assessment folds, before findings or other trailing sections. The seven approval checks stay inside Full report.

## Checklist input

```markdown
- [x] Set up and assess scope
- [ ] <img src="https://cdnjs.cloudflare.com/ajax/libs/lightbox2/2.11.5/images/loading.gif" width="16" height="16" alt=""> Gather context — in progress
- [ ] Review product, design and correctness
- [ ] Check review rules
- [ ] Verify findings and write report
- [ ] Publish results and inline findings
```

Adapt the stages to the actual work. Split-only reviews need only setup, a split plan and publication. Mark skipped or blocked work explicitly. Supply the final checklist to `finish --checklist`. The helper leaves publication unchecked in its intermediate update and publishes the final checklist after successful writes.

Use the spinner beside each active item, keeping both dimensions at 16 pixels to match GitHub’s body text. Retain the “in progress” label so status is clear without animation. Remove the image when the item completes, is skipped or becomes blocked. The final checklist has no spinners.

## Final summary input

Start with a compact assessment, followed by two collapsed folds. Derive conclusions and counts from the canonical report, rather than introducing new claims during publication.

- **Overall:** Say whether the solution addresses the original problem and whether the approach is sound. Explain material uncertainty. Include the number of new bugs and distinguish unresolved existing concerns.
- **Risk:** Low, medium or high production risk, with one sentence explaining exposure, consequences and important verification gaps. Say when evidence is insufficient to assess it.
- **Rules:** Count satisfied rules, concerns, unverified rules and skipped rules across all supplied collections. Separately count selected rules found not applicable when present. Name rules with concerns and briefly explain why, using finding IDs where relevant. Only say all applicable rules passed when each was checked and satisfied. Skipped and unverified rules do not pass. A source check does not establish runtime verification.

Keep each visible answer to one or two short sentences. Include these folds even when there are no bugs:

- **Research sources:** Link inspected sources with descriptive titles and say what each establishes. Identify validated reused evidence. Distinguish unavailable sources, searches with no relevant results and unopened leads. Summarise large source sets and retain the complete list in Full report.
- **Approach and alternatives:** Explain problem fit, architectural fit and simplicity in a short paragraph or a few bullets. Include worthwhile alternatives and their trade-offs, or state that no supported alternative was found. Separate required changes from optional improvements. Do not invent alternatives to fill the section.

Then add `#### Findings` grouped under `##### P0`, `##### P1` and `##### P2`. Omit empty groups. Include only supported defects in priority groups. Optional opportunities, questions and nits may follow separately without invented severity. Do not repeat alternatives already explained in the approach fold.

Do not supply Next steps: the helper inserts them before the first heading outside folds and code fences, or after the complete input if there is no such heading. Keep the assessment labels as bullets, with headings only inside its folds or for trailing sections. Use blank lines between Markdown blocks and standalone details tags. Do not add an Approval heading, repeat the reviewed commit or display the seven-check approval table outside Full report.

Illustrative input, not a current review result:

````markdown
- **Overall:** This addresses the empty-settings-page problem using the existing permission checks. The approach fits the current ownership model. No new bugs or unresolved existing concerns were found.
- **Risk:** Low. Only empty-page visibility changes, and the existing permission boundary remains in place.
- **Rules:** 6 satisfied, 0 concerns, 0 unverified, 12 skipped as outside scope.

<details>
<summary>Research sources</summary>

- [Settings issue](issue-link): Defines which empty pages administrators should see.
- [Existing permission check](pinned-source-link): Establishes the access boundary used by both pages.
- Notion was unavailable. The Slack search found no relevant discussion.

</details>

<details>
<summary>Approach and alternatives</summary>

The existing permission check solves the stated problem without introducing another owner for access decisions. No supported simpler alternative was found.

</details>
````

For actionable findings, update Overall and Rules to reflect the concerns, then append:

```markdown
#### Findings

##### P2

- **F1 — Keep tooltips reachable:** The card link intercepts title hover. [Already reported](existing-thread-link).
```

Use the report’s priority definitions. Preserve finding IDs across summary, full report and inline comments. Link still-actionable existing concerns instead of presenting them as new. Keep each bullet concise but explain the consequence or benefit. Explicitly state when no supported bugs were found.

Explain human-review recommendations and actionable CI blockers in plain English when they change the recommendation. Keep wrapper names, publication mechanics, general CI rollups and detailed audit coverage in Full report. Missing evidence is not itself a prioritised defect.

For split-only reviews, use the same compact layout with the supported scope assessment, sources and split rationale. State that implementation and rule review were deferred. Do not invent rule counts, implementation findings or an assessed approval checklist.

## Rendered layout

```markdown
🤖 Reviewed {linked short commit}

---

### Status

{{ Checklist }}

---

### Result

{{ Overall verdict, risk and rule summary }}

<details>
<summary>Research sources</summary>

{{ Sources and relevant access or coverage limits }}

</details>

<details>
<summary>Approach and alternatives</summary>

{{ Problem fit, system fit, simplicity and supported alternatives }}

</details>

#### Next steps

{{ Helper-rendered actions from the structured decision }}

#### Findings

{{ Supported findings grouped under P0, P1 and P2 }}

---

<details>
<summary>Full report</summary>

{{ Helper-rendered seven approval checks and complete canonical report }}

</details>
```

This is rendered output, not summary input. Omit empty Next steps or Findings sections. Pass the report file to the helper. The helper links labelled continuations if it cannot fit the report into one comment.
