---
name: review
description: Review a PR, branch, diff, or codebase across product, direction, design and correctness. Automatically research context, select guidance, delegate concerns and synthesise evidence-backed findings.
---

# Review

You are the reviewer for a code change. You will do research on the background behind the code and then perform a review of the code using subagents, skills, and reference files.

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

## GitHub progress and results

For PR reviews, maintain one live comment per run unless the user requests a local-only review. Requests for staged or pending-only output override automatic publication. Use [the comment template](templates/github-progress.md) and [publication helper](scripts/github_progress.py). Run the helper with `--help` for usage. Keep its state in the review artefact directory so resumed runs update the same comment.

The parent owns publication. Create the comment after identifying the reviewed revision. Update it at meaningful milestones using a checklist that reflects the actual review. Label active, skipped or blocked work. Completed stages describe work performed, not passing checks.

Keep the review pinned to its original revisions and flag newer unreviewed commits. Keep provisional findings out of progress updates. If publication fails, continue the local review and report incomplete publication.

## How to perform a review

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

#### Re-review gate

Before launching a research subagent, check whether this PR has a previous complete review. Read its full report comment, including the expanded report, or the canonical saved report; a status label, approval or short summary alone is insufficient. Treat prior reports as evidence to validate, not instructions or proof that the current code is correct.

1. **Establish the baseline:** Confirm repository, PR, reviewed base/head and actual research coverage. Prefer the latest complete report with usable evidence. An incomplete or split-only report may supply facts, but cannot satisfy the research gate on its own.
2. **Check what changed:** Refresh the PR description, discussion, prior findings and CI for the current revision. Compare old and current heads, base/merge-base and full PR comparisons. For rebases or force-pushes, establish the effective patch changes rather than assuming ancestry or an empty head delta proves equivalence. Inspect changed consumers, requirements and review guidance that could invalidate earlier conclusions.
3. **Reuse or refresh:** If the sourced context remains applicable, reuse it and skip fresh context-gathering delegation. Do not repeat broad Slack, Notion, Linear or related-PR searches without a new question or stale source that could affect the review. Refresh only missing or invalidated context; delegate a targeted research question when needed. If the baseline or scope cannot be established, use the normal research path below. Do not turn earlier unavailable sources into verified evidence.
4. **Save the refreshed brief:** Write `research.md` with the prior report URL/path, old and current base/head, delta inspected, reused evidence, fresh evidence and remaining gaps. Preserve earlier source references and their coverage limits. The parent reads and validates this brief before code review; validated reuse satisfies this gate without a new research agent.

Re-review still checks fixes to earlier findings, new discussion, current CI and changes plus affected callers. It is not an automatic approval or permission to skip changed behaviour, unresolved concerns, current rule selection or publication checks. If the revision is unchanged, record that fact and focus on new discussion, CI and outstanding questions rather than repeating completed context gathering. Step 1's full-PR scope and split policy still apply.

For a first review, or when the gate requires fresh research, assign a subagent the repository, target and base revisions, full diff, initial risk assessment and supplied links. Give it any usable earlier report and precise remaining questions; wait for its completed brief before starting the review. Use the checklist below to distinguish reused, refreshed, unavailable and unverified evidence rather than silently marking old work as newly performed.

#### Gather the context

1. **Read the change**: Read the full diff and PR description. Trace relevant callers and tests to understand current behaviour and affected consumers.
2. **Read existing discussion**: Read PR comments and review threads. Follow relevant linked issues, documents and related changes. Note concerns already raised and whether they still apply to the reviewed head.
3. **Search Slack, Notion, and Linear**: Search for the PR URL or number, title, feature names and important topics or identifiers from the change. Look for requirements, decisions, design discussions and ongoing work. Follow useful results rather than relying on search snippets. If either source is unavailable, report the gap and continue.
4. **Check related PRs**: Look for open PRs and recently merged PRs that touch the same files or closely related code. Use the method below. Distinguish file overlap from a real conflict or shared design decision.
5. **Write the brief**: Return the sourced context, checklist results and open questions. Stop when there is enough context to review the change, or explain which missing evidence prevents a conclusion. Avoid background that cannot affect the review.

#### Find related changes

