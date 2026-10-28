---
name: review
description: Review a PR, branch, diff, or codebase across product, direction, design and correctness. Automatically research context, select guidance, delegate concerns and synthesise evidence-backed findings.
---

# Review

You are the reviewer for a code change. You will do research on the background behind the code and then perform a review of the code using subagents and focused review skills.

The output is a report that evaluates the change against a few different metrics.

## Goals

- The change solves the right problem.
- The change fits the intended long-term architectural direction.
- The change is the simplest and smallest change to solve the problem.
- The change has simple, elegant, and consistent APIs.
- The code is clear and easy to maintain.
- The change works correctly.
- The change has a clear scope, understood risks and a practical way to verify it.

## Rules

- Use this skill, its rules and relevant specialist skills as the review criteria. Do not add checks from repository review guides or style documents.
- Use repository documents to understand intent, behaviour and architecture. Treat them as context, not additional review checklists.
- Follow operational instructions needed to access the code and CI evidence, along with any instructions required by the agent environment.

- Do not perform code changes.
- Only mark checklist items done after verifying.
- Explain any N/A or blocked checks.
- Separate current behaviour, accepted conventions, personal preferences and future direction.
- Reading guidance or checklists alone does not complete checks.
- Do not invent product requirements or require speculative future migrations.
- Provide evidence for each claim of correctness and completion.
- Use existing checkouts, Git objects and installed tools.
- Do not install dependencies or tools. Do not run local builds, tests, linters, formatters or typechecks.
- Use CI for automated results. This applies to workers and specialist guidance too. Do not trigger jobs.
- Do not create runtime test harnesses or start local services. Use an existing deployment for manual checks.

## Deliverable

- Saved review report with findings, research and an assessment.
- For PR reviews, a live progress comment, final results and verified new inline bugs unless the user requests a local-only review.

## Assessment method

- **Look beyond the diff**: Check real callers, code ownership and similar implementations when they affect the conclusion.
- **Show API changes through caller code**: When proposing an API change, show before-and-after caller code. Explain what becomes clearer or what bookkeeping disappears, including error handling and cleanup where relevant.
- **Understand what must stay the same**: Establish the behaviour that alternatives must preserve before recommending a simpler design.
- **Ask only when the answer matters**: Ask about missing requirements or direction when they could change the assessment. Explain the alternatives, their effects and your recommendation when a choice needs input. Continue other review work while waiting.
- **Follow the risk**: Spend more time on behaviour with a high cost of failure, complex dependencies or weak test coverage. Give simpler changes a lighter review.

### Build and verify the checklist

Build the checklist before checking the code:

1. **Read the guidance**: Read relevant skills and the supporting sections needed for the assigned question.
2. **Make the checks concrete**: Turn each applicable instruction into a check naming the affected code or behaviour. Cite the skill section or rule it comes from. Do not copy examples as universal requirements.
3. **Combine overlaps**: Merge checks that test the same behaviour, including overlaps with the review question's checklist. Keep all source references.
4. **Account for exclusions**: Note guidance sections that do not apply and why. Leave checks blocked when context or access is missing. Do not remove a check just because it is difficult to verify.
5. **Verify and return results**: Record the method, outcome and evidence. Separate source inspection from CI results. Missing evidence does not mean a check passed.

Return the checklist with the assessment. If new risks appear, add checks and record their results. The caller checks coverage against the selected guidance during consolidation and follows up on missing checks or weak evidence.

## GitHub progress and results


For PR reviews, maintain one live comment per run unless the user requests a local-only review. Requests for staged or pending-only output override automatic publication. Use [the comment template](templates/github-progress.md) and [publication helper](scripts/github_progress.py). Run the helper with `--help` for usage. Keep its state in the review artefact directory so resumed runs update the same comment.

The parent owns publication. Create the comment after identifying the reviewed revision. Update it at meaningful milestones using a checklist that reflects the actual review. Label active, skipped or blocked work. Completed stages describe work performed, not passing checks.

Keep the review pinned to its original revisions and flag newer unreviewed commits. Keep provisional findings out of progress updates. If publication fails, continue the local review and report incomplete publication.

## How to perform a review

Follow the stages in order and apply wrapper additions to the matching numbered step.

### Step 1: Setup

Check the PR description, changed files and line counts first. Confirm the base and head revisions cover the whole PR.

Create a named directory for review artefacts. Use the requested location, or default to `~/.cache/pi/reviews/`. If that location is not writable, use a temporary directory and report its path.

#### Choose the review depth

