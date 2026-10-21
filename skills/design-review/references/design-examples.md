# Design comparisons

These examples are illustrative, not user-confirmed recipes. Read only the sections relevant to the assigned concern. Apply the architecture/API skill's criteria to actual owners and callers; do not recommend a rewrite because code resembles a “before” example.

## Derive live values; preserve snapshots

When a total must always reflect current lines, remove the second mutable value and its update paths.

```typescript
type Line = { amount: number };
const lines: Line[] = [];

// Before: every mutation must also maintain total.
let total = 0;
function addLineBefore(line: Line): void {
  lines.push(line);
  total += line.amount;
}

// After: one source of truth, including edits and removals.
function currentTotal(): number {
  return lines.reduce((sum, line) => sum + line.amount, 0);
}
```

Keep a persisted invoice total when it is a historical snapshot, not a live derivation. For expensive live calculations, inspect workload and invalidation before replacing a measured cache with repeated computation. Update subscriptions if callers previously observed a stored field.

## Keep domain operations independent of mounted UI

If a domain operation is required without an editor, pass the actual command rather than requiring a mounted component or a fake editor object.

```typescript
type Rename = (id: string, name: string) => Promise<void>;
type Editor = { selectedId: string; rename: Rename };

// Before: an unrelated caller must obtain an editor.
async function renameBefore(editor: Editor, name: string): Promise<void> {
  await editor.rename(editor.selectedId, name);
}

// After: the UI supplies selection; the operation accepts domain inputs.
async function renameAfter(rename: Rename, id: string, name: string): Promise<void> {
  await rename(id, name);
}
```

Move real validation, permission checks, persistence, and history grouping with the domain operation. Do not add this forwarding helper if callers can simply call the existing `rename(id, name)` capability. Keep editor ownership when the operation genuinely concerns editor-local selection or undo rather than a shared domain change.

## Align lifecycle contracts, not unrelated owners

A common stop handle can remove special-case bookkeeping when subscriptions have the same lifetime.

```typescript
declare function watchA(): { stop(): void };
declare function watchB(): () => void;

// Before: each owner needs to know both cleanup shapes.
function startBefore(): () => void {
  const a = watchA();
  const stopB = watchB();
  return () => { try { stopB(); } finally { a.stop(); } };
}

// After migrating watchA's contract: callers own one cleanup shape.
declare function watchAAfter(): () => void;
function startAfter(): () => void {
  const stopA = watchAAfter();
  const stopB = watchB();
  return () => { try { stopB(); } finally { stopA(); } };
}
```

Both retain reverse cleanup order and attempt `A` cleanup if `B` throws. Neither solves partial setup failure: if starting `B` can throw, release `A` before propagating the error. Verify the existing policy if both cleanup operations throw. Do not impose view disposal on a shared session store or combine owners merely to make signatures uniform. A new wrapper alone does not justify this migration.

## Remove interaction states only when intent permits

If the task is immediate single-item activation, a selection-and-confirm interaction may be unnecessary.

```typescript
declare function activate(id: string): Promise<void>;

// Before: selection can exist independently of the action.
let selectedId: string | undefined;
function select(id: string): void { selectedId = id; }
async function confirm(): Promise<void> {
  if (selectedId === undefined) return;
  await activate(selectedId);
  selectedId = undefined;
}

// After: a button's awaited action needs no pending selection.
async function activateItem(id: string): Promise<void> {
  await activate(id);
}
```

This intentionally changes the interaction, not just implementation. Recommend it only with product evidence. Retain confirmation for destructive work, batching, preview, or accessibility requirements; preserve error feedback, loading state, and duplicate-action protection at the UI boundary.

## Show function consumer improvements

When names and fake positional values obscure the task, compare the actual call.

```typescript
declare function loadBefore(
  id: string, refresh: boolean, unusedCursor: string,
): Promise<readonly string[]>;
declare function loadAfter(
  id: string, options?: { refresh?: boolean },
): Promise<readonly string[]>;

async function labels(): Promise<void> {
  // Before: callers must know why the empty string is required.
  const oldLabels = await loadBefore("invoice-42", true, "");
  // After: the supported operation needs no pagination placeholder.
  const newLabels = await loadAfter("invoice-42", { refresh: true });
  console.log(oldLabels, newLabels);
}
```

Removing the cursor is valid only if this operation does not support pagination. Preserve pagination as a real capability where needed. Keep rejection and refresh semantics unchanged; migrate all callers or retain the established compatibility boundary. A clear `loadLabels(id)` needs neither an options object nor a builder.

## Show HTTP consumer improvements without hiding failures

A resource-shaped endpoint may remove command envelopes and caller unpacking when it fits the existing HTTP contract.

```typescript
async function before(): Promise<unknown> {
  const response = await fetch("/commands", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "listInvoices", accountId: "account-7" }),
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

async function after(): Promise<unknown> {
  const response = await fetch("/accounts/account-7/invoices");
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}
```

These calls deliberately leave the payload untrusted; use the existing boundary schema and error decoder in production. Show the actual response use in a real proposal. Preserve authorisation, pagination, failure distinctions, caching and retry semantics; changing POST to GET is not automatically equivalent. Keep command endpoints for genuine commands, and avoid a transport migration for naming alone.

## Make direction incremental

If an adopted client supports the changed use case, migrate that caller without forcing unrelated consumers into the PR.

```typescript
type Invoice = { id: string };
declare const legacy: { loadInvoice(id: string): Promise<Invoice> };
declare const current: { invoices: { get(id: string): Promise<Invoice> } };

// Before: the touched consumer uses a superseded entrypoint.
function loadBefore(id: string): Promise<Invoice> {
  return legacy.loadInvoice(id);
}

// After: migrate this consumer, not every legacy feature.
function loadAfter(id: string): Promise<Invoice> {
  return current.invoices.get(id);
}
```

Confirm matching auth, errors, cancellation, caching, and lifecycle before treating the clients as interchangeable. Name remaining consumers and the compatibility boundary. If the replacement is only planned or lacks required behaviour, keep the intermediate state and report the dependency instead of blocking on a wholesale rewrite.
