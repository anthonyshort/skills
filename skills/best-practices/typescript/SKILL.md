---
name: typescript
description: Use when writing, refactoring, or reviewing TypeScript API design, classes, interfaces, types, narrowing, schemas, async APIs, performance, resource lifetimes, module boundaries, and file organisation.
---

# TypeScript best practices

## Goal

Keep APIs easy to use, catch invalid states before runtime and prevent performance problems using workload evidence.

## Guidance

Read the references relevant to the code being written or reviewed. Keep the scope focused on the changed behaviour.

### API design and construction

Read [API design](references/api-design.md) for functions versus classes, composition, pure core logic, public wiring, safe construction and caller experience.

### Types and validation

Read [type models](references/type-models.md) for variants, exhaustiveness, literals, overloads and utility types.

Read [schemas and narrowing](references/schemas-narrowing.md) for canonical schemas, untrusted input, type guards and caught errors.

Read [bounds and conversions](references/bounds-conversions.md) for combined indices, exact boundaries, actual data extent and direct conversions.

### Organisation and tooling

Read [organisation and comments](references/organisation-comments.md) for file placement, exports, promise ownership and useful documentation.

Read [tooling and contracts](references/tooling-contracts.md) for compiler settings, canonical types, public returns and imports.

### Performance and browser code

Read [performance and resources](references/performance-resources.md) for repeated work, algorithm cost, caching, concurrency and cleanup.

Read [browser APIs and loading](references/browser-apis.md) for native APIs, safe DOM writes and bundle costs.