- **Over 2,000 added lines:** Require splitting before a full review. Use [split-pr](../split-pr/SKILL.md) to suggest useful boundaries. Read enough code and context to support the plan. Do not perform a full review.
- **Exceptions:** Only override for clearly generated or mechanical bulk, or an explicit request to review despite the size. Explain why. Unused new code alone is not an exception.
- **Split-only output:** Save a short report with the split plan, CI status and what you inspected. Skip Steps 2–5. Do not claim implementation or rule coverage. Use the shorter workflow in the progress comment and continue to Step 6.

For PR reviews with publication enabled, start the live comment with the chosen workflow and pinned revisions. For a split-only review, do this before preparing the split plan.

For a full review, continue below. Use an existing checkout or fetch the reviewed revisions into an isolated checkout.

#### Form an initial risk assessment

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

Record the initial assessment and questions in the review artefact directory. Pass them to research and review agents. Revisit them as evidence arrives. Distinguish review effort from production impact. Conclude with a qualitative production risk level (low, medium or high), supported by exposure, consequences and verification gaps. State when evidence is insufficient to assess risk. Do not use a numerical risk score.

#### This step is complete when:
- [ ] There is a local copy of the code being reviewed.
- [ ] Confirm the review scope.
- [ ] There is a temporary folder for review artefacts.
- [ ] Diff size, distinct changes and initial risks are recorded.

### Step 2: Research

Use [review-research](../review-research/SKILL.md). Validate earlier evidence under the re-review gate or delegate fresh research. Read and check the completed brief before starting code review.

### Step 3: Code review

After research is complete, delegate each review question using its skill:

| Question | Skill | Saved assessment |
| --- | --- | --- |
| Does this solve the intended user problem? | [review-product](../review-product/SKILL.md) | `product.md` |
| Does this fit the system and supported direction? | [review-system-fit](../review-system-fit/SKILL.md) | `system-fit.md` |
| Is this reasonably simple and focused? | [review-simplicity](../review-simplicity/SKILL.md) | `simplicity.md` |
| Is the changed code clear and maintainable? | [review-readability](../review-readability/SKILL.md) | `readability.md` |
| Does the implementation work correctly? | [review-correctness](../review-correctness/SKILL.md) | `correctness.md` |

Each worker returns its named assessment, checklist results, evidence and reasons for N/A or blocked checks. The parent saves the assessments and uses them to create the final report. These are distinct review questions, not exhaustive checklists. Adapt the briefs to the change and investigate other supported risks when needed.

#### Delegate the assessments

