# Make component props fit together

## When to check

A component adds paired props, mode flags or values that only make sense for some supported modes.

## What to check

- Trace the props through real callers and the component branches. Which combinations work, and which are ignored, rejected or missing a value?
- Group values that callers must always supply together. If one prop chooses a mode, consider a union whose branches allow only the fields that mode supports.
- Derive a value from an existing prop when the component already fixes that relationship. Confirm that callers do not need to choose the values separately.
- Show an unsupported call the current type accepts, or repeated caller checks a clearer type would remove. Recommend a type change only when it makes the supported uses clearer.

## Why it matters

Independent optional props can let callers request a mode the component cannot render or omit the value it needs.

## Exceptions

Keep independent props when callers can vary them independently. Optional callbacks can be valid in read-only views. A small component with clear defaults does not need a union merely because it has several props. Preserve supported calls when changing a public component API.

## Good and bad examples

Assume selection is either disabled or controlled by a caller that must supply both the selected ID and a change handler. These are proposed API shapes, not component implementations.

```typescript
// Bad: permits a selected ID without a handler, or a handler without an ID.
type ListPropsBefore = {
  selectedId?: string;
  onSelect?: (id: string) => void;
};

// Good: a mode states which values must be supplied together.
type ListProps =
  | { selection: { id: string; onChange: (id: string) => void } }
  | { selection?: never };
```

A mode-specific value can use the same approach:

```typescript
// Good when only a vertical separator supports a custom length.
type SeparatorProps =
  | { direction: "vertical"; length?: number }
  | { direction: "horizontal"; length?: never };
```

If both separator directions support a custom length, this union would wrongly remove a valid use. Check the rendered behaviour before narrowing the props.
