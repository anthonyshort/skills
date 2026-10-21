---
name: typescript-best-practices
description: Use when writing, refactoring, or reviewing TypeScript types, narrowing, schemas, async APIs, module boundaries, and file organisation.
---

# TypeScript best practices

## Goal

Keep TypeScript contracts, construction, and validation explicit so incorrect wiring and invalid states are caught before runtime.

## Checklist

Track checks in task notes, not here. Mark done only after verifying; explain N/A and report blocked or unverified checks. Run independent checks in parallel where useful.

**Contracts and construction**

- [ ] **Required dependencies** - Require dependencies needed by supported methods at construction.
- [ ] **Caller dependencies** - Check production callers and fixtures supply required clients without masking casts.
- [ ] **Optional capabilities** - Expose absent capabilities in the API or use a narrower client.
- [ ] **Canonical types** - Search existing types before adding replacement models.
- [ ] **Public returns** - Preserve return contracts and applicable declaration requirements.
- [ ] **Type-only imports** - Follow module rules for type-only imports.
- [ ] **Domain names** - Name types and functions for their domain purpose.
- [ ] **Options objects** - Consider options for three or more parameters; preserve existing contracts unless migrating.

**Type models**

- [ ] **Exclusive states** - Use discriminated variants rather than independently optional fields.
- [ ] **Exhaustive switches** - Check variants with never and provide safe version-skew fallbacks.
- [ ] **Literal shapes** - Retain needed literal types and check the intended shape.
- [ ] **Overloads** - Preserve argument-specific returns and support union callers.
- [ ] **Utility types** - Check helper semantics and preserve brands in recursive transformations.

**Schemas and narrowing**

- [ ] **Schema types** - Derive validated types from canonical Zod schemas, not duplicate interfaces.
- [ ] **Boundary parsing** - Parse untrusted input rather than asserting it into a trusted type.
- [ ] **Array limits** - Give every user-input array a meaningful maximum.
- [ ] **Any and casts** - Replace any or unchecked casts with specific types or narrowing.
- [ ] **Custom guards** - Validate every property the claimed type requires.
- [ ] **Caught values** - Handle unknown errors, including strings, objects, and null.
- [ ] **Schema factories** - Follow project naming and justify laziness or memoisation.

**Bounds and conversions**

- [ ] **Combined bounds** - Check relationships between independently computed bounds; clamp at composition.
- [ ] **Semantic boundaries** - Use exact lookup and comparison rather than adding one storage unit.
- [ ] **Actual extent** - Read first and last values from data, not requested bounds.
- [ ] **Direct conversions** - Replace repeated A → B → C conversions with a domain A → C helper.

**Organisation and comments**

- [ ] **Feature files** - Keep related files together with clear names and no needless directories.
- [ ] **Module exports** - Expose only the intended API and avoid dependency cycles.
- [ ] **Promise ownership** - Await, return, or explicitly handle each rejection.
- [ ] **Async wrappers** - Keep wrappers only when they add behaviour.
- [ ] **Comment format** - Apply the caller's JSDoc and // preference where applicable; block only if required.
- [ ] **Comment accuracy** - Explain constraints or unexpected behaviour and update stale comments.
- [ ] **Algorithm documentation** - Explain complex algorithms in JSDoc; illustrate very complex ones.
- [ ] **Function flow** - Explain non-obvious phases, ordering or state transitions not revealed by the code.

**Verification**

- [ ] **Typechecks** - Run applicable typechecks for changed construction sites and consumers.
- [ ] **Schema tests** - Verify changed schemas and guards accept valid and reject relevant invalid values.
- [ ] **Declarations** - Inspect emitted declarations when public compatibility is at risk.

## Guidance

### Contracts and construction

#### Tooling and contracts

- Follow repository tooling and prefer strict checking. Do not impose `isolatedDeclarations` or change configuration for unrelated work.
- Mixed value/type imports can use inline `type` specifiers where module configuration permits.

- Annotate public returns for stable contracts or declaration requirements; allow useful local inference. Inspect emitted declarations for compatibility.

- Use `unknown` when a value's shape is deliberately unspecified.

#### Required dependencies

