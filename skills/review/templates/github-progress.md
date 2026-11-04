# Live PR comment

The helper renders the linked commit header, Status, Result and Full report fold. Supply the progress checklist and assessment-first result. Keep author actions and the evidence needed to understand them outside folds. The helper inserts Next steps after the assessment folds, before findings or other trailing sections. The seven approval checks stay inside Full report.

## Checklist input

```markdown
- [x] Set up and assess scope
- [ ] <img src="https://cdnjs.cloudflare.com/ajax/libs/lightbox2/2.11.5/images/loading.gif" width="16" height="16" alt=""> Gather context — in progress
- [ ] Review product, design and correctness
- [ ] Review readability in a dedicated pass
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
- **Rules:** Count satisfied rules, concerns, unverified rules and skipped rules across all supplied collections. Separately count selected rules found not applicable when present. Identify concern rules and connect them to concrete actions using finding IDs or existing thread links. Group rules supporting the same action rather than repeating the action. Explain actionable unverified checks and what remains to verify. Counts alone, or labels such as “API concerns”, are insufficient. A longer mapping may follow in a visible section. Only say all applicable rules passed when each was checked and satisfied. Skipped and unverified rules do not pass. A source check does not establish runtime verification.

Keep these opening assessment bullets compact. Do not impose that length limit on findings or recommendations when evidence or a suggested change needs more explanation. Include these supporting folds even when there are no bugs:

- **Research sources:** Link inspected sources with descriptive titles and say what each establishes. Identify validated reused evidence. Distinguish unavailable sources, searches with no relevant results and unopened leads. Summarise large source sets and retain the complete list in Full report.
- **Approach and alternatives:** Explain problem fit, architectural fit and simplicity in a short paragraph or a few bullets. Include worthwhile alternatives and their trade-offs, or state that no supported alternative was found. Separate required changes from optional improvements. Do not invent alternatives to fill the section.

Then add `#### Findings` grouped under `##### P0`, `##### P1` and `##### P2`. Omit empty groups. Include only supported defects in priority groups. Include substantive non-bug recommendations, decisions and worthwhile nits in separate visible sections, including when there are no bugs. Mark required changes, recommendations, optional work and unresolved choices clearly. Supporting rationale can stay in the approach fold, but each proposed action must remain visible.

### Preserve author-facing detail

- **Self-contained findings:** Give a pinned location, the relevant trigger or input, enough source evidence to establish the problem, its consequence and a concrete suggested change. Use short current/proposed snippets when they make a bug, API change or extraction understandable. Label proposed code. A title, consequence and “see Full report” link do not supply the evidence or change the author needs.
- **Non-bug actions:** Carry forward actionable product, architecture, simplicity, readability and rule recommendations. Explain what becomes clearer or safer and the practical next change. Keep meaningful alternatives and their trade-offs visible when the author must choose. Do not turn them into prioritised bugs.
- **Existing concerns:** Link each still-actionable thread alongside its recommendation. “Eight existing comments were assessed” does not tell the author what remains. Linking a concern replaces a duplicate inline comment, not its explanation in the result.
- **Coverage before brevity:** Compare the visible result with Findings, design opportunities, decisions and verification actions in the canonical report. Every distinct substantive action must survive, possibly grouped with an overlapping finding. Explain rule concerns through those entries. Concrete helper-rendered Next steps may cover an action, but generic instructions to address comments or read the report do not.
- **Fold supporting detail:** Keep long traces, complete rule/check matrices, background research and routine successful checks folded. Shorten repetition and wording before removing the essential evidence, code example, recommendation or uncertainty.

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

For a non-bug API recommendation, retain the reason and a useful proposed call rather than only its title. For example, adapt this illustrative shape to the actual reviewed code:

````markdown
#### Recommendations and decisions

- **R1 — Pass the identity directly (recommended):** The caller already has the repository and PR number. Converting them to a URL and parsing it again obscures the input contract. [Existing discussion](existing-thread-link). Coordinate both callers if changing this API.

  ```ts
  // Current caller
  await source.resolve(job.url, signal);
  // Proposed caller
  await source.resolve({ repository: job.repository, number: job.number }, signal);
  ```

- **D1 — Choose the report contract (decision needed):** Decide whether every configured workflow must return a report. A single schema option may suffice if they all do. Keep optional results only where a supported caller needs them.

- **V1 — Complete the missing verification:** Investigate the failed smoke step and obtain results for the later groups it prevented from running. This is a verification gap, not another source bug.
````

Only include such entries when supported by the report. Use the same level of concrete evidence and proposed code for bugs when needed. Inline findings should also be actionable on their own, without reproducing the entire report.

Explain human-review recommendations and actionable CI blockers in plain English when they change the recommendation. Separate required bug regressions from optional coverage improvements. Keep wrapper names, publication mechanics, general CI rollups and detailed audit coverage in Full report. Missing evidence is not itself a prioritised defect.

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

{{ Supported defects grouped under P0, P1 and P2, with essential evidence and useful proposed snippets }}

#### Recommendations and decisions

{{ Substantive non-bug actions, existing thread links, alternatives and concrete proposed changes. Omit empty sections. }}

---

<details>
<summary>Full report</summary>

{{ Helper-rendered seven approval checks and complete canonical report }}

</details>
```

This is rendered output, not summary input. Omit empty Next steps or Findings sections. Pass the report file to the helper. The helper links labelled continuations if it cannot fit the report into one comment.
