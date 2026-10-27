---
name: review-rules
description: Check a code change against the focused review rules one at a time and return a result for every rule. Part of the review workflow.
---

# Review rules check

Work through the rules one at a time. Reuse your context across the whole pass, including any repository-specific rule collections. Follow [the review constraints](../review/references/constraints.md).

## Inputs

- [The rule index](rules/README.md) and any additional rule indexes supplied by a wrapper.
- The repository location, base and head revisions, and full diff.
- The completed research brief and relevant context gathered by the parent.
- Relevant requirements, decisions, sources and operational constraints.
- CI evidence.

## Work through the rules

1. **Read the indexes**: Account for every listed rule across the supplied collections.
2. **Check relevance**: Use the selection criteria to decide whether each rule applies. Record skipped rules with a reason.
3. **Check one rule at a time**: Read the full applicable rule, including its examples and exceptions. Inspect the diff, surrounding code and callers as needed. Record the result and evidence before moving on.
4. **Return the assessment**: Include every rule. Mark missing evidence as not verified rather than skipping a relevant rule. Reuse evidence where rules overlap, but give each rule its own result.

A matching pattern does not automatically mean there is a problem. If missing intent could change the result, ask for that context or record the limit.

## Deliverable

Return one **rule assessment** with a row for every rule:

- **Rule**: Name and file.
- **Selection**: Selected or skipped, with a reason.
- **Result**: Satisfied, concern found, not applicable or not verified.
- **Evidence**: Code locations and what was checked. Separate source inspection, CI and manual checks. Give a reason for skipped rules.
- **Finding**: The problem, effect and recommended change, if supported.
- **Limits**: Missing information or behaviour that could not be verified.