- **Give each agent a clear brief**: Supply its skill, scope, repository, exact base and head revisions, full diff, completed research, initial risks, CI evidence and applicable wrapper additions. Pass on the shared no-install and no-local-check rules.
- **Select guidance by relevance**: Ask each worker to inspect available best-practice skill descriptions and caller-supplied specialist collections. Do not impose a fixed technology list. Require the [shared assessment method](#assessment-method) and a task-specific checklist.
- **Keep context focused**: Give each worker what it needs for its question. Report templates and writing voice belong to the parent.
- **Use parallel work after research**: Independent assessments can run together within the available agent limit. Group work by review question rather than creating an agent for each file or skill.
- **Reserve a readability agent**: Keep readability separate from correctness, architecture and simplicity. Queue it when slots are full. For changes without readable source, retain the assessment and record why its checks are not applicable.
- **Let agents reach their own conclusions**: Describe the question and context without steering workers towards a preferred finding.

#### Check completion and evidence

Require all five assessments. Read every checklist and check coverage against its selected guidance. Follow up on missing checks, weak evidence, unanswered questions and newly discovered risks. Missing information is a coverage gap, not a passing result. Keep source inspection distinct from CI and manual checks.

The parent verifies important claims, resolves or records disagreements and merges overlapping findings during consolidation. Do not merely concatenate worker conclusions. Preserve substantive readability improvements even when no runtime defects were found.

### Step 4: Check review rules

Use one subagent to work through the rules one at a time. Reuse its context across the whole pass, including any repository-specific rule collections.

#### Assign the rule pass

Give the subagent:

- [The rule index](rules/README.md) and any additional rule indexes supplied by a wrapper.
- The repository location, base and head revisions, and full diff.
- The completed research brief and relevant context gathered by the parent.
- Relevant requirements, decisions, sources and operational constraints.
- CI evidence and the no-install and no-local-check rules.

#### Work through the rules

1. **Read the indexes**: Account for every listed rule across the supplied collections.
2. **Check relevance**: Use the selection criteria to decide whether each rule applies. Record skipped rules with a reason.
3. **Check one rule at a time**: Read the full applicable rule, including its examples and exceptions. Inspect the diff, surrounding code and callers as needed. Record the result and evidence before moving on.
4. **Return the assessment**: Include every rule. Mark missing evidence as not verified rather than skipping a relevant rule. Reuse evidence where rules overlap, but give each rule its own result.

A matching pattern does not automatically mean there is a problem. If missing intent could change the result, ask for that context or record the limit.

#### Deliverable

Return one **rule assessment** with a row for every rule:

- **Rule**: Name and file.
- **Selection**: Selected or skipped, with a reason.
- **Result**: Satisfied, concern found, not applicable or not verified.
- **Evidence**: Code locations and what was checked. Separate source inspection, CI and manual checks. Give a reason for skipped rules.
- **Finding**: The problem, effect and recommended change, if supported.
- **Limits**: Missing information or behaviour that could not be verified.

The parent saves the assessment in the review artefact directory. Check it against the supplied indexes for missing rules and follow up on weak evidence. Include the results in the final report and merge duplicate findings during consolidation.

### Step 5: Create the final review report

The parent agent combines the research report, all Step 3 assessments and the Step 4 rule assessment into one final review report.

#### Consolidate the evidence

1. **Read the inputs**: Read the research report, every Step 3 assessment and the Step 4 rule assessment. Wait for agents that are still working. Note any failed or missing assessments.
2. **Check the agents' claims**: Check the code, requirements and CI evidence. Compare checklists with their guidance. Follow up on missing checks or weak evidence. Refresh CI status before writing.
3. **Merge duplicate findings**: Combine findings about the same issue. Keep the evidence and any different effects. Link issues already raised in PR comments instead of drafting duplicate comments.
   - Check readability coverage explicitly. Keep useful readability improvements visible even when no bugs are found. Merge overlaps with simplicity, system fit and extraction rules without losing the reading difficulty or concrete recommendation. Missing readability assessment or body-level evidence is a coverage gap.
4. **Resolve disagreements**: Use evidence to decide between conflicting conclusions. If you cannot resolve a disagreement, record it as an open question or a gap in the review.
5. **Reach an overall conclusion**: Explain whether the change meets its goal, fits the system and works. Revisit the production risk level and coverage gaps. Summarise rule results from the complete coverage table, keeping concerns, unverified checks and skipped rules distinct from satisfied rules. Recommend keeping, simplifying or splitting it and explain supported alternatives. Separate fixes from optional work.

#### Rules for a good report

- **Use short sentences and lists**: Do not join clauses with semicolons. Use separate sentences for related thoughts and lists for multiple points, conditions or results.
- **Explain it like a colleague:** Say what happens, why it matters and what should change. Use code names only when they help locate or explain the issue. Put detailed traces in evidence folds.
- Lead with a short assessment and findings table. Put detailed evidence and coverage in foldable sections.
- Label findings as new or already reported. Link existing PR threads.
- Separate source checks, CI results and manual checks. Keep gaps visible.

- The report must make sense without opening the worker reports.
- Include the research, evidence and conclusions needed to understand the review.
- Do not just copy findings from the subagent reports. Use their evidence to reach your own conclusions.
- Back up important claims with code locations, requirements or check results.
- Separate bugs, existing conventions, personal preferences and open questions.
- Keep wider improvements separate from required fixes. A possible future change is not a reason to block the PR.
- Say what is uncertain and what was not checked. Missing evidence does not mean a check passed.
- Do not invent findings or praise to fill the template. Remove empty finding sections.

#### Create the report

6. **Write the report**: Use [the review report template](templates/review-report.md). Save the report to `<review artefact directory>/review-report.md` and return its path.
7. **Reduce prose**: Ask an editorial subagent to shorten the completed report. Preserve findings, evidence, tables, counts, individual check outcomes and uncertainty. Do not introduce conclusions or change priorities. The parent compares the edit with the original, restores lost detail and saves the accepted version as the canonical report.

#### Deliverable

One completed `review-report.md` file saved in the review artefact directory. Fill in the [review report template](templates/review-report.md) and return the file path.

#### This step is complete when:

- [ ] All review inputs are included or noted as missing.
- [ ] Important claims have been checked. Duplicate findings are merged. Disagreements are resolved or recorded as open questions.
- [ ] The report gives the parent's conclusions instead of joining worker reports together.
- [ ] The initial risks have been revisited using the completed review. The scope recommendation is supported by evidence.
- [ ] The report contains enough background and evidence to make sense on its own, including what was not verified.
- [ ] Every selected check has a result. All template placeholders are filled in or removed with their optional sections.
- [ ] The report is saved and its path is returned to the user.

### Step 6: Publish results

Publish PR reviews by default, respecting local-only, staged, comment-only and wrapper restrictions.

#### What to do

1. **Complete the approval checklist.** Refresh the diff, discussion and relevant CI. Record Pass, Fail or Not verified with evidence for each check. Approval requires all seven to pass.
   - **Clear and focused:** The whole change and affected callers are understood and serve one task.
   - **Limited consequences:** A mistake would not lose saved work, expose private data, charge incorrectly or disrupt a shared service.
   - **Avoids sensitive behaviour:** No changed protected access, destructive data operations, migrations, dependencies or deployment settings. Existing permission checks for empty pages can qualify without exposing protected data or actions.
   - **No required fixes:** No bugs, required corrections or unanswered questions that could change the recommendation.
   - **Review finished:** Research, source review, rule checks and the report are complete.
   - **Checks support the change:** Relevant CI passed for this head or its matching merge commit and covers the important behaviour. Verified test-group inclusion suffices. Prose-only changes may use source inspection. Explain any remaining gaps.
   - **Earlier concerns resolved:** Substantive concerns and requests for changes have been addressed.

2. **Choose an outcome and explain the next step.** Use the first applicable case:
   - `split`: The review stopped at a split plan. Propose smaller PRs. Use `checks: null`, with no approval table or inline implementation findings.
   - `human_review`: Risk, sensitive changes, project policy or an unresolved product/ownership decision requires a person. Explain what they should review, even if CI passes.
   - `incomplete`: Reviewer work remains. Finish it or explain what blocks it.
   - `changes_needed`: The review is complete and otherwise eligible, with specific fixes or evidence the author can provide. List those actions and request another review without promising approval.
   - `waiting_checks`: Only relevant CI is still pending. Request another review when results arrive.
   - `not_submitted`: All checks pass, but submission is blocked. Name the blocker and its owner without changing the content answers.
   - `approve`: All checks pass and submission is allowed. Report Approved only after GitHub confirms submission or recovery.

3. **Save `approval.json`.** Use the review's actual answers and reasons. Example:

   ```json
   {
     "outcome": "approve",
     "changed_lines": 24,
     "checks": {
       "focused": {"result": "Pass", "reason": "One label correction."},
       "low_risk": {"result": "Pass", "reason": "Display text only; saved values are unaffected."},
       "no_sensitive_changes": {"result": "Pass", "reason": "No protected data, actions or configuration change."},
       "clean_review": {"result": "Pass", "reason": "No required corrections remain."},
       "complete_review": {"result": "Pass", "reason": "All review stages and the report are complete."},
       "verification": {"result": "Pass", "reason": "Source inspection verifies the prose correction."},
       "concerns_resolved": {"result": "Pass", "reason": "No earlier substantive concerns remain."}
     },
     "reason": "Corrects a label without changing behaviour.",
     "next_steps": []
   }
   ```

   - Count additions plus deletions across the whole PR. Use single-line reasons and actions. `next_steps` must contain an action unless the outcome is `approve`.

4. **Publish with the helper's `finish --approval`.** Supply the decision, summary and canonical report.
   - Follow [the comment template](templates/github-progress.md) and [writing-voice](../writing-voice/SKILL.md). Supply the compact high-level assessment and research/approach folds before grouped findings. Derive them from the completed report, including validated reused research. The helper inserts Next steps after the assessment folds and keeps the seven approval checks inside Full report.
   - Submit verified new bugs inline as a COMMENT review, using the report's finding IDs and valid anchors. Link existing concerns. Keep unanchored findings in the summary.
   - For separately requested formal reviews, use [the GitHub review template](templates/github-review.md) and requested status instead. Reuse published findings. Staging leaves the review pending.
   - Before retrying, refresh discussion and CI. Reuse the saved state and unchanged inputs only while the assessment holds. If facts change, inspect this run's existing submission before starting a new assessment. Do not duplicate submitted reviews or edit frozen inputs.

#### Deliverable

Return the comment URL, report path, approval outcome and any incomplete publication steps.

#### This step is complete when:

- [ ] The report, decision and supported inline findings are published, or publication gaps are reported.
- [ ] Existing concerns are linked without duplication.
- [ ] The comment URL, report path and confirmed approval outcome or submission blocker are returned.
