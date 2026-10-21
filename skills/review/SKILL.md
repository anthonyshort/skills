---
name: review
description: Review a PR, branch, diff, or codebase across product, direction, design and correctness. Automatically research context, select guidance, delegate concerns and synthesise evidence-backed findings.
---

# Review

## Goal

Answer whether the change solves the right problem, fits the intended direction, has a simple design and usable APIs, and works correctly. This is the coordinator: invoking this skill is enough to run the whole workflow. Select and invoke the necessary agents and guidance; do not ask the user to run sub-skills manually.

## Review environment

Code review does not require dependency installation. Apply these constraints to the main agent, context researcher and every delegated reviewer, including when another skill or repository setup guide recommends installation:

- Do not install, update or copy `node_modules`, bootstrap a workspace, or download missing toolchains/packages for a review. This includes automatic installs in a new checkout/worktree and implicit downloads through commands such as `npx`, `pnpm dlx` or Corepack. Dependency installation requires an explicit user request; a request to review or run checks is not that request.
- Prefer the existing checkout, Git object reads and installed local tools. Run scoped checks only when their dependencies are already available and the command will not fetch packages. If dependencies are missing, continue source/test/CI inspection and record which checks could not run; do not install to close the gap or claim equivalent runtime verification.
- Local build, test and typecheck execution is optional, not a review completion or approval requirement. Record unavailable local checks as environment limits, but do not lower merge confidence or withhold approval solely because they could not run. Any confidence reduction must identify a substantive finding or a specific unresolved behavioural question supported by source, tests or other evidence; missing local execution alone is not such a question.
- Keep task-specific scratch files, logs and downloaded diffs in a named directory under `~/.cache/pi/reviews/`, or a user-specified workspace, rather than `/tmp`. Do not clone repositories, create review worktrees or redirect package caches into `/tmp`. Retain the useful research/report artifacts; remove only disposable files you created when they are no longer needed. Never clean unrelated agents' files.
- Give these constraints explicitly in every subagent brief. Review-only worktrees do not need the normal post-creation install step; use `nwt` if an isolated checkout is needed and proceed without installing dependencies.
- Keep reviewed code and documents unchanged unless edits are requested. Saving review artifacts does not authorise source changes. Stage or publish GitHub comments only when requested; staging is not submission.

## Checklist

Track status in task notes, not here. Mark done only after verifying; explain N/A and report blocked or unverified checks. Preserve every selected reference's checks in the coverage record.

**Context-first gate**

- [ ] **Completed context brief** - A dedicated context-gathering subagent has finished its sourced brief; record its location. If delegation is unavailable, gather context yourself first and record that limitation.
- [ ] **Integrated context** - Read the final brief, resolve review-critical missing information, and record the gate as complete before any correctness, design or test-quality review, including your own.

**Scope and context**

- [ ] **Review scope** - Confirm the target and base; review all commits, not only the latest.
- [ ] **Review environment** - Main and delegates use existing tools/dependencies, do not install packages, and keep review scratch work out of `/tmp`; report checks blocked by missing dependencies.
- [ ] **Project instructions** - Read project rules and retain supplied guidance and voice.
- [ ] **Intent and consumers** - Establish the goal and affected consumers from sources.
- [ ] **Existing discussion** - Read review comments and unresolved threads before adding findings.
- [ ] **Skill selection** - Load skills for the changed technologies and risks.

**Delegation and coverage**

- [ ] **Context research** - Complete the blocking context-first phase before launching review agents; give them the integrated brief and applicable guidance.
- [ ] **Review coverage** - Split independent concerns without duplicating coverage.
- [ ] **Reviewer briefs** - Assign clear scope, context, guidance, and checks.
- [ ] **Delegate results** - Require evidence and completed, N/A, and open checks.

**Four-level assessment**