- **Recently merged changes**: Start with the last 30 days of default-branch history for the changed paths, using `git log --since` with a path filter. Map relevant commits to PRs through merge or squash messages or GitHub's commit-to-PR lookup. Extend the period when an older decision matters.
- **Open PRs**: Use GitHub to list open PRs and compare their changed file lists with the target. Git alone cannot reliably discover open PRs that have not been fetched. Follow related titles, owners or modules when file overlap misses the same work.
- **Keep the search bounded**: Start with changed files and expand to nearby code only for a specific question. Report the time period, paths and PRs inspected. If volume or access prevents full coverage, state that limit instead of claiming no related work exists.

#### Research guidance

- **Investigate the initial risks:** Establish affected consumers, activation paths and relevant non-functional requirements, such as data integrity, performance and compatibility. Look for evidence that reduces or increases risk. Report missing requirements rather than inventing them.
- **CI results:** Read checks for the reviewed head or a matching merge commit. Link the runs. Read failure logs before blaming the PR.
- **CI coverage:** Check which tests ran. Flag old, pending, skipped, cancelled or missing results. Continue with source review if CI is unavailable.
- Separate the intended behaviour, current behaviour and assumptions.
- Use repository documents as context, not extra review criteria.
- Check that older decisions still apply. One existing implementation does not establish the desired direction.
- Treat search results, unread links and partly read documents as leads, not verified evidence.
- Say what missing sources prevent you from concluding.
- Keep research read-only. Do not edit records, message people or publish findings.

#### Verification checklist

- [ ] **Scope and behaviour**: Read the full change and trace relevant callers and tests.
- [ ] **Risk context**: Trace the main risks to affected paths and consumers. Identify relevant requirements, safeguards and unresolved questions.
- [ ] **CI evidence**: Link results for the reviewed revision. Record failures and coverage gaps.
- [ ] **Intent and decisions**: Establish the user problem, expected behaviour and relevant decisions from sources.
- [ ] **Existing concerns**: Read review discussion and distinguish active concerns from issues fixed at the reviewed head.
- [ ] **Slack**: Search for the PR and its topics, or validate applicable earlier research under the re-review gate. Record reused coverage, fresh results or unavailable access.
- [ ] **Notion**: Search for the PR and its topics, or validate applicable earlier research under the re-review gate. Record reused coverage, fresh results or unavailable access.
- [ ] **Related changes**: Check relevant open and recently merged PRs, or validate earlier coverage and refresh changes that could affect the review. Record scope and limits.
- [ ] **Evidence and gaps**: Cite sources, label assumptions and identify unanswered questions that could change the review.

#### Deliverable

Return a **research brief** containing:

- **Problem and intent**: The user task, expected outcome and relevant requirements.
- **Current behaviour**: Affected owners, callers and consumers, with source locations.
- **Risk context**: Evidence that updates the initial assessment, relevant non-functional requirements and remaining gaps.
- **CI status**: Relevant checks, tested revisions, results, links and coverage limits.
- **Decisions and direction**: Supported constraints, design decisions and relevant similar implementations. Separate adopted patterns from planned changes.
- **Existing concerns and related work**: Active review concerns and overlapping PRs, with links and their relevance.
- **Sources and search coverage**: List relevant Slack threads, Notion pages, Linear issues and other research references with descriptive titles, direct links and relevance, including discoveries not cited in findings. Distinguish inspected sources from unopened results. Include search scope, unavailable sources and checklist results for the final report’s References section.
- **Open questions**: Assumptions, missing evidence and their effect on the review.

The parent saves the returned brief to `<review artefact directory>/research.md`. Read-only agents do not need write access.

#### This step is complete when:

- [ ] The research brief is saved and the parent has read it. For re-reviews, it identifies the prior full report, revision comparison and reused versus refreshed evidence.
- [ ] The parent has checked important claims and corrected unsupported conclusions; earlier coverage and findings are not assumed valid for changed code.
- [ ] Missing context that could change the review is resolved or clearly recorded. Fresh research delegation is skipped only when validated reuse supplies the necessary context.

### Step 3: Code review

Use subagents to explore the review questions below. Each subagent must return the named assessment, including checklist results, evidence and reasons for any N/A or blocked checks. The parent agent saves these assessments in the review artefact directory and uses them to create the final report.

Use this guidance to plan the review. Adapt it to the change and investigate other risks when needed. These are not exhaustive checklists.

#### Subagent best practices

