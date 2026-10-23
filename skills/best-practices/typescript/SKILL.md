---
name: typescript
description: Use when writing, refactoring, or reviewing TypeScript API design, classes, interfaces, types, narrowing, schemas, async APIs, performance, resource lifetimes, module boundaries, and file organisation.
---

# TypeScript best practices

## Goal

Keep TypeScript contracts, construction, and validation explicit so incorrect wiring and invalid states are caught before runtime. Prevent performance and resource problems using evidence from real workloads.

## Guidance

### API design and construction

#### Tooling and contracts

- Search for canonical types before adding replacement models. Name types and functions for their domain purpose.
- Consider an options object for three or more parameters when it makes calls clearer. Preserve existing contracts unless migrating callers.

- Follow repository tooling and prefer strict checking. Do not impose `isolatedDeclarations` or change configuration for unrelated work.
- Mixed value/type imports can use inline `type` specifiers where module configuration permits.

- Annotate public returns for stable contracts or declaration requirements; allow useful local inference. Inspect emitted declarations for compatibility.

- Use `unknown` when a value's shape is deliberately unspecified.

Design classes, functions and interfaces as if they belonged to a published package. Make them easy to use without knowing their internals.

Prefer functions and plain objects when they are enough. Classes are useful for state and lifecycle, but avoid deep inheritance hierarchies. Use composition and dependency injection to connect behaviour.

#### Prefer composition over inheritance

Inject the capabilities an operation needs. Avoid inheriting a large implementation just to reuse one operation.

**Avoid: inheriting unrelated capabilities**

```typescript
class InvoiceService extends ApplicationServices {
  async getTotal(id: string): Promise<number> {
    const invoice = await this.database.loadInvoice(id);
    return calculateTotal(invoice.lines);
  }
}
```

**Prefer: require the specific capability**

```typescript
type LoadInvoice = (id: string) => Promise<Invoice>;

function createInvoiceService(loadInvoice: LoadInvoice) {
  return {
    async getTotal(id: string): Promise<number> {
      const invoice = await loadInvoice(id);
      return calculateTotal(invoice.lines);
    },
  };
}
```

A class with constructor injection is also fine. The goal is clear dependencies and a small responsibility.

#### Keep core logic independent of effects

Use pure functions for calculations and decisions when this makes them easier to understand, reuse or test. Keep network, storage and framework dependencies outside that core.

**Avoid: requiring a service to perform a calculation**

```typescript
class InvoiceCalculator {
  constructor(private readonly database: Database) {}

  async calculateTotal(id: string): Promise<number> {
    const invoice = await this.database.loadInvoice(id);
    return invoice.lines.reduce((total, line) => total + line.amount, 0);
  }
}
```

**Prefer: calculate from values**

```typescript
function calculateTotal(lines: readonly Line[]): number {
  return lines.reduce((total, line) => total + line.amount, 0);
}

async function getInvoiceTotal(
  loadInvoice: LoadInvoice,
  id: string,
): Promise<number> {
  const invoice = await loadInvoice(id);
  return calculateTotal(invoice.lines);
}
```

Do not extract every expression into a helper. Keep small operations together when splitting them adds more concepts than it removes.

#### Own the wiring at the public boundary

Compose internal dependencies inside an exported factory or class. Give callers a simple interface and expose only configuration they need.

**Avoid: making every caller assemble the internals**

```typescript
const transport = new HttpTransport(fetch);
const repository = new InvoiceRepository(transport);
const calculator = new InvoiceCalculator();
const service = new InvoiceService(repository, calculator);

const total = await service.getTotal("invoice-42");
```

**Prefer: let the public API assemble them**

```typescript
const invoices = createInvoiceClient({ fetch });
const total = await invoices.getTotal("invoice-42");
```

The factory can connect the internal pieces:

```typescript
export function createInvoiceClient(options: { fetch: typeof fetch }) {
  const loadInvoice = createInvoiceLoader(options.fetch);

  return {
    getTotal: (id: string) => getInvoiceTotal(loadInvoice, id),
  };
}
```

Keep dependencies flowing inward. Core functions should not import the public wrapper or know about its transport.

#### Make construction safe

Require dependencies needed by supported operations. Do not allow incomplete objects that fail later when used.

**Avoid: optional dependencies that are actually required**

```typescript
class InvoiceClient {
  constructor(private readonly api?: InvoiceApi) {}

  getTotal(id: string): Promise<number> {
    if (!this.api) throw new Error("Missing invoice API");
    return this.api.getTotal(id);
  }
}
```

**Prefer: catch missing wiring during typechecking**

```typescript
class InvoiceClient {
  constructor(private readonly api: InvoiceApi) {}

  getTotal(id: string): Promise<number> {
    return this.api.getTotal(id);
  }
}
```

