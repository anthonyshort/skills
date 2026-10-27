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

#### Opportunities

{{ Clearly optional improvements without invented severity. Keep the same finding IDs. Avoid repeating alternatives from the approach fold. Omit empty sections. }}

<details>
<summary>Full report</summary>

{{ Seven approval checks with actual answers and reasons, plus the canonical report or its published link. Detailed evidence and coverage stay here. }}

</details>
```

Group supported defects by P0, P1 and P2, omitting empty groups. The excerpt shows only P1/P2 for illustration. Do not add an Approval heading, repeat the reviewed commit or show the approval table outside Full report. The helper owns Next steps for automatic publication, so omit it from summary input. See the live comment template for a worked assessment example, including reviews without bugs and split-only results.

## Findings and evidence

- Explain what happens, why it matters and what should change in short conversational prose. Use action-led titles and concrete language. No forced Trigger/Effect/Action fields or attribution footer.
- Preserve shared finding IDs across the summary, full report and inline comments. Link existing concerns instead of presenting them as new. Separate required fixes, optional suggestions, questions and nits.
- Keep priorities tied to supported impact and likelihood. Missing evidence alone is not a prioritised defect. Never invent blockers or severity for optional work.
- Use a short code example when it clarifies the issue or alternative. Pin current excerpts to the reviewed revision and label proposed code. Put long traces in the report.
- New line-specific bugs go inline when valid anchors exist. Include the consequence, requested correction and concise evidence. Keep unanchored findings in the body. Do not duplicate published inline comments.
- Explain human-review recommendations in plain English. Keep wrapper names, publication mechanics and routine gaps inside Full report. Concise actionable CI blockers may appear in the summary or Next steps. No general CI rollup or CI status inline.
- Preserve all detailed research, individual checks, guidance references, methods, evidence and uncertainty in the [canonical report](../../review-report/templates/review-report.md). Distinguish source inspection, CI and manual checks. Do not imply tests passed merely because they were read.
- For split-only results, request supported slices and say the full review was deferred. Do not invent implementation findings or an assessed checklist.