- Do not make required constructor inputs optional to preserve tests or ease migration, then throw for missing clients. Update callers and fixtures so typechecks catch missing wiring before deployment.

  ```typescript
  type InvoiceApi = {
    getTotal(invoiceId: string): Promise<number>;
  };

  class InvoiceClient {
    constructor(private readonly invoices: InvoiceApi) {}

    getTotal(invoiceId: string): Promise<number> {
      return this.invoices.getTotal(invoiceId);
    }
  }

  const client = new InvoiceClient({ getTotal: async () => 100 });
  ```

- Model genuinely optional capabilities in the public API or expose a narrower client.

### Type models

#### Type modelling

##### Shapes and variants

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

##### Utility types

- Reuse established utility types after checking their definitions and behaviour. Helpers such as `Nullable` and `DeepMutable` are not TypeScript built-ins.
- Use recursive mutability or exact-type assertions only when the contract needs them; preserve branded fields.

### Schemas and narrowing

#### Schemas and boundary checks

- Use lazy or memoised schema factories only for recursion, initialisation, or allocation needs; follow established naming such as a `z` prefix.
- Local declaration constraints do not imply a general ban on schema-derived types.
- Parse at the trust boundary and derive types from the canonical schema; use meaningful `.max()` limits for input arrays.

  ```typescript
  const inputSchema = z.object({ ids: z.array(z.string()).max(100) });
  type Input = z.infer<typeof inputSchema>;
  const input = inputSchema.parse(requestBody);
  ```

#### Narrowing and errors

- Narrow with predicates or `instanceof` rather than asserting unchecked assumptions.

- Treat caught values as `unknown`; JavaScript can throw strings, objects, or null.

  ```typescript
  const message = error instanceof Error
    ? error.message
    : typeof error === "string" ? error : "Internal error";
  ```

- For boundary protection and resource limits, load [security](../security-best-practices/SKILL.md).

### Bounds and conversions

- Check the relationship between independently derived indices, searches, and bounds, even when each is valid alone. Clamp at the composition site; current caller behaviour is not the helper's contract.

  ```typescript
  // Bad: valid indices can produce a negative length and throw.
  const uncheckedOutput = new Float64Array(endIndex - startIndex);

  // Good: clamp both bounds and preserve their order before allocation.
  const start = Math.max(0, Math.min(startIndex, values.length));
  const end = Math.max(start, Math.min(endIndex, values.length));
  const output = new Float64Array(end - start);
  ```

- Do not express exclusive ends, strictly-after checks, or next-tick semantics as the current storage quantum plus one. Use an exact lookup followed by an equality or ordering check; storage precision is not a domain guarantee.
- Read actual first and last values from the data. A query window or declared range can extend beyond the available values.
- For repeated A → B → C conversions, look for or add an A → C primitive on the owning type. Keep conversion details out of callers.

### Organisation and comments

#### Modules and organisation

- Keep feature components, hooks, types, and constants together. Split utilities by responsibility; avoid directories for trivial helpers.
- Follow repository naming: typically PascalCase for component files, `useName` for hooks, descriptive camelCase for utilities, and `types.ts`/`constants.ts` for shared feature definitions.
- Prefer named re-exports for selected items; use wildcards only for the intended module API.

#### Comments

- Follow project comment conventions. When applying the caller's preference, use multi-line JSDoc for documentation and `//` for short comments.

  ```typescript
  /**
   * Cancels the pending request when its owner is disposed.
   */
  function disposeRequest() {
    // The request may outlive its UI owner.
    controller.abort();
  }
  ```

- Explain constraints and unexpected behaviour without describing obvious code.
- Document complex algorithms with multi-line JSDoc explaining their invariants and flow. Add an ASCII illustration for very complex algorithms.
- Use `//` comments for non-obvious phases, ordering constraints or state transitions that the code does not reveal. Name the actual constraint; function length alone does not require comments.
- Treat formatting as non-blocking unless project instructions require it.

- For ownership and dependency direction, load [architecture](../architecture-best-practices/SKILL.md).
- When comparing adapters, plugin lifecycles, events/direct calls, or pure decisions, selectively read [TypeScript design patterns](../design-review/references/typescript-patterns.md). Do not load the design workflow or unrelated examples for ordinary type checks.
- For failures and promise handling, load [error handling](../error-handling-best-practices/SKILL.md).

### Verification

- For schema or guard changes, load [testing](../testing-best-practices/SKILL.md).
