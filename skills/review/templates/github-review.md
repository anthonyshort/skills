# GitHub review template

Use this layout for a GitHub review. Replace placeholders and omit empty finding sections. A supplied profile may change the layout, but preserve evidence and coverage.

## Writing and structure

- Use normal sentence case. Capitalise sentence starts and “I”.
- Keep the tone conversational and direct. Avoid chat shorthand and forced casual wording.
- Explain the problem as you would to a colleague. Start with what the user or caller experiences, then ask for the change. Keep detailed mechanics in the evidence fold.
- Prefer concrete language. Say “editing this clears the saved colours” rather than “the reconciliation path loses configuration identity”.
- Use action-led finding titles and short explanatory paragraphs. Explain the problem and requested change naturally. Do not force findings into Trigger/Effect/Action fields. Use lists only for separate points.
- Do not join clauses with semicolons.
- Use tables only for short comparisons or results. Do not put paragraphs in cells.
- Include a short code example directly in a finding when it makes the issue or alternative easier to understand. Prefer the smallest relevant excerpt from the reviewed revision. Label proposed code and omitted context. Do not invent an available helper or force an example for a simple nit.
- Number bugs, required fixes, suggestions, design opportunities and nits in one sequence across the review. Do not restart at each category. Use those numbers in cross-references and related inline comments.
- Start with `🤖 Reviewed {short commit hash}`. Keep the summary focused on what the author should do.
- A clean-review summary can stop at “No new bugs found at this commit. No further changes requested.” Omit resolved-concern recaps, routine verification gaps and descriptions of the report or folds. Mention a verification gap in the summary only when it changes the recommendation or requires a concrete action. Missing verification alone is not a prioritised defect.
- For a split-only review, lead with the request to split and a short plan. Say the full review is deferred. Omit bug and rule coverage sections rather than pretending they were checked.
- Put review limits and coverage inside one Verification fold. Its summary must expose the important result or limit without opening it. Keep a material blocker visible in the finding or summary too.
- Keep notes with the verification overview before its nested coverage folds. Do not append a second notes section at the bottom.
- Keep exact hashes, repeated skill paths, agent bookkeeping and long output in the saved report. The GitHub review should explain the results, not reproduce raw worker reports.
- Keep CI status in the saved report. Do not recap it in the review body or inline comments.

## Review body

```markdown
**🤖 Reviewed `{{ short reviewed commit hash }}`**

## Summary

- **{{ finding number }}. {{ Action }}:** {{ Short description. Mark optional work and link existing concerns. }}

{{ State when no new supported bugs were found. Keep this summary about actions, not review mechanics. }}

## Required fixes

### {{ next number }}. {{ Action-led title }}

{{ Explain what goes wrong and ask for the correction in one short paragraph. Include priority and whether the concern is new or already reported where useful. Link the existing thread. }}

{{ Show a short inline code excerpt when it clarifies the problem. Identify its source at the reviewed revision. Follow with the consequence, pinned source link and any important uncertainty. Keep longer evidence folded. }}

## Bugs

{{ Use the same numbered, paragraph-based format. Do not repeat bugs listed in Required fixes. }}

## Suggestions

{{ Continue the numbering. Explain each optional recommendation and its concrete benefit in short prose. }}

## Design opportunities

### {{ next number }}. {{ Action-led title }}

{{ Propose the alternative and explain what becomes simpler. Clearly label optional PR-scoped improvements or broader opportunities. Link existing discussion. }}

{{ Show the current code or a clearly labelled proposed alternative when that makes the opportunity concrete. Briefly explain the behaviour to preserve, affected consumers, migration cost and a practical first step. Use short paragraphs or lists when several distinct points need comparison. Show before-and-after caller code for API proposals. }}

## Nits

{{ Continue the numbering. Use short prose or bullets for optional aesthetic suggestions. }}

<details>
<summary>Verification — {{ what was checked }} · {{ important review limit }}</summary>

| Check | Result |
| --- | --- |
| Review scope | {{ Source inspection and any manual checks }} |
| Best-practice skills | {{ Number actually used, with general/repository-specific breakdown when relevant }} |
| Review rules | {{ Number checked, outcomes and number skipped across all collections }} |
| Generated checks | {{ Total, with research/review/rule breakdown when recorded }} |

**Gaps and scope notes:**

- {{ Important unverified behaviour, missing sources and bounded searches. }}
- {{ Distinguish source inspection from manual checks. }}

### Review coverage

{{ Nest category folds and the one combined rules fold here using the formats below. Leave blank lines around nested blocks and after summary tags so Markdown renders. }}

</details>
```

