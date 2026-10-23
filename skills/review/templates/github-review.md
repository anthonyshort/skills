# GitHub review template

Use the [live comment's findings-first layout](github-progress.md). For separately requested formal reviews, preserve the requested status and reuse published findings. Automatic APPROVE reviews use the same assessed results, folded under Full report with a report link.

## Review body

```markdown
**🤖 Reviewed `{{ short reviewed commit hash }}`**

{{ Short findings summary. State when no new bugs were found. Explain a human-review reason only when it affects the recommendation. }}

#### Next steps

{{ Concrete actions and owners. Omit when there is no action. }}

#### Findings

##### P1

- **{{ Finding ID }} — {{ Action-led title }}:** {{ Trigger, consequence and requested correction. Link an existing thread or pinned evidence. }}

##### P2

- **{{ Finding ID }} — {{ Action-led title }}:** {{ Supported issue and useful action. Mark existing concerns. }}

#### Opportunities

{{ Clearly optional improvements without invented severity. Keep the same finding IDs. Omit empty sections. }}

<details>
<summary>Full report</summary>

{{ Structured assessment with the actual checklist answers and reasons, plus the canonical report or its published link. Detailed evidence and coverage stay here. }}

</details>
```

Group supported defects by P0, P1 and P2, omitting empty groups. The excerpt shows only P1/P2 for illustration. Do not add an Approval heading, repeat the reviewed commit or show the assessment table outside Full report. The helper owns Next steps for automatic publication, so omit it from summary input.

## Findings and evidence

- Explain what happens, why it matters and what should change in short conversational prose. Use action-led titles and concrete language. No forced Trigger/Effect/Action fields or attribution footer.
- Preserve shared finding IDs across the summary, full report and inline comments. Link existing concerns instead of presenting them as new. Separate required fixes, optional suggestions, questions and nits.
- Keep priorities tied to supported impact and likelihood. Missing evidence alone is not a prioritised defect. Never invent blockers or severity for optional work.
- Use a short code example when it clarifies the issue or alternative. Pin current excerpts to the reviewed revision and label proposed code. Put long traces in the report.
- New line-specific bugs go inline when valid anchors exist. Include the consequence, requested correction and concise evidence. Keep unanchored findings in the body. Do not duplicate published inline comments.
- Explain human-review recommendations in plain English. Keep wrapper names, publication mechanics and routine gaps inside Full report. Concise actionable CI blockers may appear in the summary or Next steps; no general CI rollup or CI status inline.
- Preserve all detailed research, individual checks, guidance references, methods, evidence and uncertainty in the [canonical report](review-report.md). Distinguish source inspection, CI and manual checks. Do not imply tests passed merely because they were read.
- For split-only results, request supported slices and say the full review was deferred. Do not invent implementation findings or an assessed checklist.

## Short worked example

Illustrative prose, not a current review result:

```markdown
**🤖 Reviewed `22c8651`**

No new bugs found. The earlier tooltip concern remains; sharing the bindings is optional.

#### Next steps

1. Keep the title and timestamp tooltips reachable as described in F1.

#### Findings

##### P2

- **F1 — Keep tooltips reachable:** The full-card link intercepts title hover. Already reported. Include the existing thread and pinned source link.

#### Opportunities

- **F2 — Share renderer bindings:** One owner for Table and Grid callbacks would remove duplicated wiring. Optional and PR-scoped.

<details>
<summary>Full report</summary>

Include the assessed checklist, evidence, uncertainty and report link here.

</details>
```
