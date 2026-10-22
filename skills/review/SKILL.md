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

To perform the review **you will use subagents to explore various dimensions of the change**. Will will examine this change from a high-level first and work our way down. For each subagent assign clear scope, context, guidance, and checks.

You should use a subagent to answer each of these questions:

Each subagent must return the named assessment below, including verification checklist outcomes with evidence and reasons for any N/A or blocked checks. The main agent saves these assessments in the review artefact directory and uses them to produce the final report. These are review results, not implementation plans; do not manufacture findings to fill a section.

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

##### Verification checklist

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

- [ ] **Complexity assessment**: Identify unnecessary abstractions, indirection, dependencies or unrelated changes, explaining the cost they introduce.
- [ ] **Simplifications**: Propose concrete removals or substitutions, showing how they preserve the required behaviour.
- [ ] **Scope assessment**: Recommend keeping the PR together or splitting it; where splitting helps, identify independently reviewable changes and their dependencies.
- [ ] **Recommendation**: State whether the implementation is reasonably minimal, including any complexity justified by the requirements.

##### Deliverable

Return a **simplicity assessment** containing:

1. **Verdict**: Reasonably minimal or simplification recommended, with a short rationale.
2. **Proposed simplifications**: For each, identify the current code, the removal or substitution, the complexity removed and how required behaviour is preserved. Explicitly state when no supported simplifications were found.
3. **Justified complexity**: Any complexity that should remain because of a concrete requirement or constraint.
4. **PR scope**: Keep together or split, with a rationale. If splitting is recommended, name the independently reviewable changes, their dependencies and a viable order.

#### Q: Is this implementation correct?

You want to make sure the implementation is correct. Be comprehensive here and trace code callers and look for issues.

- Are there test cases covering the important APIs?
- Are there any bugs with the code?
- Does this code follow the best practices?
- Do the lint, test, format, and typechecking tasks pass?
- Can you follow the callers and confirm that surrounding code won't break?
- Do passing tests can encode the implementation's mistake?

##### Verification checklist

- [ ] **Behaviour verification**: Trace important success and failure paths through real callers, recording expected behaviour and supporting evidence.
- [ ] **Findings**: Report defects with their trigger, consequence, source location and a reproduction or code trace.
- [ ] **Test coverage**: Assess whether tests establish the intended behaviour independently of the implementation, identifying meaningful regression gaps.
- [ ] **Validation results**: Record the lint, test, format and typechecking commands run, their results, and any blocked or skipped checks.
- [ ] **Confidence and gaps**: State what was verified, what remains uncertain and how those gaps affect the assessment.

##### Deliverable

Return a **correctness assessment** containing:

1. **Verdict**: No defects found within the verified scope, defects found, or insufficient evidence, with a short rationale. Passing checks alone do not establish correctness.
2. **Verified behaviour**: The success and failure paths traced, their callers, expected outcomes and evidence.
3. **Findings**: Supported defects and unresolved questions using the finding fields specified in “Create the review report”. Explicitly state when no defects were found.
4. **Validation results**: A table of exact commands, results and relevant failure details. Include checks not run and why.
5. **Coverage gaps**: Missing regression coverage, unverified behaviour and the effect of these gaps on confidence.

### Create the review report

Reconcile concerns, preserve wider opportunities and verification gaps, and apply the selected output guidance.

Keep severity separate from scope: a broader design opportunity is not automatically a defect or blocker.

Separate current failures, supported conventions, preferences, direction and questions.

List each skill/reference actually used and the status/result.

For each: source location, category (defect/convention/preference/question), severity, trigger, consequence, concrete evidence, recommendation and any limits. A source line outside the diff is valid evidence; do not invent an inline anchor. An empty list is valid.

Label **PR-scoped improvement** or **broader opportunity** separately from severity.

State evidence gaps or no supported redesign instead of manufacturing advice.

For each design and direction opportunity: product/direction/design lens, current friction, alternative, before/after consumer usage where relevant, preserved behaviour, complexity removed, affected consumers, migration cost, feasible first step, and why this change is an opportunity. Label **PR-scoped improvement** or **broader opportunity** separately from severity. State evidence gaps or no supported redesign instead of manufacturing advice.

#### Finding severity

Use this table to categorise findings:

| Severity | Use for | Action |
| --- | --- | --- |
| P0 | Show-stopping failure: broken behaviour, a blocking performance problem, a leak, or a crash | Request changes when submission is authorised |
| P1 | Wrong success-path behaviour, expensive work repeating after success, or an approach needing substantial revision | Address; a feature flag may limit impact |
| P2 | Potential issues, rare edge cases, and unlikely retries | Recommend or ask a focused question |

