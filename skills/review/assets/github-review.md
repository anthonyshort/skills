# GitHub review template

Use this template for the GitHub review body. Keep it shorter than the full report. Replace placeholders and omit empty sections. A supplied profile may replace this layout.

## Evidence

Back up findings and recommendations in both the review body and inline comments wherever possible. Use links to exact code revisions, caller traces, reproduction steps, test results or screenshots. Explain how the evidence supports the claim. Say when evidence is missing or a conclusion is uncertain.

Keep the issue, impact and recommended action visible. Put longer evidence in a details block near the finding. Link existing evidence instead of repeating it. Use GitHub-accessible links or include the relevant excerpt so the author does not need local review files.

<details>
<summary>Evidence: {{ short finding title }}</summary>

{{ Relevant source links, a short code trace, reproduction steps, expected and actual results, or a screenshot. Include the revision and conditions needed to interpret the evidence. Use only evidence actually gathered during the review. }}

</details>

## Review body

{{ Briefly explain whether the change solves the intended problem and is ready to merge. Include important conclusions about system fit, simplicity, readability and correctness. Keep the report's uncertainty and limits. }}

### Required fixes

{{ Summarise blocking findings with their impact and recommended action. Link inline comments or existing threads where possible instead of repeating their text. }}

### Bugs

{{ Confirmed bugs, ranked by severity. Explain what triggers each bug, what goes wrong and how to fix it. Include evidence using the format below. If a bug is already in Required fixes, link to it instead of repeating it. Keep suspected bugs clearly labelled as questions. Omit if none were found. }}

### Suggestions

{{ Non-blocking findings and recommendations. Make it clear which changes are optional. Keep findings without a valid diff anchor here or in Required fixes. }}

### Design and direction opportunities

{{ Supported product, design or architectural improvements from the report. Explain the current problem, proposed alternative, behaviour to preserve, cost of changing and a practical first step. Label each as a PR-scoped improvement or broader opportunity. Link related findings instead of repeating them. Omit if none are supported. }}

### Nits

{{ Optional aesthetic suggestions. Keep these separate from bugs and design opportunities. Omit if there are none. }}

### Verification

{{ Briefly state what was checked, the results and any gaps that affect the recommendation. Keep important failures and limits visible here even when the full checklist is folded below. }}

{{ Add one details block per skill or review checklist used, including the Step 3 checklists. Copy the outcomes from the final report and expand any collapsed categories into their full checklist. List every selected item, including failed, blocked, unverified and N/A checks. Do not include skills that were not used or claim new checks were performed. }}

<details>
<summary>{{ Skill or checklist name }} — {{ short result summary }}</summary>

**Guidance used:** {{ source path/link and version used in the review }}

- [x] **{{ item checked and found satisfactory }}** — {{ short evidence or link to a finding, source or check result }}
- [ ] **{{ failed, blocked or unverified item }}** — {{ status and reason, with evidence where available }}
- **N/A:** {{ item }} — {{ reason it does not apply }}

</details>

{{ Include a separate details block for commands and manual checks. Record actual results, including checks that failed or were not run. }}

<details>
<summary>Commands and manual checks — {{ short result summary }}</summary>

| Command or check | Result | Evidence or limits |
| --- | --- | --- |
| {{ exact command or manual steps }} | {{ passed/failed/blocked/not run }} | {{ relevant output, reproduction result, source link or reason }} |

</details>

## Inline comments

Post new inline comments on relevant lines in the current diff. Keep findings without a valid diff anchor in the review body. Avoid duplicating existing threads.

For each comment, explain the trigger and effect with a clear question or request. Include supporting evidence using the guidance above. Use a details block for longer traces, reproductions or test output. Use the selected writing voice and preserve uncertainty. Do not force a priority prefix.
