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

## Rules

- Do not perform code changes.
- Only mark checklist items done after verifying.
- Explain any N/A or blocked checks.
- Separate current behaviour, accepted conventions, personal preferences and future direction.
- Reading guidance or checklists alone does not complete checks.
- Do not invent product requirements or require speculative future migrations.
- Provide evidence for each claim of correctness and completion.
- Use existing checkouts, Git objects and installed tools.

## Deliverable

- Review report with findings, research, and an assessment.

## How to perform a review

### Step 1: Setup

The review should be done on a local branch. If the branch doesn't exist locally you should clone the repo and branch into a new temporary folder and install dependencies.

Create a temporary folder that can be used to store review and research artefacts in a named directory `~/.cache/pi/reviews/`.

You will need to confirm the review scope and make sure you're reviewing all commits and not just the latest.

#### This step is complete when:
- [ ] There is a local copy of the code being reviewed.
- [ ] Confirm the review scope.
- [ ] There is a temporary folder for review artefacts.

### Step 2: Research

You'll start by assigning a sub-agent to use the [code-research](../code-research/SKILL.md) skill. You need to wait for this agent to finish before continuing. This should be saved to a file in the temporary directory.

You want to make sure you have a clear understanding of the problem being solved and intended behaviour of the change.

Read the final report and resolve review-critical information for correctness. This will help understand the non-functional requirements, intended design, and the problem that is being solved.

#### This step is complete when:
- [ ] **Research completed**: The subagent has completed the research report and written it to a file.
- [ ] **Read research**: You have read the research report.
- [ ] **Verify claims**: You have verified the claims in the research report and made any edits or corrections.
- [ ] **Review scope**: Confirm the target and base; review all commits, not only the latest.
- [ ] **Intent and consumers**: Establish the goal and affected consumers from sources.

### Step 3: Code review

Use subagents to explore the review questions below. Each subagent must return the named assessment, including checklist results, evidence and reasons for any N/A or blocked checks. The parent agent saves these assessments in the review artefact directory and uses them to create the final report.

Use this guidance to plan the review. Adapt it to the change and investigate other risks when needed. These are not exhaustive checklists.

#### Subagent best practices

- **Give each agent a clear brief**: Include its question, review scope, research findings, relevant project instructions and exact guidance paths.
- **Ask agents to use relevant skills**: Tell each subagent to look for and use available skills that would help with its task.
- **Keep context focused**: Give agents what they need for their task. Report templates and writing voice belong to the parent.
- **Use parallel work after research**: Once Step 2 is complete, independent review tasks can run together within the available agent limit.
- **Group work by review question**: Avoid creating an agent for every file or skill. Use a subagent to answer each review question below.
- **Let agents reach their own conclusions**: Describe the question and relevant context without steering the agent towards a preferred finding.
- **Follow up when needed**: Ask agents to investigate weak evidence, unanswered questions or newly discovered risks.

#### Review best practices

- **Look beyond the diff**: Check real callers, code ownership and similar implementations when they affect the conclusion.
- **Show API changes through caller code**: When proposing an API change, show before-and-after caller code. Explain what becomes clearer or what bookkeeping disappears, including error handling and cleanup where relevant.
- **Understand what must stay the same**: Establish the behaviour that alternatives must preserve before recommending a simpler design.
- **Ask only when the answer matters**: Ask about missing requirements or direction when they could change the assessment. Explain the alternatives, their effects and your recommendation when a choice needs input. Continue other review work while waiting.
- **Follow the risk**: Spend more time on behaviour with a high cost of failure, complex dependencies or weak test coverage. Give simpler changes a lighter review.

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

You should make sure this is the most minimal code needed to solve the problem. We ideally want PRs to be small and independent. If the PR is large (>500 LOC) we should consider splitting the PR.

Some things to look for:

- Are there unnecessary tests, comments, or code formatting changes?
- Can we leverage existing functions, types, or other code instead of reinventing the wheel (when the cost of reuse is also low)
- Is there a library we could use instead of rolling it ourselves?
- Is this PR trying to do too much at once? Should it be split up?

##### Verification checklist

- [ ] **Complexity assessment**: Count concepts, not just lines. Consider the responsibilities, abstractions and dependencies introduced by the change. Identify unnecessary complexity and explain its cost.
- [ ] **Simplifications**: Propose concrete removals or substitutions, showing how they preserve the required behaviour.
- [ ] **Scope assessment**: Recommend keeping the PR together or splitting it; where splitting helps, identify independently reviewable changes and their dependencies.
- [ ] **Recommendation**: State whether the implementation is reasonably minimal, including any complexity justified by the requirements.

