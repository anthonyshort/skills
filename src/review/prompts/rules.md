# Review rules

One sequential pass must return exactly one row per `setup.rulePaths` entry, including skipped rules with reasons. Read each selected rule fully.

The assigned rule worker checks the rules one at a time in one context, including supplied wrapper rule collections. Do not delegate individual rules.

## Rule pass inputs

Use the supplied inputs:

- [The rule index](rules/README.md) and any additional rule indexes supplied by a wrapper.
- The repository location, base and head revisions, and full diff.
- The completed research brief and relevant accepted context.
- Relevant requirements, decisions, sources and operational constraints.
- CI evidence and the no-install and no-local-check rules.

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

Return the assessment. The workflow checks it against the supplied indexes for missing rules. Consolidation checks weak evidence and merges duplicate findings. The final report includes the accepted rule results.
