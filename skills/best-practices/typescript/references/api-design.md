# API design and construction

Design classes, functions and interfaces as if they belonged to a published package. Make them easy to use without knowing their internals.

Prefer functions and plain objects when they are enough. Classes are useful for state and lifecycle, but avoid deep inheritance hierarchies. Use composition and dependency injection to connect behaviour.

## Prefer composition over inheritance

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

## Keep core logic independent of effects

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

## Own the wiring at the public boundary

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

## Make construction safe

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

## Preserve method receivers in callbacks

When passing a method as a callback, check whether it uses `this`. Preserve its receiver through the existing binding convention.

```typescript
// Bad when save relies on this and is not already bound.
onSave(client.save);

// Good: preserves the receiver.
onSave(() => client.save());
```

An already-bound method or arrow property can be passed directly. Preserve callback arguments and return values when wrapping methods that need them.

## Judge the API through real usage

- **Clear calls**: Avoid fake values, confusing flags and unnecessary bookkeeping.
- **Useful results**: Return values callers can use without unpacking implementation details.
- **Clear obligations**: Make errors, async completion, cancellation and cleanup understandable.
- **Small surface**: Keep internal helpers private. Add configuration or extension points only for demonstrated needs.
- **Concrete comparisons**: Show before-and-after caller code when proposing an API change.

Use the published-package test to judge usability. It does not require package infrastructure, builders, registries or versioning.
