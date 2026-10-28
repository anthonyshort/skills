### Step 3: Code review

When assigned one question as a worker, follow the shared policy and the guidance for that question only. The delegation instructions below belong to the coordinator. Return your assessment without restarting the review or spawning other agents unless your assignment explicitly asks for that.

Use subagents to explore the review questions below. Each subagent must return the named assessment, including checklist results, evidence and reasons for any N/A or blocked checks. The parent agent saves these assessments in the review artefact directory and uses them to create the final report.

Use this guidance to plan the review. Adapt it to the change and investigate other risks when needed. These are not exhaustive checklists.

#### Subagent best practices

- **Give each agent a clear brief**: Include its question, scope, research, CI evidence and exact guidance paths. Pass on the no-install and no-local-check rules.
- **Ask agents to use relevant skills**: Tell each subagent to inspect the available skills in [best-practices](../../best-practices/) and select those relevant to its task. Use their descriptions rather than a fixed list of skill names. Ask it to build a task-specific verification checklist using the process below.
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

Use [split-pr](../../split-pr/SKILL.md) when a detailed slicing plan would help. During review, propose the plan without changing code or branches. Either a small end-to-end slice or a group of low-risk preparation changes can be a useful PR.

##### Deliverable

Return a **simplicity assessment** containing:

1. **Verdict**: Reasonably minimal or simplification recommended, with a short rationale.
2. **Proposed simplifications**: For each, identify the current code, the removal or substitution, the complexity removed and how required behaviour is preserved. Explicitly state when no supported simplifications were found.
3. **Justified complexity**: Any complexity that should remain because of a concrete requirement or constraint.
4. **PR scope**: Keep together, simplify or split, with a rationale. If splitting is recommended, name the independently reviewable changes, their dependencies and a viable order.

#### Q: Is this code clear and easy to maintain?

Run a dedicated readability pass using [code-readability](../../best-practices/code-readability/SKILL.md), including its example when assessing extraction, and the [extraction rule](../rules/extract-decisions-only-when-useful.md) where relevant. Focus on how quickly someone can understand, read and scan the code, including tests. Keep architectural redesign and correctness investigations with their respective agents.

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
