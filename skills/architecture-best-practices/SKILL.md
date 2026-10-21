---
name: architecture-best-practices
description: Use when writing, refactoring, or reviewing module ownership, folder structure, dependency boundaries, abstractions, shared behaviour, or architectural migrations.
---

# Architecture best practices

## Goal

Make ownership and dependency boundaries visible, and simplify abstractions without losing required behaviour or isolation.

## Checklist

Track checks in task notes, not here. Mark done only after verifying; explain N/A and report blocked or unverified checks. Run independent checks in parallel where useful.

**Owners and boundaries**

- [ ] **Responsible module** - Trace changed state, rules, and contracts through consumers to their owner.
- [ ] **Boundary leaks** - Identify leaked dependencies or knowledge before recommending a move.
- [ ] **Import direction** - Follow established dependency direction without introducing cycles.
- [ ] **Generic modules** - Keep specialised consumers out of their dependencies.
- [ ] **Existing implementations** - Compare proposed helpers and components with existing code before recommending reuse.
- [ ] **Behaviour match** - Verify equivalent behaviour and contracts before combining code or definitions.

**Folder structure and file names**

- [ ] **Visible responsibilities** - Use folders and names that reveal owners and public boundaries.
- [ ] **Layout ownership** - Give state, contracts, and shared behaviour clear owners.
- [ ] **Related work** - Group related responsibilities; separate independently owned work.
- [ ] **Layout evidence** - Support recommendations with concrete boundary or maintenance benefits; separate preferences from defects.

**Abstractions and simplification**

- [ ] **Abstraction purpose** - Identify the complexity, invariant, or stable boundary it hides.
- [ ] **Safe removal** - Preserve needed caller behaviour and isolation.
- [ ] **Simpler design** - Name the state, synchronisation, or indirection a simpler design removes.
- [ ] **State and effects** - Check whether pure calculations and explicit boundary effects remove mutable state or hidden coordination.
- [ ] **Total complexity** - Compare total concepts, code, and indirection; avoid wrappers or fragmented helpers introduced only for purity.

**Reuse and migration**

- [ ] **Unused code** - Identify code made unused or duplicated by the change.
- [ ] **Exported APIs** - Check consumers before removal.
- [ ] **Deprecated patterns** - Find a supported replacement before recommending migration.
- [ ] **Migration scope** - Keep it proportional to the change; explain wider work separately.

## Guidance

### Owners and boundaries

- Trace the changed state, rules, and contracts through their consumers. Identify the responsible module before recommending a move; name the dependency or knowledge that currently leaks across its boundary.
- Compare imports with the repository's established dependency direction. Flag cycles or a generic module depending on a specialised consumer; explain the affected boundary.

  **Avoid — HTTP responses in shared domain logic**

  ```typescript
  // pricing/calculateSubtotal.ts
  export function calculateSubtotal(prices: readonly number[]): Response {
    const subtotal = prices.reduce((sum, price) => sum + price, 0);
    return Response.json({ subtotal });
  }
  ```

  **Prefer — return a domain value**

  ```typescript
  // pricing/calculateSubtotal.ts
  export function calculateSubtotal(prices: readonly number[]): number {
    return prices.reduce((sum, price) => sum + price, 0);
  }
  ```

- Compare proposed helpers, components, and definitions with existing implementations before recommending reuse. Verify matching behaviour and contracts; identify intentional differences before combining code. Shared definitions should represent one contract that could otherwise drift.

### Folder structure and file names

- Identify where a reader needs unstated knowledge to find an owner. Compare the proposed layout with related modules and trace state, contracts, and shared behaviour to their owners. Group related responsibilities and keep independently owned work separate.
- Explain how a proposed layout makes code easier to find or change. Treat alternatives as preferences unless they violate a boundary or cause a concrete maintenance problem.

### Abstractions and simplification

- Judge an abstraction by the complexity, invariant, or stable boundary it hides. Recommend removal only after checking callers lose no needed behaviour or isolation.
- Name the independent state, synchronisation, ownership, or interaction mechanism removed by a proposal. Compare the same supported cases before and after; preserve required behaviour and isolation. Fewer files, lines, or branches alone do not justify the change. Record when no supported simplification was found rather than inventing a finding.

- Prefer cohesive pieces, pure calculations where practical, reduced mutable state, and explicit effects at boundaries. Preserve required ordering, errors, lifecycle, and isolation; a pure precheck does not replace validation within a transaction or other effectful boundary.
- Judge the whole alternative, including wiring and call sites. Do not add a framework, forwarding wrapper, or many trivial helpers merely to make each function pure. State which dependency, state, or coordination mechanism disappears.
- For assigned product/direction or wider design alternatives, use [design review](../design-review/SKILL.md). For a concrete state/ownership comparison, selectively read [design examples](../design-review/references/design-examples.md); for adapters, plugins, or events, select [TypeScript patterns](../design-review/references/typescript-patterns.md). Do not load all three by default.

### Reuse and migration

- Identify code made unused or duplicated by the change; check consumers before removing exported APIs.
- Separate replacement work needed by this change from wider migration work; identify affected consumers and remaining follow-ups.
