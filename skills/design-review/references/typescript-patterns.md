# TypeScript design comparisons

These are illustrative alternatives, not preferred factory/class, emitter/async-iterable, or registration policies. Select a section only when its trade-off exists in the reviewed code. TypeScript mechanics, architectural criteria, error handling, and resource limits remain owned by their respective skills.

## Adapter versus forwarding layer

Keep an adapter when it translates a real boundary; remove forwarding that adds no contract or isolation.

```typescript
type Invoice = { id: string; totalCents: number };
type InvoiceReader = { get(id: string): Promise<Invoice> };

// Before: another name and call frame, but no adaptation.
function forward(reader: InvoiceReader): InvoiceReader {
  return { get: (id) => reader.get(id) };
}

// After: pass the existing capability directly at the wiring site.
declare const reader: InvoiceReader;
const featureReader = reader;

// Useful exception: the validated legacy boundary has a different shape.
type LegacyReader = {
  fetchInvoice(id: string): Promise<{ invoice_id: string; cents: number }>;
};
function adaptLegacy(legacy: LegacyReader): InvoiceReader {
  return {
    async get(id) {
      const row = await legacy.fetchInvoice(id);
      return { id: row.invoice_id, totalCents: row.cents };
    },
  };
}
```

The direct wiring adds no new function. The adapter owns a shape mismatch and propagates failures unchanged. If failures differ, map them according to the actual domain contract rather than silently flattening them. Retain an apparently thin boundary when it enforces access, stable ownership, instrumentation, or supported compatibility; inspect consumers before removing it.

## Necessary plugin lifecycle versus needless registry

For one fixed feature, a registry can hide construction order and missing dependencies without enabling a real extension use case.

```typescript
type Stop = () => void;
declare function startAutosave(): Stop;

// Before: dynamic lookup for a single statically known operation.
const registry = new Map<string, () => Stop>([["autosave", startAutosave]]);
function startBefore(): Stop {
  const start = registry.get("autosave");
  if (!start) throw new Error("Missing autosave");
  return start();
}

// After: construction fails at typecheck if the capability disappears.
function startAfter(): Stop {
  return startAutosave();
}
```

When independent optional extensions really register and release resources, expose only the capabilities they need and a clear stop handle.

```typescript
type Stop = () => void;
type Host = {
  onSave(listener: () => void): Stop;
  addCommand(name: string, run: () => void): Stop;
};
type Plugin = { start(host: Host): Stop };

function savePlugin(showSaved: () => void, save: () => void): Plugin {
  return {
    start(host) {
      const stopSave = host.onSave(showSaved);
      let removeCommand: Stop;
      try {
        removeCommand = host.addCommand("save", save);
      } catch (error) {
        stopSave();
        throw error;
      }
      return () => {
        try { removeCommand(); } finally { stopSave(); }
      };
    },
  };
}
```

Here host stop handles are non-throwing and idempotent, and failed registration leaves no resource behind. Verify those guarantees; otherwise preserve the system's cleanup-error policy without losing the original setup error. The pair does not justify dependency resolvers, priorities, dynamic discovery, or a registry unless supported plugins need them. Keep one lifecycle owner and define what repeated start/stop means.

## Events for notifications, direct calls for required results

An emitter can decouple independent observers. It cannot replace an awaited command when the caller needs its result or must stop on failure.

```typescript
declare const events: { emit(name: "save", id: string): void };
declare function save(id: string): Promise<{ revision: number }>;
declare function showSaved(revision: number): void;

// Before: no completion or failure contract; notification races persistence.
function saveBefore(id: string): void {
  events.emit("save", id);
  showSaved(0);
}

// After: the real revision is available only after successful persistence.
async function saveAfter(id: string): Promise<void> {
  const saved = await save(id);
  showSaved(saved.revision);
}
```

The before form is a defect only if “saved” requires successful persistence. Request/response belongs in a returned value/promise, not a correlation-ID event protocol for one known owner. Preserve serial ordering if several required steps depend on each other; do not replace awaited calls with fire-and-forget notifications.

For a genuine notification, the observer owns its subscription lifetime:

```typescript
type Saved = { id: string; revision: number };
type SavedEvents = {
  onSaved(listener: (event: Saved) => void): () => void;
};
declare function invalidate(id: string): void;

// Before: mounting repeatedly retains every observer.
function mountBefore(events: SavedEvents): void {
  events.onSaved((event) => invalidate(event.id));
}

// After: the mounting owner calls the returned stop handle on disposal.
function mountAfter(events: SavedEvents): () => void {
  return events.onSaved((event) => invalidate(event.id));
}
```

Specify actual publication semantics: emit only after save succeeds; define synchronous listener order and whether one throw stops later listeners. If observers run asynchronously, own every rejection and define whether completion is awaited. Do not silently change these semantics when replacing direct calls with an emitter or async iterable. Keep direct calls when a single known consumer is simpler; no event infrastructure is required by this example.

## Pure decision, explicit effect, cohesive implementation

Separate a meaningful decision from I/O when it removes hidden state and makes the decision reusable. Do not split every expression into a policy framework.

```typescript
type Invoice = { totalCents: number; sent: boolean };
type Sender = { send(invoice: Invoice): Promise<void> };

// Before: the decision is only accessible through an effectful operation.
async function sendBefore(invoice: Invoice, sender: Sender): Promise<void> {
  if (invoice.totalCents > 0 && !invoice.sent) await sender.send(invoice);
}

// After: a second caller can use the same decision without performing I/O.
function canSend(invoice: Invoice): boolean {
  return invoice.totalCents > 0 && !invoice.sent;
}
async function sendAfter(invoice: Invoice, sender: Sender): Promise<void> {
  if (canSend(invoice)) await sender.send(invoice);
}

// Avoid: fragmenting the same small decision without separate responsibilities.
const positive = (value: number): boolean => value > 0;
const not = (value: boolean): boolean => !value;
const both = (a: boolean, b: boolean): boolean => a && b;
function fragmented(invoice: Invoice): boolean {
  return both(positive(invoice.totalCents), not(invoice.sent));
}
```

If no other caller or test needs the decision independently, the original cohesive function may be best. Both forms await the send and propagate rejection; neither guarantees concurrent-send idempotency. Preserve transaction checks at the effect boundary rather than treating a pure precheck as authority. Judge the total concepts and call sites, not the number of pure functions.