Update callers and fixtures instead of hiding missing dependencies with casts. Model genuinely optional capabilities explicitly or expose a narrower interface.

#### Judge the API through real usage

- **Clear calls**: Avoid fake values, confusing flags and unnecessary bookkeeping.
- **Useful results**: Return values callers can use without unpacking implementation details.
- **Clear obligations**: Make errors, async completion, cancellation and cleanup understandable.
- **Small surface**: Keep internal helpers private. Add configuration or extension points only for demonstrated needs.
- **Concrete comparisons**: Show before-and-after caller code when proposing an API change.

Use the published-package test to judge usability. It does not require package infrastructure, builders, registries or versioning.

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

- Narrow with predicates or `instanceof` rather than asserting unchecked assumptions. Custom guards must validate every property their claimed type requires. Avoid `any` and unchecked casts.

- Treat caught values as `unknown`; JavaScript can throw strings, objects, or null.

  ```typescript
  const message = error instanceof Error
    ? error.message
    : typeof error === "string" ? error : "Internal error";
  ```

- For HTTP access protection and request limits, use [HTTP API guidance](../http-api/SKILL.md). For general resource growth and cleanup, use the performance and resources guidance below.

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
- Prefer named re-exports for selected items. Use wildcards only for the intended module API. Avoid dependency cycles.
- Await, return or explicitly handle each promise rejection. Keep async wrappers only when they add behaviour.

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

- When comparing specific designs, read only the relevant review rule: [wrappers](../../review/rules/remove-wrappers-that-add-no-value.md), [plugin lifecycle](../../review/rules/use-registries-for-real-extensions.md), [events and direct calls](../../review/rules/await-required-operations.md) or [decision extraction](../../review/rules/extract-decisions-only-when-useful.md).
- For failures and promise handling, load [error handling](../error-handling/SKILL.md).

### Performance and resources

#### Workload and repeated work

- Establish the affected workload and required performance. Support findings with measurements or a concrete execution path. Another approach being theoretically faster is not enough.
- Trace repeated requests or computations to their logical inputs. Establish frequency and cost before proposing caching or batching. Distinguish cheap status checks from expensive encoding, uploads, subscriptions or fetches. Check whether expensive work repeats after success.
- Check algorithm cost against expected input growth. Prefer a simpler single-pass or greedy approach only when it preserves the required result. Use native loops where they improve clarity or address a demonstrated cost.
- Prefer `flatMap` over `filter().map()` when it expresses the same operation clearly. Treat this as a style preference. Make performance claims only with workload evidence.
- When caching or batching, trace freshness, cancellation and failure behaviour through the proposed change.

#### Resources and concurrency

- Trace how buffers, caches, queues and parallel tasks grow and drain. Consider both item count and memory size across inputs and lifetimes.
- Identify synchronous work blocking a latency-sensitive event loop before recommending asynchronous I/O, yielding or offloading.
- Before parallelising, show that sequential independent work causes relevant delay. Preserve required ordering, failure handling and resource limits.

#### Background work and cleanup

- Follow timers, subscriptions and background tasks from creation through cleanup. Check for retained resources, work surviving its owner and work preventing expected shutdown.
- Register returned cleanup with its owner. Clearing a timer does not cancel work already started.
- Before replacing polling, compare its frequency and cost with an available event mechanism. Preserve required update and failure behaviour.

### Browser APIs and loading

#### Prefer existing capabilities

Check native APIs and existing dependencies before adding a library or build step.

- Use `fetch`, `URL`, `URLSearchParams` and `Intl` when they meet the required behaviour.
- Preserve errors, retries, cancellation and compatibility when replacing a library.
- Check the values being copied before using `structuredClone`. It supports dates but cannot copy functions or DOM nodes.

#### Write untrusted text safely

Use text APIs for untrusted text. A `<template>` does not make interpolated markup safe.

```typescript
// Avoid: input becomes markup.
message.innerHTML = untrustedText;

// Prefer: input remains text.
message.textContent = untrustedText;
```

Use an established sanitiser when the feature intentionally accepts HTML. Do not build a custom escaping system.

#### Check browser loading costs

- Inspect actual bundle output. Import syntax alone does not prove unused code was removed.
- Split optional features or defer non-critical scripts when this improves loading.
- Measure affected rendering and interaction paths before claiming a performance improvement.
- For markup and browser interaction checks, use [HTML guidance](../html/SKILL.md). This also applies to JSX.

### Verification

- Run applicable typechecks for changed construction sites and consumers.
- Check changed schemas and guards with valid and relevant invalid inputs.
- Inspect emitted declarations when public compatibility is at risk.

- For schema or guard changes, load [testing](../testing/SKILL.md).
