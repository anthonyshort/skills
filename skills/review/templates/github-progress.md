# Live PR comment

The helper renders the linked commit header, status checklist, full-report fold and footer. Supply the checklist and final summary as Markdown files. These examples show the content, not a fixed workflow.

## Checklist input

```markdown
- [x] Set up and assess scope
- [ ] Gather context — in progress
- [ ] Review product, design and correctness
- [ ] Check review rules
- [ ] Verify findings and write report
- [ ] Publish results and inline findings
```

Adapt the stages to the actual work. Split-only reviews need only setup, a split plan and publication. Mark skipped or blocked work explicitly. Supply the final checklist to `finish --checklist`. The helper leaves publication unchecked in its intermediate update and publishes the final checklist after successful writes.

## Final summary input

```markdown
The change needs one correction before merging. Source review confirmed the issue. Browser behaviour remains unverified.

## Findings

### P1

- **F1 — Preserve saved colours:** Editing a label clears the custom colour. [Evidence](pinned-source-link).

### P2

- **F2 — Keep tooltips reachable:** The card link intercepts title hover. [Already reported](existing-thread-link).

## Opportunities

- **F3 — Share renderer bindings:** One owner would remove duplicated callbacks. Optional and PR-scoped.

## Open questions

- **F4 — Confirm empty-selection behaviour:** The intended outcome is undocumented.

## Nits

- **F5 — Clarify the callback name:** Use a name that describes the saved value.
```

Use P0, P1 and P2 for supported defects, using the report's priority definitions. Omit empty groups and explicitly state when no supported findings were found. Preserve finding IDs across summary, full report and inline comments. Link existing concerns instead of presenting them as new. Keep each bullet concise but explain the consequence or benefit. Put CI details and audit coverage in the full report.

The final comment retains the checklist below `Reviewed {linked short commit}` and appends the summary followed by:

```markdown
<details>
<summary>Full report</summary>

{{ Complete canonical review-report.md, including its tables and nested folds. }}

</details>
```

Do not paste this placeholder into the summary. Pass the report file to the helper. The helper links labelled continuations if it cannot fit the report into one comment.
