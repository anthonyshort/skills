---
name: add-review-rule
description: Add or refine a reusable review rule from user feedback, a review finding or a code example. Use when asked to teach the review workflow a new check, with selection criteria, examples and an index entry. Do not use merely to run a code review or change general implementation guidance.
---

# Add a review rule

Turn the user’s concern into one focused question a reviewer can investigate. Preserve the reason behind the concern without turning a single implementation, preferred name or past failure into a universal ban.

## Find the right home

- Use the repository that owns the target collection and read its applicable authoring instructions. General review checks now belong to review-agent under `src/workflows/review/stages/rules/checks/`; read that service checkout's index and related rules before extending a concern. See [the review-agent workflow](https://github.com/anthonyshort/review-agent/tree/main/src/workflows/review).
- The [old general rule index](../review/rules/README.md) remains for compatibility and historical references. Do not add new service checks to that retained copy.
- Put broadly applicable checks in the general review rules. Use a repository-specific collection only when the rule depends on that repository’s contracts or architecture. For Galaxy, inspect [its rule index](../review-nominal-galaxy/rules/README.md).
- Keep implementation guidance, review orchestration and report formatting in their existing homes. Do not add a rule to compensate for a missing workflow step.

## Generalise the concern

Identify the change that should trigger the check, the relationships a reviewer must trace, and the consequence that makes it useful. Use the supplied discussion and code first. Inspect surrounding owners and callers when needed to distinguish an architectural concern from a naming preference or an isolated bug.

Keep legitimate counterexamples visible. For example, a new name may represent a genuinely different concept, a cache may preserve a historical result, and a wrapper may own a real lifecycle. Avoid rules based only on matching a symbol, file length or syntactic pattern.

## Write the rule

Follow the target collection’s authoring format and nearby examples. In the general review collection, create a descriptive kebab-case Markdown file with a plain-English title and these sections:

- **When to check:** Specific change characteristics that make the rule relevant. Use the same criteria in the index.
- **What to check:** Concrete questions about owners, contracts and callers. State what evidence supports a concern and what would resolve it.
- **Why it matters:** The actual failure, ambiguity or unnecessary complexity.
- **Exceptions:** Reasons the apparent pattern may be appropriate. Explain the boundary rather than weakening the rule with vague qualifications.
- **Good and bad examples:** Comparable, simplified TypeScript examples with the assumptions that make the comparison valid.

Prefer a small example adapted from the supplied code. Remove product names and unrelated details for a general rule. Preserve the important contract and show the caller-facing improvement. Implement helpers that carry the example’s argument, or explicitly label type declarations as API-shape examples rather than working implementations.

Do not disguise a behaviour change as a rename or claim a proposed API makes failure handling safe by itself. Keep materially different readiness, ownership or fallback contracts visible. Distinguish required corrections from optional preferences using the evidence and the user’s stated requirements. Do not assign a fixed severity to every future match.

Add the rule to the target index so the existing rule-checking pass will discover it. Do not change review delegation, publication or approval policy as part of adding a rule.

## Verify and deliver

- Read the rule against the original concern and a legitimate exception. Check that it would catch the concern without rejecting the exception.
- Check for overlap with neighbouring rules, working links and unfinished example placeholders.
- Run `git diff --check` and the owning repository’s required checks. Validate a changed skill with the skill-creator validator; ordinary service rule Markdown is not a skill. For a skill discovery change, follow installation checks in a temporary home.
- Use a realistic isolated evaluation when the change substantially alters review behaviour. A focused rule addition usually needs a source-level comparison, not a full PR review or live publication.
- Report the rule path, index update, intended check and verification performed. Preserve unrelated edits. Do not commit, publish or change live installation links unless requested.