## Category coverage

Nest one fold per review category inside Verification, such as Research, Product, System fit, Simplicity, Readability and Correctness.

- Put actual outcome totals in each summary. The denominator includes all items in the category.
- Use “satisfied” for checks supported by evidence. Reading tests does not establish that they passed.
- Show concerns, skipped, blocked, limited and unverified counts separately. Omit zero counts.
- Make counts add up. Do not count a blocked or partial check as fully satisfied.
- Use one short labelled list item per generated check. Name guidance once per category.
- Include a brief evidence statement or source link. Refer to a numbered finding instead of repeating it.
- Explain skipped and unverified items. Preserve limits when shortening source results.
- Do not inflate skill counts with descriptions merely inspected or files merely loaded. Count supporting references under their owning skill. Report workflow skills separately if needed.

```markdown
<details>
<summary>{{ Category }} — {{ satisfied }}/{{ total }} satisfied · {{ other outcome counts }}</summary>

**Guidance:** {{ Short names of skills and relevant reference categories actually used. }}

- **✓ {{ Check }}:** {{ One short evidence statement or source link. }}
- **Concern — {{ Check }}:** {{ See item N, with any distinct consequence. }}
- **Not verified — {{ Check }}:** {{ Missing evidence or reason. }}
- **Skipped — {{ Check }}:** {{ Scope reason. }}

</details>
```

## Rule coverage

Use one fold inside Verification for all rule collections, including repository-specific rules. List every rule once, with its outcome and concise evidence or skip reason. Do not add separate folds for each rule or repeat its full assessment.

When several subchecks are summarised under one rule, retain the material conclusions and limits. Rule totals count rules, not subchecks. Generated-check totals may include subchecks, but make that distinction clear.

```markdown
<details>
<summary>Rules — {{ satisfied }}/{{ total rules }} satisfied · {{ concerns, unverified or skipped counts }}</summary>

**Satisfied through source inspection**

- **{{ Rule }}:** {{ Short evidence statement. }}

**Concerns or unverified rules**

- **{{ Rule }}:** {{ Finding number or missing evidence. }}

**Skipped**

- **{{ Rule }}:** {{ Why it does not apply. }}

</details>
```

Name the method used to check each rule. Keep CI status in the saved report. Omit empty outcome groups.

## Evidence and inline comments

- Back findings with pinned source links, short traces, reproduction steps, test results or screenshots where available.
- Keep the issue, impact and action clear in the finding paragraph. Use a nearby evidence fold only when a short explanation and source links are insufficient.
- Use GitHub-accessible links or include the relevant excerpt. Do not require the author to open local artefacts.
- Put new, line-specific bugs inline when a valid current diff anchor exists. Include the problem, consequence, requested correction and concise evidence. Summarise the finding in the body with the same number.
- Link an existing thread instead of creating another inline comment for the same concern. State when no new inline comments are needed.
- Keep findings without valid anchors in the body. Preserve uncertainty and include evidence in inline comments too.
- Use the finding's shared number when referring between body and inline comments. Do not force a priority prefix.
- Use the robot emoji in the reviewed-commit header. Do not add attribution footers to the body, inline comments or replies.

## Short worked example

This illustrates structure, not evidence to copy into another review. A full review includes the verification table, gaps and nested category/rule coverage.

```markdown
**🤖 Reviewed `22c8651`**

## Summary

- **1. Fix hover access:** The card link blocks title and timestamp tooltips. Already reported.
- **2. Optional cleanup:** Share duplicated Table and Grid bindings.

No new bugs found.

## Bugs

### 1. Keep title and timestamp tooltips reachable

The full-card link sits above the title and timestamp, so hovering them hits the link instead. Can we adjust the hit regions while preserving native navigation and menu access?

This confirms the existing P2 concern through source inspection. It has not been reproduced in a browser. Include pinned source and discussion links here.

## Design opportunities

### 2. Share the common Table and Grid bindings

Could the filter callbacks and empty-state bindings have one owner inside `createTable`? This would remove duplicated wiring without changing the caller API.

This is optional and PR-scoped. A small extraction with regression coverage for both renderers would be enough.

<details>
<summary>Verification — source review · browser interactions not verified</summary>

Include results, scope notes and nested category/rule folds here.

</details>
```
