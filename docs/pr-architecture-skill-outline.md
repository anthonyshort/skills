# PR architecture walkthrough skill outline

This skill helps a reviewer understand the relevant system, then understand how a PR or stack changes it. The result is a visual explanation grounded in source code, with enough context to begin an informed review. This document records the research and design decisions behind the first draft at [pr-architecture-walkthrough](../skills/pr-architecture-walkthrough/SKILL.md).

## Research and useful techniques

Public skill instructions inspected on 29 October 2026. These observations concern their instructions, not measured performance.

| Source | Useful technique | What we would adapt |
| --- | --- | --- |
| [PR Architecture Summary](https://github.com/pimlock/eng-skills/blob/main/skills/summarize-pr-architecture/SKILL.md) | Builds a concept map of the old model, new model, unchanged invariants, actors, boundaries and primary flow. Organises the narrative by concepts. | Use the concept map before drafting. Let the subject determine which boundaries matter instead of assuming infrastructure or authentication concerns. |
| [Mastra PR Explainer](https://github.com/mastra-ai/mastra/blob/main/.claude/skills/pr-explainer/SKILL.md) | Teaches the problem, system context, before/after flow, key code and verification in that order. | Establish context before code details. Select code snippets that explain the mechanism rather than reproducing the patch. |
| [Visual Explainer diff review](https://github.com/nicobailon/visual-explainer/blob/main/plugins/visual-explainer/commands/diff-review.md) | Compares before and after using the same diagram with changed edges highlighted. Inspects surrounding code and cites claims. | Preserve visual correspondence between versions. Keep verdicts and proposed fixes outside the core explanation workflow. |
| [Codebase Walkthrough](https://github.com/alexanderop/walkthrough/blob/main/skills/walkthrough/skill.md) | Uses concept-level nodes, action-labelled edges and clickable details containing real source paths and snippets. | Offer progressive detail without imposing a node quota, theme or prohibition on further investigation. |

The [C4 dynamic diagram guidance](https://c4model.com/diagrams/dynamic) also distinguishes a static model of the system from a runtime view of components collaborating on a particular scenario. Both views can help, but should answer different questions.

Our design opportunity is to combine system understanding, before/after explanation and stack evolution. The four inspected skills above provide individual techniques but do not explicitly define that combined workflow.

## Proposed identity and scope

Working name: `pr-architecture-walkthrough`.

Provisional description: Explain the design and architecture of a PR, branch or PR stack through system context, concrete execution flows and before/after diagrams. Use when a reviewer needs to understand how the system works and how the change reshapes it.

The primary outcome is understanding. A full code review, refactoring plan or publication should require a corresponding request. The existing `review` skill evaluates changes, and `split-pr` plans divisions. This skill would provide the architectural explanation that can support either task without invoking their full workflows automatically.

## Proposed workflow

### Establish the scope and comparison

Resolve the repository, PRs and exact base/head revisions. For a stack, establish dependency order from branch relationships and source evidence rather than PR numbers. Record missing or ambiguous dependencies. Treat several related PRs as a group when they do not form one linear stack.

Use the overall baseline and final head for the cumulative change, then compare each PR with its own parent or base. This avoids counting inherited changes as a later PR’s contribution. Preserve per-PR explanations even when an intermediate change disappears from the final diff.

### Explain the relevant existing system

Start with the product behaviour or concrete task. Introduce the concepts needed to follow it, the main responsibilities and boundaries, and where the relevant state or data lives. Read unchanged callers and dependencies where necessary. Expand beyond the affected subsystem only when a relationship needs explaining.

Produce a small context diagram and trace one representative scenario from trigger to result. Explain ownership, lifetime, asynchronous work and failure behaviour when they matter to that scenario.

### Explain the change using the same scenario

State the problem or intended goal, distinguishing author-stated intent from observed behaviour and inferred rationale. Explain how the same scenario works after the change. Show which responsibilities, interfaces, dependencies or data transformations move, appear or disappear. State important guarantees that remain unchanged.

Use corresponding before/after diagrams with stable names and comparable layouts. For a structural refactor, explain changes in ownership and dependencies even when user-visible behaviour stays the same.

### Explain the stack as a design unfolding

Show the final architecture once, then explain each PR’s contribution and dependency on earlier work. Identify preparation, introduction, integration, activation and cleanup where those roles apply. Make temporary adapters, coexistence of old and new paths, feature flags and unconnected code visible when they affect understanding.

Include a compact table of each PR’s purpose, dependency and behaviour available at that point. Add intermediate diagrams only when they reveal a meaningful design transition.

### Explain design choices and provide a reading path

Describe the constraints and trade-offs supported by the code and available discussion. Distinguish the implemented design from proposals and future plans. Do not invent rejected alternatives or present inferred motivation as fact.

Finish with the few source locations to read in a useful order and unresolved questions that prevent a confident explanation. Report relevant verification evidence already inspected without turning the walkthrough into a review checklist.

## Diagram choices and quality

| Question | Useful diagram |
| --- | --- |
| What are the pieces and who owns what? | Component and responsibility map |
| What happens when someone performs this action? | Sequence diagram |
| How does a decision or transformation work? | Flowchart |
| How does an entity or resource change over time? | State diagram |
| How do data structures relate? | Entity relationship diagram |
| How do the PRs depend on one another? | Stack dependency graph |

Choose the smallest set that explains the change. Keep each diagram at a consistent level of detail, label relationships with actions, and identify the revision or stage it represents. Use explicit change labels as well as colour. Link important nodes and relationships to source evidence. Verify that the diagrams and prose describe the same behaviour.

## Initial delivery proposal

Use Markdown and Mermaid exclusively. The user explicitly ruled out HTML. Prepare a self-contained brief without requiring an interactive conversation so a future assignment-triggered automation can run it before review. Include exact revisions, source links and visible gaps so the reviewer knows what the brief covers. Keep assignment triggers, scheduling and publication separate from the skill.

A typical walkthrough would contain the purpose, existing system, representative flow, architectural change, stack progression when applicable, design trade-offs and a source-reading path. Scale or combine these parts to fit the change.

The first real PR trial showed that the reader needs less detail up front. Default to a concise brief in simple English, with short sentences and bullets. Use small diagrams and a concrete example to explain the design. Keep revision metadata at the end and include only the exceptions needed to understand the change.

## Validation before finalising the skill

Try the draft on a small behavioural change, a structural refactor with unchanged behaviour, and a stack whose preparation, activation and cleanup happen in different PRs. Check that a reader can explain the original flow, the changed flow and why each PR exists. Verify comparison bases, activation claims and diagram relationships against the source.

The first draft is ready for trials. Use a few real PRs to tune the amount of background, diagram choices and reading depth with the user. Assignment-triggered automation can follow once the output is useful. Live installation links and automation configuration are unchanged.
