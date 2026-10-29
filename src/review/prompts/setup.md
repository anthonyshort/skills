# Setup

Establish the pinned scope, review depth and initial risks. Read the full diff, count additions and deletions, and apply the over-2,000-added-lines split policy. Enumerate every rule path from the main and wrapper `rules/README.md` indexes. Return absolute canonical paths in `rulePaths`, and record any permitted size exception.

Check the PR description, changed files and line counts first. Confirm the base and head revisions cover the whole PR.

Return the setup result through StructuredOutput without writing files.

## Choose the review depth

- **Over 2,000 added lines:** Require splitting before a full review. The `splitPlan` worker will use [split-pr](../split-pr/SKILL.md) to suggest useful boundaries. Record the reason for selecting split-only mode without performing the full review.
- **Exceptions:** Only override for clearly generated or mechanical bulk, or an explicit request to review despite the size. Explain why. Unused new code alone is not an exception.
- **Split-only output:** Select split-only mode and record what you inspected. The `splitPlan` worker returns the split plan and CI status. The workflow skips research, assessments, rule review and full reporting. Do not claim implementation or rule coverage. The workflow uses the shorter progress checklist and schedules the decision after the split plan.

For PR reviews with publication enabled, the workflow starts the live comment with the chosen route and pinned revisions before research or the split plan.

For a full review, the workflow schedules research next. Use the supplied clean checkout at the pinned head and read other revisions through Git objects. Record a mismatch as blocked.

## Form an initial risk assessment

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

Return the initial assessment and questions in the setup result. The workflow passes accepted setup results to research and assessment workers. Revisit them as evidence arrives. Distinguish review effort from production impact. Conclude with a qualitative production risk level (low, medium or high), supported by exposure, consequences and verification gaps. State when evidence is insufficient to assess risk. Do not use a numerical risk score.

## This step is complete when:
- [ ] There is a local copy of the code being reviewed.
- [ ] Confirm the review scope.
- [ ] Diff size, distinct changes and initial risks are recorded.