##### Deliverable

Return a **simplicity assessment** containing:

1. **Verdict**: Reasonably minimal or simplification recommended, with a short rationale.
2. **Proposed simplifications**: For each, identify the current code, the removal or substitution, the complexity removed and how required behaviour is preserved. Explicitly state when no supported simplifications were found.
3. **Justified complexity**: Any complexity that should remain because of a concrete requirement or constraint.
4. **PR scope**: Keep together or split, with a rationale. If splitting is recommended, name the independently reviewable changes, their dependencies and a viable order.

#### Q: Is this code clear and easy to maintain?

Review how easy the code is to read and navigate. Recommend changes that make purpose and ownership clearer. Distinguish project conventions from personal preferences.

##### Verification checklist

- [ ] **Names**: Check that files, folders, functions and variables clearly describe their purpose.
- [ ] **File organisation**: Check that files are placed intentionally and the folder hierarchy makes ownership clear. Avoid unnecessary nesting or fragmentation.
- [ ] **Readability**: Look for confusing control flow, nesting and indirection. Can we split large blocks into smaller functions to make it easier to read and follow?
- [ ] **Comments**: Check that comments explain intent or surprising behaviour and follow project conventions.
- [ ] **Formatting**: Check consistency with the project's style and formatting rules.

##### Deliverable

Return a **readability assessment** containing:

1. **Verdict**: Clear and easy to maintain, or improvements recommended, with a short reason.
2. **Names and placement**: Explain any unclear names, misplaced files or folder structures that hide ownership. Include source locations and concrete alternatives.
3. **Readability and style**: Identify code, comments or formatting that make the change harder to understand. Distinguish broken conventions from preferences.
4. **Recommended changes**: Explain what each change would make clearer or simpler. State when no improvements are supported.

#### Q: Is this implementation correct?

You want to make sure the implementation is correct. Be comprehensive here and trace code callers and look for issues.

- Are there test cases covering the important APIs?
- Are there any bugs with the code?
- Does this code follow the best practices?
- Do the lint, test, format, and typechecking tasks pass?
- Can you follow the callers and confirm that surrounding code won't break?
- Do tests use the right inputs and expect the correct outputs?

##### Verification checklist

- [ ] **Behaviour verification**: Trace important success and failure paths through real callers, recording expected behaviour and supporting evidence.
- [ ] **Findings**: Report defects with their trigger, consequence, source location and a reproduction or code trace.
- [ ] **Counterexamples**: Try inputs and boundary cases that could expose incorrect behaviour in the changed logic.
- [ ] **Test correctness**: Verify that tests use the right inputs and assert the intended outputs. Check expected values, fixtures and mocks independently of the implementation. Passing tests can encode a bug by expecting the wrong result or testing the wrong behaviour.
- [ ] **Test coverage**: Identify meaningful gaps in regression coverage.
- [ ] **Root cause**: Trace bugs to their source and check that the fix addresses the cause rather than hiding a symptom.
- [ ] **Runtime wiring**: Check inputs, configuration and connections that could compile but fail at runtime.
- [ ] **CI coverage**: Confirm new tests actually run in CI and generated files are checked for missing or outdated output.
- [ ] **Validation results**: Record the lint, test, format and typechecking commands run, their results, and any blocked or skipped checks.
- [ ] **Confidence and gaps**: State what was verified, what remains uncertain and how those gaps affect the assessment.

##### Deliverable

Return a **correctness assessment** containing:

1. **Verdict**: No defects found within the verified scope, defects found, or insufficient evidence, with a short rationale. Passing checks alone do not establish correctness.
2. **Verified behaviour**: The success and failure paths traced, their callers, expected outcomes and evidence.
3. **Findings**: Supported defects and unresolved questions with locations, triggers, effects, evidence and recommended actions. Explicitly state when no defects were found.
4. **Validation results**: A table of exact commands, results and relevant failure details. Include checks not run and why.
5. **Coverage gaps**: Missing regression coverage, unverified behaviour and the effect of these gaps on confidence.

### Step 4: Check review rules

Use a separate subagent to check each relevant rule against the change. This gives each agent one focused task.

#### Select the rules

Read [the rule index](rules/README.md) and select rules that apply to the change. Record why other rules do not apply.

