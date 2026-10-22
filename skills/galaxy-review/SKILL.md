---
name: galaxy-review
description: Review nominal-io/galaxy changes using anthonyshort's design priorities, project context, and writing voice, through the generic review workflow.
---

# Galaxy review

## Goal

Run the generic review workflow with the additional Galaxy checklists to assess simplicity, consistency, reuse, and fit with supplied product and architectural direction.

## Review scope and context budget

This personal profile overrides the generic review's repository-policy loading and report layout for Galaxy. Focus on correctness, simplicity, ownership, reuse and architectural fit. Other reviewers cover repository rule compliance.

- Ignore Galaxy's repository review-policy and rule-compliance instructions, including its repository `galaxy-review` skill, required `/code-review` or thermo-nuclear reviews, and blanket requirements to read `rules/`. Do not bulk-load those files or add their compliance checklists. Retain global instructions and operational constraints needed to run commands safely.
- Gather targeted behavioural and architectural facts from current code, tests, linked product/RFC context and relevant documentation. Package instructions may explain API mechanics; extract those facts without importing their review policies. Already injected repository text cannot be unloaded, but it must not drive this review's policy or cause further bulk reads.
- Give this scope override to the context subagent and every reviewer. The context brief should be concise and sourced, with references for deeper investigation rather than copied rule files. Choose technology skills from the personal generic review workflow, not from repository mandates.
- Galaxy has a repository skill with the same name, which may win normal project skill discovery. Identify this personal skill by the exact resolved path to this `SKILL.md` when invoking or delegating this review; record its full source path in the output and do not silently substitute the repository skill.
- Preview testing is disabled for this profile. Do not invoke `galaxy-preview-testing`, discover preview URLs or attempt browser authentication as part of this review, including through inherited generic guidance. Assess UI behaviour through code and relevant automated checks; report browser behaviour as unverified when that limits a conclusion. Preview access is not a required completion check.
- No dependency installation for reviews: apply the generic review's environment constraints before context gathering and pass them to every subagent. Do not create or copy `node_modules`, run package installs or fetch missing tools, including in scratch directories or new worktrees. Use existing dependencies for practical checks; otherwise inspect source, tests and CI and report checks that could not run. Keep review scratch work under `~/.cache/pi/reviews/` or a user-specified workspace, not `/tmp`.

## Invoke the generic coordinator once

On invocation, run [review](../review/SKILL.md) **once** with the profile below. Do not run a second Galaxy orchestration workflow, gather a duplicate research brief or spawn agents from this wrapper. The generic coordinator owns context gathering, the completed-context gate, concern selection, delegation, verification and synthesis. Reading its skill alone is not completion.

| Profile field | Value |
| --- | --- |
| Repository/scope constraints | Target `nominal-io/galaxy`, requested scope, this personal identity and every override above. |
| Context requirements | Current API adoption, domain/host ownership, supplied product/RFC context and stack direction; use current code for behaviour and supplied product context or RFCs for intent. |
| Conditional guidance table | The table below; select all affected categories and assign their exact reference paths. |
| Output reference | [review output](references/review-output.md), overriding the generic report layout at synthesis. |
| Voice path | [writing voice](../writing-voice/SKILL.md), for the main agent at synthesis only. |
| Operational checks | Scope/direction, generated-code CI and completion checks below. |

A completed, integrated brief supplied by the parent satisfies the context gate for delegates; do not repeat context research. Otherwise the generic coordinator obtains and integrates the context subagent's final factual brief before correctness, design or test-quality review, resolves review-critical gaps, and records any unavailable-delegation self-gathered fallback. Do not infer completion from launching an agent or receiving an intermediate message.

### Conditional guidance

The parent coordinator selects relevant rows from scope and the integrated brief, records excluded categories with scope reasons, and assigns exact resolved reference paths and checks to their primary owners. Do not preload all selected reference bodies in the main agent: an assigned worker reads its own references; the main reads those it owns or needs for verification. Do not send workers this coordinator workflow, output templates, writing voice or unassigned reference bodies. Cross-links are relevance leads, not instructions to recursively load everything. A change can span several areas; do not choose only one.

