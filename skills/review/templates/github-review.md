# GitHub review template

Use this layout for a GitHub review. Replace placeholders and omit empty finding sections. A supplied profile may change the layout, but preserve evidence and coverage.

## Writing and structure

- Use normal sentence case. Capitalise sentence starts and “I”.
- Keep the tone conversational and direct. Avoid chat shorthand and forced casual wording.
- Use short paragraphs for conclusions and labelled lists for triggers, effects, actions and limits.
- Do not join clauses with semicolons.
- Use tables only for short comparisons or results. Do not put paragraphs in cells.
- Number bugs, required fixes, suggestions, design opportunities and nits in one sequence across the review. Do not restart at each category. Use those numbers in cross-references and related inline comments.
- Put scope notes and important limits in the summary. Do not append a second notes section after the coverage folds.
- Keep exact hashes, repeated skill paths, agent bookkeeping and long output in the saved report. The GitHub review should explain the results, not reproduce raw worker reports.

## Review body

```markdown
## Summary

{{ One or two sentences on whether the change meets its goal and the main recommendation. }}

- **Needs attention:** {{ Numbered findings that matter, distinguishing new concerns from existing threads. Say when no new supported bugs were found. }}
- **Validation:** {{ Important executed results. }}
- **Not verified:** {{ Behaviour that remains unchecked and why it matters. }}
- **Review scope:** {{ Best-practice skills used and rules checked/skipped. Include relevant research or process limits here. }}

## Required fixes

### {{ next number }}. {{ Short title }}

**{{ Priority }} · {{ New or Already reported with thread link }}**

{{ Direct request or short explanation. }}

- **Trigger:** {{ Conditions that expose the issue. }}
- **Effect:** {{ Observable consequence. }}
- **Action:** {{ Concrete correction. }}
- **Evidence:** {{ Short trace, reproduction or check result with pinned source links. }}
- **Limit:** {{ Important uncertainty, if any. }}

## Bugs

{{ Use the same numbered finding format. Do not repeat bugs listed in Required fixes. }}

## Suggestions

{{ Use the next finding number and a short labelled list. Keep optional changes clearly optional. }}

## Design opportunities

### {{ next number }}. {{ Short title }}

**Optional · {{ PR-scoped improvement or broader opportunity }} · {{ New or existing discussion link }}**

{{ Proposed direction as a short question or recommendation. }}

- **Benefit:** {{ Current friction and complexity removed. }}
- **Preserve:** {{ Behaviour and caller contracts that must stay intact. }}
- **First step:** {{ Small feasible action. }}
- **Cost:** {{ Affected consumers, migration work and regression coverage. }}
- **Evidence:** {{ Source links or related finding number. }}

{{ Show short before-and-after caller code when proposing an API change. }}

## Nits

{{ Continue the numbering. Use short bullets for optional aesthetic suggestions. }}

## Verification

| Check | Result |
| --- | --- |
| {{ Executed test group }} | {{ Actual file/test totals and result }} |
| {{ Typechecking, lint or formatting }} | {{ Actual result and scope }} |
| Best-practice skills | {{ Number actually used, with general/repository-specific breakdown when relevant }} |
| Review rules | {{ Number checked, outcomes and number skipped across all collections }} |
| Generated checks | {{ Total, with research/review/rule breakdown when recorded }} |

## Review coverage

{{ Add category folds and one combined rules fold using the formats below. }}

<sub>Sent with Pi</sub>
```

## Category coverage

Use one fold per review category, such as Research, Product, System fit, Simplicity, Readability and Correctness.

- Put actual outcome totals in each summary. The denominator includes all items in the category.
- Use “satisfied” for checks supported by evidence. Reserve “tests passed” for executed tests.
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

Use one fold for all rule collections, including repository-specific rules. List every rule once, with its outcome and concise evidence or skip reason. Do not add separate folds for each rule or repeat its full assessment.

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

Use the actual method if a rule was verified through tests or manual checks. Omit empty outcome groups.

## Evidence and inline comments

- Back findings with pinned source links, short traces, reproduction steps, test results or screenshots where available.
- Keep the issue, impact and action visible. Use a nearby evidence fold only when the evidence is too long for a short list.
- Use GitHub-accessible links or include the relevant excerpt. Do not require the author to open local artefacts.
- Post new inline comments only on relevant current diff lines. Link existing threads instead of duplicating them.
- Keep findings without valid anchors in the body. Preserve uncertainty and include evidence in inline comments too.
- Use the finding's shared number when referring between body and inline comments. Do not force a priority prefix.
- End the review body and every inline comment with one blank line followed by `<sub>Sent with Pi</sub>`.

## Short worked example

This illustrates structure, not evidence to copy into another review. A full review also includes the verification table and coverage folds.

```markdown
## Summary

The optional grid fits the reports index. I'd keep this PR together.

- **Needs attention:** No new bugs found. Item 1 is already reported. Item 2 is optional.
- **Validation:** Local UI and Scout checks passed.
- **Not verified:** Browser interactions and visual changes.

## Bugs

### 1. Card overlay blocks hover information

**P2 · Already reported**

Can we keep the title and timestamp reachable beneath the card link?

- **Effect:** The overlay intercepts their pointer events.
- **Action:** Adjust hit regions while preserving native navigation.
- **Evidence:** The absolute link sits above the title and content.
- **Limit:** Source inspection, not a browser reproduction.

## Design opportunities

### 2. Share Table and Grid bindings

**Optional · PR-scoped**

- **Benefit:** Removes duplicated filter and empty-state wiring.
- **Preserve:** Existing caller APIs and behaviour.
- **First step:** Extract common bindings and check both renderers.
- **Cost:** Changes to two renderers and regression coverage.
```