- [ ] **Product outcome** - Assess the user task and whether a simpler product solution could meet it; distinguish missing intent from evidence.
- [ ] **Direction alignment** - Compare supplied direction with current adoption and justified intermediate states.
- [ ] **Design assessment** - Assess simplicity, consistency and consumer API usability, including supported opportunities beyond the diff.
- [ ] **Correctness assessment** - Complete the assigned behaviour, contract, test and build checks with evidence.
- [ ] **Combined judgement** - Reconcile concerns, preserve wider opportunities and verification gaps, and apply the selected output guidance.

## Guidance

### Context-first gate

1. Assign `Explore` a factual research task using the exact [code-research](../code-research/SKILL.md) path, target/base/head, supplied profile and the environment constraints above. Request scope, full diff, intent, consumers, ownership, comparable implementations, available APIs, product/RFC and rollout direction, existing comments, applicable rules and verification limits. Research gathers facts and questions, not review findings. Supply any connected source excerpts the agent cannot access; report unavailable sources.
2. Wait for its completed final brief. Do not review or launch concern workers while research is running. The main agent saves the returned brief, reads it, resolves review-critical gaps and records completion and integration. A launch or progress message is not a completed brief. Read-only agents return their work; do not ask them to create documents.
3. A completed and integrated brief supplied by a parent satisfies this gate. Do not spawn another context agent or redelegate without authorisation. If delegation is unavailable, gather and save the brief yourself first and report the limitation. Missing non-critical sources remain explicit limits.

### Scope and context

Read existing PR comments and the full requested comparison, not just the latest commit. Retain applicable project instructions unless the caller supplies an explicit review-policy scope override; never discard safety or operational constraints. Separate current behaviour, accepted conventions, personal preferences and future direction.

A wrapper such as Galaxy supplies a **profile**, not another workflow: repository/scope constraints, a conditional reference table, optional output reference and optional writing-voice path. Apply it before research, pass its constraints to every delegate and run this workflow once. The profile may replace output layout and repository-policy loading, not the research gate or evidence requirements. Do not rediscover a same-named project skill in place of an explicitly supplied personal path.

Choose guidance from the table and profile triggers. Assign exact resolved paths to the owning worker; the main agent need not preload bodies it delegates. Cross-links are conditional recommendations, not a recursive load-all graph. Deduplicate paths, stop at irrelevant concerns, and record category exclusions with reasons. Reading guidance alone does not complete checks.

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

### Delegation and coverage

After integrating research, create a short ownership table: concern, assigned files/consumers, agent, selected guidance and checklist categories. Identify a check by source path + category + label, with the source content hash or commit/dirty state as its version. One primary owner per check; deliberate second verification is labelled separately. Never count overlapping checks as independent proof.

| Role | Assignment |
| --- | --- |
| `ConcernReview` | Behaviour/contracts and relevant risks such as testing, security or performance; combine overlapping skills around a behavioural boundary |
| `DesignReview` | Product alternatives, direction, simplification, consistency and API usability across the PR and relevant surrounding systems |
| Main agent | Research integration, coverage, cross-boundary correctness, conflict resolution, overall assessment and output |

Use these agents automatically when the scope warrants them. A substantive design-triggering change gets a `DesignReview` pass; other independent concerns use `ConcernReview`. For a small cohesive change the main agent may perform the same passes, recording why delegation adds no value. Mechanical changes may exclude design with a scope reason; small size alone does not exclude API or design assessment. If named agents are unavailable, use an available read-only reviewer with the same contract; if all delegation is unavailable, do the passes yourself and report it.

Read [reviewer contract](references/reviewer-contract.md) before briefing workers. Supply its exact path, the final brief, scope, applicable project/operational constraints, profile overrides, assigned check categories and exact guidance paths. The scoped agents use replacement prompts with skills, extensions and conversation inheritance disabled; they do not automatically inherit project instructions. Include necessary constraints or exact relevant source paths explicitly rather than assuming ambient context. Include the relevant categories from [behaviour, design and build checks](references/review-checks.md). Keep runtime context narrow: do not inherit the whole conversation or send reporting templates/voice to workers. Respect available concurrency; do not launch one agent per skill or file. Do not invoke a multi-agent workflow tool unless the user explicitly requested that orchestration mechanism.

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
