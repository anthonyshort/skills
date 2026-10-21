---
name: design-review
description: Use as selected guidance within review or galaxy-review for product alternatives, future direction, design simplification, consistency, and developer-facing API usability beyond changed lines.
---

# Design review

## Goal

Find evidence-backed ways to meet the user task with less complexity and clearer consumer APIs, preserving required behaviour and distinguishing immediate improvements from wider opportunities.

## Checklist

Track assigned checks in task notes, not here. Mark done only after verifying; explain N/A and report blocked or unverified checks. Reading guidance is not completing a check.

**Product and direction**

- [ ] **User task** - Connect the proposed behaviour to supplied intent and supported user tasks.
- [ ] **Product alternative** - Compare a simpler interaction against the same requirements, or identify missing intent.
- [ ] **Direction evidence** - Separate adopted patterns, documented future direction, and historical examples.
- [ ] **Intermediate state** - Identify supported incremental steps and intentional migration boundaries.

**Design and consistency**

- [ ] **Affected owners** - Inspect affected owners, callers, and directly comparable implementations beyond the diff.
- [ ] **Preserved behaviour** - Establish ordering, failure, lifecycle, and isolation requirements before proposing alternatives.
- [ ] **Removed complexity** - Name the state, dependency, synchronisation, or indirection each alternative removes.
- [ ] **Total design** - Compare total concepts and code, not just the purity or size of individual functions.
- [ ] **Consistent contracts** - Distinguish accidental divergence from justified product or ownership differences.

**Consumer APIs**

- [ ] **Actual usage** - Inspect supported calls for misleading inputs, bookkeeping, and leaked implementation details.
- [ ] **Before and after** - Show concrete consumer usage for an API proposal, including results and failure or disposal obligations.
- [ ] **Proportionate interface** - Preserve simple APIs where added configuration or extensibility has no demonstrated consumer.

**Proposals and coverage**

- [ ] **Proposal evidence** - Cite the current friction, relevant sources, preserved semantics, and trade-offs.
- [ ] **Migration cost** - Identify affected consumers, a first step, and why this change is an opportunity.
- [ ] **Scope and priority** - Separate confirmed defects, PR-scoped improvements, and broader opportunities.
- [ ] **Check outcomes** - Return evidence and gaps for assigned checks, including when no supported redesign was found.

## Guidance

### Product and direction

- Use the coordinator's integrated brief and assigned sources; do not start another context-research gate. Verify proposal-specific uncertainties in the permitted sources. Treat missing intent as a focused question, not permission to invent a product goal.
- Ask whether the user task needs the proposed interaction at all. A simpler interaction is useful only if it preserves actual requirements such as bulk work, confirmation, accessibility, or recovery.
- Distinguish current adoption from intended direction. Verify that a replacement is available and supports the affected cases. Describe a useful intermediate state rather than making a future migration an automatic blocker.
- Load [design examples](references/design-examples.md) only for product alternatives, derived state, domain/UI ownership, consistency, or incremental migration comparisons. Examples are illustrative, not confirmed user preferences or evidence about the target repository.

### Design and consistency

- Bound exploration to affected owners/callers and directly comparable implementations. Expand only to resolve a named uncertainty that changes the proposal. Stop when the alternative and migration consequences are supported, or report the source that blocks judgement.
- Establish the behaviour being preserved before recommending a redesign; this does not require a separate global correctness pass. Surface discovered defects with evidence without taking over unassigned correctness checks.
- Use [architecture guidance](../architecture-best-practices/SKILL.md) when ownership, state/effects, abstractions, or consistency are assigned concerns. It owns the simplification criteria; do not turn example recipes into additional mandatory rules.
- Load [TypeScript patterns](references/typescript-patterns.md) only when comparing adapters, plugins, events/direct calls, or pure decisions. Keep legitimate isolation, ordering, error propagation, and cleanup visible in the alternative.
- Do not infer preferences for factories versus classes, emitters versus async iterables, or plugin registration from examples. Label unconfirmed recipes as illustrative; ask for confirmation before promoting a recipe into personal policy.

### Consumer APIs

- Use [API design guidance](../api-design-best-practices/SKILL.md) when a changed function, hook, store, plugin/event contract, module, or HTTP API has consumers. Ask whether a caller could use it comfortably as a library interface, without requiring public-library machinery.
- Compare real calls before signatures alone. Show concrete inputs and output use; account for errors, cancellation, ordering, and ownership where applicable. Explain what fake values, internal knowledge, or caller bookkeeping disappear.
- Use the function and HTTP pairs in [design examples](references/design-examples.md) only when they clarify the affected consumer contract. Leave a small cohesive API unchanged when no supported improvement exists.

### Proposals and coverage

- For each proposal, return current friction and source evidence, the alternative, preserved semantics, removed complexity, consumer impact, trade-offs, migration cost, a first step, and why this PR is an opportunity. Include concise before/after usage when the consumer contract changes.
- Treat priority and scope separately. A wider opportunity can matter without blocking this PR; a small change can contain a serious defect. Cite sources outside the diff honestly rather than inventing inline anchors.
- Return assigned check outcomes and evidence through the supplied reviewer contract. Report unknowns and missing sources explicitly. “No supported redesign found” is a valid result; there is no finding quota.
- The coordinator selects workers and guidance, reconciles findings, and owns the final assessment. Do not load report templates, writing voice, unrelated cross-links, or the coordinator workflow to perform an assigned design review.
