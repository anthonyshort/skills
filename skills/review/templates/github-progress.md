# Live PR comment

The helper renders the linked commit header, `### Status` and `### Result` sections, full-report fold. It adds horizontal rules after the commit header, status section and result section. The Result section appears when a summary is available. Supply only the checklist and summary content, without these headings or rules. These examples show the content, not a fixed workflow.

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

Use the spinner beside each active item, keeping both dimensions at 16 pixels to match GitHub's body text. Retain the “in progress” label so status is clear without animation. Remove the image when the item completes, is skipped or becomes blocked. The final checklist has no spinners.

## Final summary input

Lead with the verdict and include only findings, opportunities or questions that require an author decision or useful action. If none remain, the entire summary can be:

```markdown
No new bugs found at this commit. No further changes requested.
```

Do not recap resolved concerns, list routine unverified checks or describe what the full-report fold contains. Keep that evidence in the full report. Surface a verification gap here only when it changes the recommendation or requires a concrete action. Explain that consequence instead of adding a generic disclaimer. Missing verification alone is not a defect and must not be assigned a priority just to make it visible.

For actionable findings:

```markdown
The change needs one correction before merging.

#### Findings

##### P1

- **F1 — Preserve saved colours:** Editing a label clears the custom colour. [Evidence](pinned-source-link).

##### P2

- **F2 — Keep tooltips reachable:** The card link intercepts title hover. [Already reported](existing-thread-link).

#### Opportunities

- **F3 — Share renderer bindings:** One owner would remove duplicated callbacks. Optional and PR-scoped.

#### Open questions

- **F4 — Confirm empty-selection behaviour:** The intended outcome is undocumented.

#### Nits

- **F5 — Clarify the callback name:** Use a name that describes the saved value.
```

Use P0, P1 and P2 for supported defects, using the report's priority definitions. Omit empty groups and explicitly state when no supported findings were found. Preserve finding IDs across summary, full report and inline comments. Link still-actionable existing concerns instead of presenting them as new. Keep each bullet concise but explain the consequence or benefit. Put CI details and audit coverage in the full report.

The final comment uses this layout:

```markdown
🤖 Reviewed {linked short commit}

---

### Status

{{ Checklist }}

---

### Result

{{ Action-focused summary }}

---

<details>
<summary>Full report</summary>

{{ Complete canonical review-report.md, including its tables and nested folds. }}

</details>
```

Do not paste this placeholder into the summary. Pass the report file to the helper. The helper links labelled continuations if it cannot fit the report into one comment.
