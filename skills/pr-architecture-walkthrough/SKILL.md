---
name: pr-architecture-walkthrough
description: Explain the design and architecture of a PR, branch or PR stack using system context, concrete execution flows and before/after Mermaid diagrams. Use when preparing context for an upcoming review, including unattended preparation for PRs assigned to the user.
---

# PR architecture walkthrough

Help the reviewer understand the relevant system and how the change reshapes it before they open the diff. Produce a self-contained Markdown brief with Mermaid diagrams. Never generate HTML.

## Write for a busy reviewer

- Assume the reader reviews many PRs each day. Help them get up to speed with little effort.
- Lead with the problem and the design change in everyday English. Explain what happens before naming the mechanism.
- Prefer short sentences and short bullets. Give each bullet one point. Avoid dense paragraphs, long table cells and lists of technical terms.
- Use a concrete example and small diagrams to carry the explanation. Keep diagram labels short and readable without studying the code.
- Default to roughly 500–800 words for the main brief. Treat this as a guide, not a quota. A small change needs less. Add detail only when it changes the reader’s understanding.
- Keep the main path prominent. Include exceptions and trade-offs when they affect the design. When useful, group important changed files by what they do together. Omit inventories of every changed consumer or test.
- Keep source links beside the relevant point, but avoid long evidence lists. Put full commit IDs, preparation metadata and verification notes at the end. Put an essential missing dependency near the top.
- Explain each fact once. A diagram and nearby prose should help each other, rather than repeat the same steps.
- Before finishing, reread the opening as a tired reviewer. Can they explain the problem and new design without decoding terms or following links? Simplify until they can.

## Scope and delivery

- Read source code and available context. Generate the brief locally. Do not modify implementation code, submit reviews, post comments or configure automation unless separately requested.
- Use the supplied PR, branch or stack. Assignment events and scheduling belong to the calling automation. This skill does not discover an ongoing queue or run a watcher.
- Work without requiring a conversation. Resolve routine choices from the available evidence. If essential source or scope is unavailable, save a clearly labelled partial brief explaining the gap and what is needed to complete it. Do not fill gaps with plausible architecture.
- Save to the caller’s requested path. Otherwise use `~/.cache/pi/pr-architecture-walkthrough/<owner>/<repo>/pr-<number>/walkthrough.md`, or a similarly named directory for a local branch or stack. If unavailable, use a temporary directory and return its path.
- Record the repository, PR links, preparation time and exact compared revisions in the brief. State whether it is complete or partial. Completion means the explanation covers the identified scope, not that the change is correct.
- Read [the output guide](templates/walkthrough.md) before drafting. Its structure is an example. Add, edit, reorder, combine or remove sections to help the reviewer understand this change. Keep the first screen useful to someone about to review.

## Establish what is changing

1. Read the PR description, diff, changed files and relevant discussion. Inspect linked issues or design documents when they explain the problem or a design choice. Use existing checkouts, Git objects and available read-only tools.
2. Pin the PR’s base and head commits and identify the effective comparison base. For a local branch, establish the merge-base with its target. Inspect the actual comparison rather than assuming the working tree represents the reviewed revision.
3. For a stack, establish dependency order from branch bases, ancestry and explicit dependencies. PR numbers and similar titles do not establish order. Distinguish an actual stack from independent related PRs.
4. Inspect each PR against its own effective base, then the cumulative baseline-to-final change for a linear stack. For branching dependencies, show the dependency graph and explain the branches separately. Do not invent a single final tree.
5. If a dependency or revision is unavailable, identify the affected explanation as incomplete. Do not silently replace missing history with the current default branch.

## Build the existing mental model

- Begin with the action or product behaviour the change concerns. Explain the domain terms needed to follow it.
- Read the baseline implementation, including unchanged callers, dependencies and wiring. A patch alone rarely explains the system.
- Identify the important components, their responsibilities, who owns relevant state and how data or control crosses their boundaries. Explain resource lifetime, asynchronous work or failure handling where they determine the behaviour.
- Trace one representative scenario from trigger to observable result. Expand to another scenario only when it reveals a materially different mechanism.
- Keep the scope to the subsystem and relationships needed to understand the change. Group code by responsibility rather than describing files in diff order.

## Explain the new design

- Follow the same scenario through the head revision. Explain which responsibilities, interfaces, dependencies, state or transformations change and which important guarantees remain.
- Follow callers, registration, flags and side effects to establish whether the new path is active. Distinguish introduced code from code that is actually used.
- Explain the problem and design constraints from available evidence. Attribute author-stated intent and label inferred rationale. Do not invent rejected alternatives or future plans.
- Describe trade-offs that help the reader understand the chosen design. Avoid turning the brief into a verdict, speculative redesign or catalogue of possible bugs. Put unresolved architectural questions beside the relevant explanation.
- Use tests and existing verification results as supporting evidence when they clarify intended behaviour. Distinguish assertions in tests from checks actually run. Local builds and test runs are not required to prepare the brief.

## Explain a stack’s progression

For a stack, show the cumulative design and explain what each PR contributes. Identify preparation, integration, activation and cleanup when those stages apply, without forcing every stack into those categories.

- Explain why a PR depends on an earlier one and what works at each stage.
- Identify temporary adapters, parallel old/new paths and relevant compatibility constraints.
- Preserve meaningful intermediate changes even if they disappear from the cumulative diff. Avoid attributing inherited changes to later PRs.
- Add an intermediate diagram only when it reveals a design transition the final view would hide. Give the reader a useful order for reviewing the PRs.

## Make the diagrams teach

- Use Mermaid fenced blocks in Markdown. Include a diagram that explains the relevant structure or flow. Prefer a small context map followed by a before/after view when both add understanding. Scale to the change rather than filling a diagram quota.
- Use a component map for responsibilities, a sequence diagram for interactions, a flowchart for decisions, a state diagram for lifecycles or an entity relationship diagram for data relationships. Show stack dependencies when they need explaining.
- Label every diagram with the revision or stage it represents. Keep names and layout comparable across before/after views. Use explicit labels for added, changed or removed pieces rather than relying on colour.
- Label edges with actions or data. Keep one level of detail within a view and separate runtime flow from static dependencies. Explain the consequence of the diagram in nearby prose.
- Support important nodes and relationships with source links beside the diagram. Use commit-pinned GitHub links when available so an automatically prepared brief still refers to the code it inspected. For local-only code, identify the revision and path.

## Verify and refresh the brief

- Check diagram nodes, edges, ordering and activation claims against the source at the labelled revisions. Check that the prose and diagrams describe the same scenario.
- Check Mermaid syntax with an existing renderer when available. Do not install tooling just to render the brief. If rendering was not checked, say so in the preparation note without presenting source inspection as a render check.
- Confirm source links and comparison ranges. Recheck the remote PR heads before finishing when available. If they moved, identify the prepared revision and newer unexamined revision instead of claiming freshness.
- On a later run, read the prior brief and compare its revisions with the current scope. Reuse still-valid context, refresh changed paths and related evidence, and rewrite stale explanations. A matching head alone does not prove that the base, dependencies or relevant discussion are unchanged.
- Return the brief’s path, the scope covered and any material gap. Leave judgement and review submission to the reviewer.
