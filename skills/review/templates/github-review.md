# GitHub review template

Use the [live comment’s assessment-first layout](github-progress.md#final-summary-input), including its source, risk, rule and alternative reporting requirements. For separately requested formal reviews, preserve the requested status and reuse published findings. Automatic APPROVE reviews use the same assessed results, folded under Full report with a report link.

## Review body

```markdown
**🤖 Reviewed `{{ short reviewed commit hash }}`**

- **Overall:** {{ Whether the solution addresses the original problem and the approach is sound. Include new bug counts, existing concerns and material uncertainty. }}
- **Risk:** {{ Low, medium or high production risk with a concise reason, or insufficient evidence. }}
- **Rules:** {{ Satisfied, concern, unverified and skipped counts. Separately count selected rules found not applicable. Name concerns and why. }}

<details>
<summary>Research sources</summary>

{{ Descriptive source links and what they establish. Identify validated reused evidence and relevant access or search limits. }}

</details>

<details>
<summary>Approach and alternatives</summary>

{{ Problem fit, architectural fit and simplicity. Supported alternatives with trade-offs, or no supported alternative found. Separate required changes from optional improvements. }}

</details>

#### Next steps

{{ Concrete actions and owners. Omit when there is no action. }}

#### Findings

##### P1

- **{{ Finding ID }} — {{ Action-led title }}:** {{ Trigger, consequence and requested correction. Link an existing thread or pinned evidence. }}

##### P2

- **{{ Finding ID }} — {{ Action-led title }}:** {{ Supported issue and useful action. Mark existing concerns. }}

#### Recommendations and decisions

{{ Visible non-bug recommendations and decisions from the assessments and rule checks. State the concrete change, reason, required/recommended/optional status and useful proposed snippet. Reuse finding IDs and existing thread links. Supporting rationale can remain folded, but actionable content must be understandable here. Omit empty sections. }}

<details>
<summary>Full report</summary>

{{ Seven approval checks with actual answers and reasons, plus the canonical report or its published link. Detailed evidence and coverage stay here. }}

</details>
```

Group supported defects by P0, P1 and P2, omitting empty groups. The excerpt shows only P1/P2 for illustration. Do not add an Approval heading, repeat the reviewed commit or show the approval table outside Full report. The helper owns Next steps for automatic publication, so omit it from summary input. See the live comment template for a worked assessment example, including reviews without bugs and split-only results.

## Findings and evidence

- Explain what happens, why it matters and what should change in conversational prose. Include the essential source evidence and useful current/proposed snippets so the author can assess and act without expanding Full report. Use action-led titles and concrete language. No forced Trigger/Effect/Action fields, fixed sentence limit or attribution footer.
- Preserve shared finding IDs across the summary, full report and inline comments. Link existing concerns instead of presenting them as new. Separate required fixes, optional suggestions, questions and nits.
- Keep priorities tied to supported impact and likelihood. Missing evidence alone is not a prioritised defect. Never invent blockers or severity for optional work.
- Use a short code example when it clarifies the issue or alternative. Pin current excerpts to the reviewed revision and label proposed code. Do not replace an actionable example with a vague instruction to simplify or extract. Put long traces in the report.
- Check visible action coverage against the canonical report. Preserve substantive non-bug assessment recommendations, existing concerns, decisions and verification actions as well as defects. Connect concern rules to those actions rather than reporting only counts. Merge overlaps instead of dropping recommendations into folds or generic Next steps.
- New line-specific bugs go inline when valid anchors exist. Include the consequence, requested correction and concise evidence. Keep unanchored findings in the body. Do not duplicate published inline comments.
- Explain human-review recommendations in plain English. Keep wrapper names, publication mechanics and routine gaps inside Full report. Concise actionable CI blockers may appear in the summary or Next steps. No general CI rollup or CI status inline.
- Preserve all detailed research, individual checks, guidance references, methods, evidence and uncertainty in the [canonical report](review-report.md). Distinguish source inspection, CI and manual checks. Do not imply tests passed merely because they were read.
- For split-only results, request supported slices and say the full review was deferred. Do not invent implementation findings or an assessed checklist.
