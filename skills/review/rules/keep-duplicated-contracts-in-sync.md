# Give duplicated contracts an explicit source

## When to check

Changed code recreates externally or jointly owned types, schemas, enum members, policy lists, error shapes or defaults.

## What to check

- Find the canonical owner and trace the actual consumers of both representations. Similar names alone do not establish that they have the same contract.
- Reuse shared or generated definitions when available. For an intentional local representation, identify its upstream source, maintenance owner and synchronisation mechanism, such as a generation step or representative compatibility check.
- For a provisional integration, establish which boundary will be replaced when the real contract is available. Do not treat a vendor model as a generated server contract without checking.
- Support a concern with a demonstrated mismatch or a concrete drift path. Recommend the smallest correction that keeps the consumers compatible.

## Why it matters

Two locally valid definitions can diverge silently. Type checking each copy does not prove that the systems exchanging those values agree.

## Exceptions

Vendor boundaries, independently versioned systems and temporary integrations can need local representations. A small accepted duplication can be maintained explicitly. Do not demand a code-generation system or unavailable backend types merely to remove a few repeated fields.

## Good and bad examples

Assume both consumers must accept the same document kinds and can import the shared module. These are module-shape examples, not APIs guaranteed to exist in a reviewed repository.

```typescript
// shared/document-kinds.ts: the canonical contract.
export const documentKinds = ["note", "image"] as const;
export type DocumentKind = (typeof documentKinds)[number];
```

```typescript
// Bad: a second maintained copy has already missed one supported kind.
const acceptedKinds = ["note"];
```

```typescript
// Good: both consumers use the owning module.
import { documentKinds } from "./shared/document-kinds";

const acceptedKinds = documentKinds;
```

An independently deployed consumer may not be able to import this module. Keep its local representation when necessary, with an explicit supported version and a check that detects incompatible changes.
