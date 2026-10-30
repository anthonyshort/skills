# Keep copied types and values in sync

## When to check

The change copies types, schemas, enum members, flags, policy lists, error fields or defaults defined elsewhere.

## What to check

- Find the code that defines the original type or value, then find where each copy is used. Check that the copies are meant to describe the same thing. Similar names alone do not prove this.
- Use an existing shared definition or generated type where possible. If a copy is needed, identify where it comes from, who updates it and how the copies stay in sync. This could be a generation step or a check that compares the values the two systems exchange.
- For a temporary frontend type, explain what will replace it when the backend is ready. Check whether it describes the backend API or a separate vendor API before recommending generated types.
- Show a mismatch or explain a change that could make the copies disagree. Suggest the smallest fix that keeps the code using them working together.

## Why it matters

Two copies can disagree even when each passes type checking. One system might then send a value that the other does not accept.

## Exceptions

A vendor API, a separately released system or an unfinished integration may need a local type. A small copy can stay when there is an agreed way to update it. Do not require a generation system or backend types that do not yet exist just to remove a few repeated fields.

## Good and bad examples

Assume both parts of the app must accept the same document kinds and can import the shared file. These examples show the proposed files, not APIs assumed to exist in the reviewed code.

```typescript
// shared/document-kinds.ts defines the supported kinds.
export const documentKinds = ["note", "image"] as const;
export type DocumentKind = (typeof documentKinds)[number];
```

```typescript
// Bad: this copy has missed one supported kind.
const acceptedKinds = ["note"];
```

```typescript
// Good: use the file that defines the supported kinds.
import { documentKinds } from "./shared/document-kinds";

const acceptedKinds = documentKinds;
```

A separately released app may be unable to import this file. It can keep a copy if the supported version is clear and a check catches changes that would make the two apps disagree.
