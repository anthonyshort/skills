# Type models

### Shapes and variants

- Follow existing interface/object-alias conventions; use aliases for unions, tuples, mapped and conditional types.

- Use constants for variants without payloads and factories for variants with payloads when this makes construction consistent.

  ```typescript
  type Result = { status: "pending" } | { status: "ready"; value: string };
  const PENDING = { status: "pending" } as const satisfies Result;
  function ready(value: string): Result {
    return { status: "ready", value };
  }
  ```

- Assign unhandled switch variants to `never` so new variants fail typechecking. Return a reasonable fallback for unknown runtime variants rather than throwing on version skew.

  ```typescript
  function label(result: Result): string {
    switch (result.status) {
      case "pending": return "Loading";
      case "ready": return result.value;
      default: {
        const unhandled: never = result;
        void unhandled;
        return "Unknown";
      }
    }
  }
  ```

- Use `as const` to preserve literals and `satisfies` to check shapes without widening. Annotate exports only where declaration rules require it.

- Include a union overload alongside narrower overloads when callers can pass the union.

  ```typescript
  function round(value: number): number;
  function round(value: undefined): undefined;
  function round(value: number | undefined): number | undefined;
  function round(value: number | undefined): number | undefined {
    return value === undefined ? undefined : Math.round(value);
  }
  ```

### Utility types

- Reuse established utility types after checking their definitions and behaviour. Helpers such as `Nullable` and `DeepMutable` are not TypeScript built-ins.
- Use recursive mutability or exact-type assertions only when the contract needs them; preserve branded fields.