- Cheap retries such as settling or status checks are not P1. Rare encode loops on empty/error paths remain P2; verify that expensive work actually repeats after success before assigning P1.
- When safety depends on current callers, resolution, or data rather than a contract guarantee, raise a short P2 question naming the alternative. Do not drop it merely because today's path is safe.
- Keep confirmed failures distinct from questions. Put P0 and P1 findings needing correction in Required fixes; reserve Suggestions for non-blocking recommendations. Put purely aesthetic preferences in a separate Nits section. Do not praise or invent findings for clean files.
- Keep severity, evidence and assessment explicit in the saved report. Preserve impact and certainty in conversational comments without forcing a priority prefix. Honour caller-supplied severity conventions where they differ.


## Reference files and skills

There are a number of skills and reference files that can be used by subagents while they are reviewing code. This table should be passed to subagents.

| Change or risk | Select for its owner |
| --- | --- |
| Interactions, ownership, state/effects, shared patterns, APIs or migrations | [Design review](../design-review/SKILL.md) |
| React components, hooks, JSX | [React](../react-best-practices/SKILL.md) |
| TypeScript or JavaScript logic | [TypeScript](../typescript-best-practices/SKILL.md) |
| CSS | [CSS](../css-best-practices/SKILL.md) |
| tRPC procedures or clients | [tRPC](../trpc-best-practices/SKILL.md) |
| Valtio stores | [Valtio](../valtio-best-practices/SKILL.md) |
| HTML, browser APIs, web tooling | [Web development](../web-development-best-practices/SKILL.md) |
| New modules, moved responsibilities, dependencies, reuse or abstractions | [Architecture](../architecture-best-practices/SKILL.md) |
| Function/module APIs, hooks, events, plugins, HTTP contracts, compatibility or retries | [API design](../api-design-best-practices/SKILL.md) |
| Failure propagation, recovery, logging or multi-step updates | [Error handling](../error-handling-best-practices/SKILL.md) |
| Hot paths, repeated work, resource growth or background lifecycle | [Performance](../performance-best-practices/SKILL.md) |
| Permissions, trust boundaries, data exposure, resource access, logs, analytics or telemetry | [Security](../security-best-practices/SKILL.md) |
| Tests, changed behaviour, regressions, acceptance rules or integration paths | [Testing](../testing-best-practices/SKILL.md) |

## Sub-agent best practices

- Read [reviewer contract](references/reviewer-contract.md) before briefing workers. Supply its exact path, the final brief, scope, applicable project/operational constraints, profile overrides, assigned check categories and exact guidance paths. The scoped agents use replacement prompts with skills, extensions and conversation inheritance disabled; they do not automatically inherit project instructions. Include necessary constraints or exact relevant source paths explicitly rather than assuming ambient context. Include the relevant categories from [behaviour, design and build checks](references/review-checks.md). Keep runtime context narrow: do not inherit the whole conversation or send reporting templates/voice to workers. Respect available concurrency; do not launch one agent per skill or file. Do not invoke a multi-agent workflow tool unless the user explicitly requested that orchestration mechanism.

Workers return findings, proposals, evidence and check outcomes; the main agent persists them. Wait for all assigned workers or explicitly report failed/cancelled/incomplete coverage. Verify important evidence and resolve contradictions instead of voting on confidence. Do not silently cap findings or default missing results to passed.

### Four-level assessment

| Level | Question |
| --- | --- |
| Product | Should we build this, or is there a better solution to the user's task? |
| Direction | Does this align with the future direction and current migration state? |
| Design | Is there a simpler design, and would these APIs be pleasant to use as a library? |
| Correctness | Does the implementation work as expected? |

These are lenses, not a required serial order or four mandatory agents. Establish the behaviour to preserve before recommending alternatives. Correctness and design workers can run concurrently after the research gate. Use [design review](../design-review/SKILL.md) for the design/product/direction method and the assigned [review checks](references/review-checks.md) for concrete correctness, ownership and build coverage.

Inspect real callers, owners and analogous implementations beyond changed lines when they can affect the recommendation. Ask for missing direction only where it changes the judgement; continue independent work. Do not invent product requirements or require speculative future migrations. Keep wider architectural opportunities visible with migration cost and a feasible first step, separate from present defects and nits. No supported redesign is a valid result.

At synthesis, read [review output](references/review-output.md), then the supplied profile output reference if any. Only the main agent loads report templates and the selected writing voice. Preserve profile layout precedence, evidence, severity, provenance and all selected checklist outcomes. Return a supported assessment at all four levels, not a concatenation of worker reports.
