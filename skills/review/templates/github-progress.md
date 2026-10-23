# Live PR comment

The helper renders the linked commit header, Status, Result and Full report fold. Supply the progress checklist and findings summary. The helper inserts Next steps after the summary introduction and keeps the structured assessment inside Full report.

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

Start with a short findings summary, then `#### Findings` grouped under `##### P0`, `##### P1` and `##### P2`. Omit empty groups. Include only supported defects in priority groups. Optional opportunities, questions and nits may follow separately without invented severity.

The input contains a plain introduction followed by the finding headings. Do not supply a Next steps section: the helper inserts it before the first heading using the structured decision. Do not add an Approval heading, repeat the reviewed commit or display the seven-check table. The helper puts the exact assessment inside Full report.

If no actionable findings remain, the entire input can be:

```markdown
No new bugs found at this commit. No further changes requested.
```

Mention a reason for human review or missing verification only when it changes the recommendation. Explain it in plain English. Keep wrapper names, publication mechanics, CI rollups and routine gaps in the full report. Missing evidence is not itself a prioritised defect.

For actionable findings:

```markdown
No new bugs found. The earlier tooltip concern remains; sharing the renderer bindings is optional.

#### Findings

##### P2

- **F1 — Keep tooltips reachable:** The card link intercepts title hover. [Already reported](existing-thread-link).

#### Opportunities

- **F2 — Share renderer bindings:** One owner would remove duplicated callbacks. Optional and PR-scoped.

#### Open questions

- **F3 — Confirm empty-selection behaviour:** The intended outcome is undocumented.

#### Nits

- **F4 — Clarify the callback name:** Use a name that describes the saved value.
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

{{ Short findings summary }}

#### Next steps

{{ Helper-rendered actions from the structured decision }}

#### Findings

{{ Supported findings grouped under P0, P1 and P2 }}

---

<details>
<summary>Full report</summary>

{{ Helper-rendered structured assessment and complete canonical report. }}

</details>
```

The layout above is rendered output, not summary input. Omit empty Next steps or Findings sections. Pass the report file to the helper. The helper links labelled continuations if it cannot fit the report into one comment.