- **Give each agent a clear brief**: Include its question, scope, research, CI evidence and exact guidance paths. Pass on the no-install and no-local-check rules.
- **Ask agents to use relevant skills**: Tell each subagent to inspect the available skills in [best-practices](../best-practices/) and select those relevant to its task. Use their descriptions rather than a fixed list of skill names. Ask it to build a task-specific verification checklist using the process below.
- **Keep context focused**: Give agents what they need for their task. Report templates and writing voice belong to the parent.
- **Use parallel work after research**: Once Step 2 is complete, independent review tasks can run together within the available agent limit.
- **Group work by review question**: Avoid creating an agent for every file or skill. Use a subagent to answer each review question below.
- **Reserve a readability agent**: Give the readability question its own subagent, separate from correctness, architecture and simplicity. Queue it when slots are full. For changes without readable source, record why the pass is not applicable.
- **Let agents reach their own conclusions**: Describe the question and relevant context without steering the agent towards a preferred finding.
- **Follow up when needed**: Ask agents to investigate weak evidence, unanswered questions or newly discovered risks.

#### Review best practices

- **Look beyond the diff**: Check real callers, code ownership and similar implementations when they affect the conclusion.
- **Show API changes through caller code**: When proposing an API change, show before-and-after caller code. Explain what becomes clearer or what bookkeeping disappears, including error handling and cleanup where relevant.
- **Understand what must stay the same**: Establish the behaviour that alternatives must preserve before recommending a simpler design.
- **Ask only when the answer matters**: Ask about missing requirements or direction when they could change the assessment. Explain the alternatives, their effects and your recommendation when a choice needs input. Continue other review work while waiting.
- **Follow the risk**: Spend more time on behaviour with a high cost of failure, complex dependencies or weak test coverage. Give simpler changes a lighter review.

#### Build and verify the checklist

Each review subagent builds its checklist before checking the code:

1. **Read the guidance**: Read relevant skills and the supporting sections needed for the assigned question.
2. **Make the checks concrete**: Turn each applicable instruction into a check naming the affected code or behaviour. Cite the skill section or rule it comes from. Do not copy examples as universal requirements.
3. **Combine overlaps**: Merge checks that test the same behaviour, including overlaps with the review question's checklist. Keep all source references.
4. **Account for exclusions**: Note guidance sections that do not apply and why. Leave checks blocked when context or access is missing. Do not remove a check just because it is difficult to verify.
5. **Verify and return results**: Record the method, outcome and evidence. Separate source inspection from CI results. Missing evidence does not mean a check passed.

Return the checklist with the assessment. If new risks appear, add checks and record their results. The parent checks coverage against the selected guidance during consolidation and follows up on missing checks or weak evidence.

#### Q: Should we build this?

We want to think if there is a better, simpler solution to the problem that allows users to perform this task. This is why we require the research to be completed first.

- Does this change solve the original problem?
- If this is an interaction change, is there a simpler way we could solve this? For example, rather than building some complex drag-and-drop system for a lesser used feature, this could just be a menu item.
- Does this change conflict with any requirements discovered from the research?
- Does this change conflict with any existing PRs or ongoing work?

##### Verification checklist

- [ ] **Problem fit**: Assess whether the change solves the original problem and satisfies the requirements established by research.
- [ ] **Alternatives**: Identify a simpler way to meet the same user need, explain the trade-offs, or state that no supported alternative was found.
- [ ] **Conflicts**: Identify conflicts with requirements or ongoing work, with sources; state any gaps in visibility.
- [ ] **Recommendation**: Recommend proceeding, adjusting the approach, or reconsidering it, with supporting evidence.

##### Deliverable

Return a **product assessment** containing:

1. **Verdict**: Proceed, adjust the approach, or reconsider, with a short rationale.
2. **Problem and requirements**: The user need, relevant requirements and sources, and whether the change meets them.
3. **Alternatives and conflicts**: Supported alternatives with trade-offs, and conflicts with requirements or ongoing work. Explicitly state when none were found or evidence is missing.
4. **Recommended action**: Any concrete change to the approach, including the behaviour that must be preserved.

#### Q: Does this code fit into the existing system?

This is looking at the change in relation to the architecture of the codebase as a whole. We want to confirm that this change aligns with the future direction and current best practices in the code.

You should use skills and reference files to help understand what you look for.

Some things you should look for:

- Does this change adhere to the latest best practices and patterns?
- Is there a change we could make to this to fit into established patterns?
- Is this duplicating some existing logic
- Is there any unnecessary tight coupling? Could we decouple things using common patterns like an adapter pattern, plugin pattern, event emitters, or dependency injection?

