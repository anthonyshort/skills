---
name: review-risk
description: Assess the size, scope and production risk of a code change before reviewing it. Part of the review workflow. Also usable on its own to triage a PR.
---

# Review risk assessment

Form an initial risk assessment for a code change. Follow [the review constraints](../review/references/constraints.md).

## Inputs

- The repository, base and head revisions, and the PR description.

## Assess the risk

Start with the diff size, then consider what the change does and where it runs.

| Changed lines | Starting expectation |
| --- | --- |
| Under 100 | Usually straightforward to review. Check for sensitive behaviour. |
| 100–499 | Needs closer investigation. Size alone rarely warrants splitting. |
| 500–999 | Look actively for useful ways to split it. |
| 1,000 or more | Strong preference for splitting unless keeping it together has a clear benefit. |

Count additions and deletions across the full reviewed diff. Identify generated files, lockfiles, moves and mechanical changes separately so they do not hide the meaningful change.

These are starting signals. A small data-loading change can be riskier than a large styling change. A large, tested implementation with no callers may have little immediate production impact. Typechecking supports a refactor's safety but does not establish that runtime behaviour is preserved.

Consider:

- **Understandability:** Can you quickly explain the scope and what might go wrong?
- **Isolation:** Does the PR contain a small end-to-end change or a clearly explained group of low-risk changes? Look for several substantial changes that need different reasoning or verification.
- **Complexity:** How many behaviours, owners and dependencies must be understood together? Look at difficult functions and files as well as the whole diff.
- **Testability:** Can important behaviour be tested independently? Identify external dependencies and missing coverage that make verification difficult.
- **Blast radius:** Which consumers and production paths could be affected? Consider the consequence of failure and how it could be detected and recovered from.
- **Activation:** Is the new code already used? Check callers, imports, registration and side effects before treating it as inactive.

Record the initial assessment and questions in `risk.md` in the review artefact directory. Distinguish review effort from production impact. Conclude with a qualitative production risk level (low, medium or high), supported by exposure, consequences and verification gaps. State when evidence is insufficient to assess risk. Do not use a numerical risk score.

## Deliverable

Save `risk.md` in the review artefact directory. Include the diff size, distinct changes, the assessment against each consideration above, the production risk level with its reasons, and open questions for research and review.
