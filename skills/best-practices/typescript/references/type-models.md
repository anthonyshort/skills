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

- Prefer a switch when several branches compare the same enum, union or state value. Keep if statements for unrelated conditions, ranges and short guards. A complete mapping is also useful when each case only needs a value.

- A switch alone does not catch missing cases. Assign unhandled variants to `never` so new variants fail type checking rather than taking a broad default. Validate external data separately and choose how to handle unsupported values. Keep a reasonable fallback for unknown runtime variants rather than throwing when saved data comes from a newer version.

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