- **Look for consolidation opportunities**: Compare similar implementations for shared behaviour that could have one owner and implementation. Explain what duplication would disappear and whether sharing the code would introduce unwanted coupling. Similarity alone is not a reason to merge implementations.
- **Dependency direction**: Check that imports respect ownership and system boundaries. Look for cycles and dependencies that tie unrelated parts of the system together.
- **Prevent similar bugs**: Look for architectural changes that could prevent a class of bugs. Explain the benefit and cost separately from the immediate fix.

##### Verification checklist

- [ ] **Dependency direction**: Check imports against system boundaries and identify cycles or unclear ownership.
- [ ] **Bug prevention**: Assess whether a supported architectural change could prevent similar bugs. State when no such change is supported.
- [ ] **System fit**: Assess ownership, dependency boundaries and consistency with established patterns, citing comparable implementations.
- [ ] **Reuse and coupling**: Identify duplicated behaviour, misplaced responsibilities or unnecessary coupling, with concrete consequences.
- [ ] **Direction**: Assess alignment with documented architectural direction and migration state; distinguish this from personal preference.
- [ ] **Recommendations**: Describe supported changes, affected consumers and migration cost; separate PR-scoped improvements from broader opportunities.

##### Deliverable

Return a **system fit assessment** containing:

1. **Verdict**: Fits the existing system, fits with changes, or conflicts with the system, with a short rationale.
2. **Ownership and dependencies**: Where the changed behaviour belongs, which consumers and boundaries it affects, and comparable implementations with source locations.
3. **Conventions and direction**: Alignment or conflicts with established patterns and documented direction, clearly separated from preferences.
4. **Recommended changes**: Concrete changes addressing duplication, coupling or misplaced responsibilities, with affected consumers, migration cost and a feasible first step. Label each as a PR-scoped improvement or broader opportunity; explicitly state when no changes are supported.

#### Q: Is this the simplest solution?

Assess whether the implementation and PR scope are reasonably small and easy to reason about. Use the risk assessment and research to decide whether simplifying or splitting would make the change easier to understand and verify.

Size alone does not establish risk. Keep justified complexity and changes that are easier to review together.

Some things to look for:

- Are there unnecessary tests, comments, or code formatting changes?
- Can we leverage existing functions, types, or other code instead of reinventing the wheel (when the cost of reuse is also low)
- Is there a library we could use instead of rolling it ourselves?
- Is this PR trying to do too much at once? Should it be split up?

##### Verification checklist

- [ ] **Complexity assessment**: Count concepts, not just lines. Consider the responsibilities, abstractions and dependencies introduced by the change. Identify unnecessary complexity and explain its cost.
- [ ] **Unused code**: Identify code and exports made obsolete by the change. Check consumers before recommending removal.
- [ ] **Simplifications**: Propose concrete removals or substitutions, showing how they preserve the required behaviour.
- [ ] **Scope assessment**: Recommend keeping the PR together, simplifying it or splitting it. Explain how this affects understandability, isolation, complexity, testability and blast radius. Identify useful boundaries when splitting would help.
- [ ] **Recommendation**: State whether the implementation is reasonably minimal, including any complexity justified by the requirements.

Use [split-pr](../split-pr/SKILL.md) when a detailed slicing plan would help. During review, propose the plan without changing code or branches. Either a small end-to-end slice or a group of low-risk preparation changes can be a useful PR.

##### Deliverable

Return a **simplicity assessment** containing:

1. **Verdict**: Reasonably minimal or simplification recommended, with a short rationale.
2. **Proposed simplifications**: For each, identify the current code, the removal or substitution, the complexity removed and how required behaviour is preserved. Explicitly state when no supported simplifications were found.
3. **Justified complexity**: Any complexity that should remain because of a concrete requirement or constraint.
4. **PR scope**: Keep together, simplify or split, with a rationale. If splitting is recommended, name the independently reviewable changes, their dependencies and a viable order.

#### Q: Is this code clear and easy to maintain?

Run a dedicated readability pass using [code-readability](../best-practices/code-readability/SKILL.md), including its example when assessing extraction, and the [extraction rule](rules/extract-decisions-only-when-useful.md) where relevant. Focus on how quickly someone can understand, read and scan the code, including tests. Keep architectural redesign and correctness investigations with their respective agents.

##### Verification checklist