#### Assign the checks

Give each subagent:

- The rule file.
- The repository location, base and head revisions, and diff.
- Relevant project instructions.
- Any requirements or decisions needed to judge that rule, with sources. Do not include the full research report unless needed.

Run agents in batches within the available agent limit.

#### Guidance for rule agents

- **Start with the diff**: Read surrounding code, callers and similar implementations when needed to check the rule.
- **Check the exceptions**: A matching code pattern does not automatically mean there is a problem.
- **Support the result**: Explain what you checked and cite the evidence.
- **Report missing context**: If a requirement or decision could change the result, ask for it or mark the check as not verified.

#### Deliverable

Each subagent returns a **rule assessment** containing:

- **Rule**: The rule name and file.
- **Result**: Satisfied, concern found, not applicable or not verified.
- **Evidence**: Code locations and the behaviour or relationships checked.
- **Finding**: The problem, its effect and a recommended change, if supported.
- **Limits**: Missing information or behaviour that could not be verified.

The parent saves the assessments in the review artefact directory. Include their results in the final report alongside the broader code review assessments. Merge duplicate findings during consolidation.

### Step 5: Create the final review report

The parent agent combines the research report, all Step 3 assessments and the Step 4 rule assessments into one final review report.

#### Rules for a good report

- The report must make sense without opening the worker reports.
- Include the research, evidence and conclusions needed to understand the review.
- Do not just copy findings from the subagent reports. Use their evidence to reach your own conclusions.
- Back up important claims with code locations, requirements or check results.
- Separate bugs, existing conventions, personal preferences and open questions.
- Keep wider improvements separate from required fixes. A possible future change is not a reason to block the PR.
- Say what is uncertain and what was not checked. Missing evidence does not mean a check passed.
- Do not invent findings or praise to fill the template. Remove empty finding sections.

#### Create the report

1. **Read the inputs**: Read the research report, every Step 3 assessment and every Step 4 rule assessment. Wait for agents that are still working. Note any failed or missing assessments.
2. **Check the agents' claims**: Check important claims against the code, requirements and test results. Note anything you could not verify.
3. **Merge duplicate findings**: Combine findings about the same issue. Keep the evidence and any different effects. Link issues already raised in PR comments instead of drafting duplicate comments.
4. **Resolve disagreements**: Use evidence to decide between conflicting conclusions. If you cannot resolve a disagreement, record it as an open question or a gap in the review.
5. **Reach an overall conclusion**: Decide whether the change solves the right problem, fits the system, is simple enough, is easy to maintain and works correctly. Say whether the PR should be split. Separate required fixes, suggestions and wider improvements.
6. **Write the report**: Use [the review report template](assets/review-report.md). Save the report to `<review artefact directory>/review-report.md` and return its path.

#### Deliverable

One completed `review-report.md` file saved in the review artefact directory. Fill in the [review report template](assets/review-report.md) and return the file path.

#### This step is complete when:

- [ ] All review inputs are included or noted as missing.
- [ ] Important claims have been checked. Duplicate findings are merged. Disagreements are resolved or recorded as open questions.
- [ ] The report gives the parent's conclusions instead of joining worker reports together.
- [ ] The report contains enough background and evidence to make sense on its own, including what was not verified.
- [ ] Every selected check has a result. All template placeholders are filled in or removed with their optional sections.
- [ ] The report is saved and its path is returned to the user.

### Step 6: Publish the GitHub review (optional)

Run this step only when the user requests staging or publishing a review on the target PR.

#### Rules

- Use the final report as the source of findings.
- Keep existing pending comments and avoid duplicates.
- Staging leaves the review pending. Submit only when requested. Use the requested review status. Ask if the submission status is still unclear.

#### Prepare and publish the review

1. **Check the PR**: Read the current head, diff, review threads and any pending review. If the code has changed, check that the findings still apply.
2. **Draft the review**: Fill in [the GitHub review template](assets/github-review.md). Use [writing-voice](../writing-voice/SKILL.md) for the body and inline comments. Apply any supplied profile's GitHub layout.
3. **Stage or submit**: Recheck the head and comments before writing. Update stale findings or anchors, then take the requested action. If an action partly fails, check what was saved before retrying.
4. **Return the result**: Return the review link and say whether the review is pending or submitted. Report any action that failed or remains incomplete.

#### Deliverable

A pending or submitted GitHub review on the target PR, as requested. Return its link and status.