| Trigger | Reference | Checklist categories |
| --- | --- | --- |
| Changed ownership, interactions, domain operations, workbook invariants or migration | [domain design](references/domain-design.md) | Simplicity and reuse; Domain and host ownership; Workbook data ownership; Migrations and direction |
| Affected UI, design-system or resource consumers | [UI and resources](references/ui-resources.md) | Shared UI and resources |
| Affected shared types, declarations, procedures, query/backend or MCP boundary | [backend and MCP](references/backend-mcp.md) | Types and procedures; Queries and backend boundaries; MCP tools |
| Compute, data processing, subscriptions or related performance | [compute](references/compute.md) | Compute and subscriptions |
| Store/state lifecycle, wrapper APIs, effects, disposal or history | [stores](references/stores.md) | Store effects; Store history |
| Changed store/client/utility behaviour or applicable tests/harnesses | [testing](references/testing.md) | Test coverage and harnesses |

Require each delegate to return the skills and references it actually ran (source/version, scope and execution status), per-check evidence and gaps alongside findings through the generic worker contract. Account for every item in selected references. Do not bulk-read excluded categories merely to mark them N/A, or imply that excluded or unread checks passed.

## Operational checklist

Track checks in task notes, not here. Mark done only after verifying; explain N/A and report blocked or unverified checks. Run independent review checks in parallel only after the generic review's context-first gate.

**Scope and direction**

- [ ] **Context-first gate** - Complete and integrate the dedicated context subagent's final brief before your own review or launching review agents. Record its location and any unavailable-delegation fallback.
- [ ] **Review target** - Confirm nominal-io/galaxy and the requested scope.
- [ ] **Current contracts** - Gather relevant package API and behaviour facts; verify them against current code without importing repository review policy.
- [ ] **Change areas** - Identify frontend, design-system, API, MCP, compute, store, and build changes.
- [ ] **Review workflow** - Run the generic review workflow once with this Galaxy profile and its selected checklists.
- [ ] **Product direction** - Compare the design with supplied product and architecture context.
- [ ] **Guidance strength** - Separate conventions, preferences, and future direction.
- [ ] **Missing direction** - Ask when missing context would change the recommendation.

- Distinguish convention, preference, and future direction.
- Use current code for behaviour and supplied product context or RFCs for intent.
- Ask for missing direction when it materially changes the recommendation.

**Galaxy build conventions**

- [ ] **Generated-code CI** - Check `build.yml` verifies generated code was refreshed and committed.

- Complete the generic Build and CI checks. For changed code generation, verify `build.yml` detects output that was not regenerated and committed.
- Report CI results separately from merge confidence. CI failures, including typecheck, lint, format and Meticulous, do not lower the score or independently block approval. Apply the [merge confidence and submission policy](references/review-output.md#merge-confidence-and-submission) at synthesis; pass this scoring constraint to delegates.

**Completion**

- [ ] **Research included** - Embed the completed pre-review research and its sources in the saved review document.
- [ ] **Skills and coverage** - Record skills actually run by each agent and evidence-backed checklist statuses, including gaps.
- [ ] **Review output** - Use the Galaxy output templates, context and goal assessment, P0/P1/P2 headings, casual voice and GitHub footer.
- [ ] **Review completion** - Reconcile generic and Galaxy checks; report verification gaps.

- Reconcile the generic review checklist, this Galaxy checklist, and every selected skill checklist. The main reviewer owns coverage across delegated work; report unchecked items rather than treating skill loading as verification.
- Use the local output templates. Include the context brief itself, the goal assessment, skills run by every agent and checklist evidence. Reading a skill or launching an agent does not establish completed review coverage; never default unclassified checks to passed.
- Report missing context, unresolved direction, and verification limits.

At synthesis, the main agent reads the output reference and applies writing voice: casual Slack-style conversation, simple English, concrete consequences, no AI prefix, and one blank line before `<sub>Sent with Pi</sub>` at the bottom of GitHub comments. Keep exact revisions, inline anchors, pending-versus-published status and attribution; do not publish without authorisation.