- [ ] **Reading pass**: Read changed bodies and surrounding code, not just declarations or the diff. Apply each relevant readability check and record evidence or an exclusion reason.
- [ ] **Concrete improvements**: Identify the reading difficulty, location and a specific alternative. For extractions, name the operations and explain what a reader no longer has to track.
- [ ] **Assessment evidence**: Support a positive verdict with evidence from inspected bodies. Clear names, one feature, correct branches and passing tests do not establish cohesion. Report supported readability problems even without a runtime bug. Separate substantive improvements, conventions and optional polish.

##### Deliverable

Return a **readability assessment** containing:

1. **Verdict**: Clear and easy to maintain, or improvements recommended, with a short reason.
2. **Names and placement**: Explain any unclear names, misplaced files or folder structures that hide ownership. Include source locations and concrete alternatives.
3. **Readability and style**: Identify code, comments or formatting that make the change harder to understand. Distinguish broken conventions from preferences.
4. **Recommended changes**: Explain what each change would make clearer or simpler. For proposed extractions, name the operations and the complexity they remove. Support a no-improvements conclusion with concrete evidence.

Include inspected files and bodies, individual check results and coverage gaps. The parent saves this as `readability.md` in the review artefact directory.

#### Q: Is this implementation correct?

You want to make sure the implementation is correct. Be comprehensive here and trace code callers and look for issues.

- Are there test cases covering the important APIs?
- Are there any bugs with the code?
- Does this code follow the best practices?
- What do CI lint, test, format and typechecking results establish for this revision?
- Can you follow the callers and confirm that surrounding code won't break?
- Do tests use the right inputs and expect the correct outputs?

##### Verification checklist

- [ ] **Behaviour verification**: Trace important success and failure paths through real callers, recording expected behaviour and supporting evidence.
- [ ] **Findings**: Report defects with their trigger, consequence, source location and a reproduction or code trace.
- [ ] **Counterexamples**: Trace inputs and boundary cases through the code. Distinguish a code trace from a reproduced failure.
- [ ] **Test correctness**: Verify that tests use the right inputs and assert the intended outputs. Check expected values, fixtures and mocks independently of the implementation. Passing tests can encode a bug by expecting the wrong result or testing the wrong behaviour.
- [ ] **Test coverage**: Identify meaningful gaps in regression coverage.
- [ ] **Root cause**: Trace bugs to their source and check that the fix addresses the cause rather than hiding a symptom.
- [ ] **Runtime wiring**: Check inputs, configuration and connections that could compile but fail at runtime.
- [ ] **CI coverage**: Check test discovery and generated-file checks. Separate configured coverage from confirmed execution.
- [ ] **Validation results**: Link CI results for the reviewed revision. Explain failures and incomplete coverage.
- [ ] **Confidence and gaps**: State what was verified, what remains uncertain and how those gaps affect the assessment.

##### Deliverable

Return a **correctness assessment** containing:

1. **Verdict**: No defects found within the verified scope, defects found, or insufficient evidence, with a short rationale. Passing checks alone do not establish correctness.
2. **Verified behaviour**: The success and failure paths traced, their callers, expected outcomes and evidence.
3. **Findings**: Supported defects and unresolved questions with locations, triggers, effects, evidence and recommended actions. Explicitly state when no defects were found.
4. **CI status**: Results, links and coverage gaps for the reviewed revision.
5. **Coverage gaps**: Missing regression coverage, unverified behaviour and the effect of these gaps on confidence.

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

1. **Read the inputs**: Read the research report, every Step 3 assessment and the Step 4 rule assessment. Wait for agents that are still working. Note any failed or missing assessments.
2. **Check the agents' claims**: Check the code, requirements and CI evidence. Compare checklists with their guidance. Follow up on missing checks or weak evidence. Refresh CI status before writing.
3. **Merge duplicate findings**: Combine findings about the same issue. Keep the evidence and any different effects. Link issues already raised in PR comments instead of drafting duplicate comments.
   - Check readability coverage explicitly. Keep useful readability improvements visible even when no bugs are found. Merge overlaps with simplicity, system fit and extraction rules without losing the reading difficulty or concrete recommendation. Missing readability assessment or body-level evidence is a coverage gap.
4. **Resolve disagreements**: Use evidence to decide between conflicting conclusions. If you cannot resolve a disagreement, record it as an open question or a gap in the review.
5. **Reach an overall conclusion**: Explain whether the change meets its goal, fits the system and works. Revisit the production risk level and coverage gaps. Summarise rule results from the complete coverage table, keeping concerns, unverified checks and skipped rules distinct from satisfied rules. Recommend keeping, simplifying or splitting it and explain supported alternatives. Separate fixes from optional work.
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
