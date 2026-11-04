# Use named interfaces for complex object shapes

## When to check

A TypeScript change embeds a multi-field or nested object type inside a container, generic argument or larger type annotation, such as `Record<string, { ... }>`.

## What to check

- Read the enclosing declaration and its callers. Does the inline object describe a distinct concept whose fields distract from the collection or API being declared?
- Prefer a separate, meaningfully named interface for that object shape. For example, use `Record<string, UploadStatus>` rather than spelling out the status fields inside `Record`. Reuse an existing definition when it already describes the same contract.
- Explain what the name makes clearer and show where the fields would move. Repeated shapes, nested fields and annotations that mix collection structure with record details are useful evidence. Do not use a fixed field count as the only test.
- Preserve optional fields, readonly modifiers and other type constraints. Keep the interface near its owner unless real consumers need to share it. Extraction does not require a new file or an exported interface.
- Treat this as a readability improvement, not a runtime defect or an automatic reason to block a change.

## Why it matters

Inlining a detailed object shape inside another type makes readers work through its fields before they can understand the outer structure. A named interface separates what the collection contains from how each item is structured and gives the concept a reusable name.

## Exceptions

- Small, obvious, one-off shapes can stay inline when naming them would add navigation without making the declaration clearer.
- Infer shapes from their owning schema, generated contract or existing type rather than creating a parallel interface that can drift.
- Unions, mapped types and conditional types may need type aliases. This rule prefers interfaces for extracted object shapes, not interfaces for every TypeScript type. An existing named object alias already provides the separation this rule seeks.
- Keep inline shapes when their position is important to understanding a local relationship and extraction would hide it, such as a compact discriminated union.

## Good and bad examples

Assume each entry tracks an upload and there is no existing schema or shared type that owns this shape. These declarations describe the same data.

```typescript
// Bad: the collection declaration also has to explain every upload field.
const uploads: Record<string, {
  filename: string;
  bytesSent: number;
  totalBytes: number;
  errorMessage?: string;
}> = {};
```

```typescript
// Good: the interface names the entry and keeps its fields separate.
interface UploadStatus {
  filename: string;
  bytesSent: number;
  totalBytes: number;
  errorMessage?: string;
}

const uploads: Record<string, UploadStatus> = {};
```

A small local shape need not be extracted when the extra name adds no useful meaning:

```typescript
const offsets: Record<string, { x: number; y: number }> = {};
```
