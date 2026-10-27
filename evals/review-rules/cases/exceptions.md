# Rule exceptions

Each change looks like a rule violation but meets that rule's stated exception. The rule pass should select and read the rule, then record it as satisfied rather than a concern.

## access-wrapper: Expose invoices to the partner API

A thin wrapper that enforces access control at a trust boundary. The "Remove wrappers" rule's exceptions keep it.

### Requirements

Partners can read invoices through the partner API. `requireInvoiceAccess` must succeed before any read. Internal callers keep using the reader directly.

### Before

```ts file=src/invoices/reader.ts
export type Invoice = { id: string; accountId: string; totalCents: number };
export type InvoiceReader = { get(id: string): Promise<Invoice> };
```

### After

```ts file=src/partner/invoices.ts
import type { InvoiceReader } from '../invoices/reader';

export function partnerInvoiceReader(
  reader: InvoiceReader,
  requireInvoiceAccess: (invoiceId: string) => Promise<void>,
): InvoiceReader {
  return {
    async get(id) {
      await requireInvoiceAccess(id);
      return reader.get(id);
    },
  };
}
```

### Must not flag

- Records a concern for the "Remove wrappers that add no value" rule, or recommends removing `partnerInvoiceReader`.

### Must read

- `review-rules/rules/remove-wrappers-that-add-no-value.md`

## historical-total: Save the total when an invoice is issued

A stored total that is an intentional historical snapshot. The "Avoid storing values that can be calculated" rule's exceptions keep it.

### Requirements

An issued invoice is a legal record. Save the total at the moment of issue. Later changes to prices or line items must not change an issued invoice's total.

### Before

```ts file=src/invoices/issue.ts
export type Line = { amountCents: number };
export type IssuedInvoice = { lines: Line[]; issuedAt: Date };

export function issue(lines: readonly Line[], now: Date): IssuedInvoice {
  return { lines: lines.map(line => ({ ...line })), issuedAt: now };
}
```

### After

```ts file=src/invoices/issue.ts
export type Line = { amountCents: number };
export type IssuedInvoice = { lines: Line[]; issuedAt: Date; totalAtIssueCents: number };

export function issue(lines: readonly Line[], now: Date): IssuedInvoice {
  const savedLines = lines.map(line => ({ ...line }));
  return {
    lines: savedLines,
    issuedAt: now,
    totalAtIssueCents: savedLines.reduce((sum, line) => sum + line.amountCents, 0),
  };
}
```

### Must not flag

- Records a concern for the "Avoid storing values that can be calculated" rule, or recommends calculating the issued total instead of storing it.

### Must read

- `review-rules/rules/avoid-duplicate-live-state.md`

## real-plugin-registry: Let integrations add toolbar buttons

A registry with several independently registered extensions. The "Use registries for real extension needs" rule's exceptions keep it.

### Requirements

Third-party integrations, each shipped as its own package, add buttons to the editor toolbar. Three integrations exist today (Jira, Slack and GitHub) and more are planned. Each one registers itself when its package loads and must be removable when it's disabled.

### Before

```ts file=src/toolbar/Toolbar.tsx
export function Toolbar({ buttons }: { buttons: { id: string; label: string; run(): void }[] }) {
  return <div>{buttons.map(button => <button key={button.id} onClick={button.run}>{button.label}</button>)}</div>;
}
```

### After

```ts file=src/toolbar/registry.ts
export type ToolbarButton = { id: string; label: string; run(): void };

const buttons = new Map<string, ToolbarButton>();
const listeners = new Set<() => void>();

export function registerToolbarButton(button: ToolbarButton): () => void {
  if (buttons.has(button.id)) throw new Error(`Toolbar button ${button.id} is already registered`);
  buttons.set(button.id, button);
  listeners.forEach(listener => listener());
  return () => {
    if (buttons.delete(button.id)) listeners.forEach(listener => listener());
  };
}

export function toolbarButtons(): ToolbarButton[] {
  return [...buttons.values()];
}

export function onToolbarChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
```

```ts file=packages/integration-jira/src/index.ts
import { registerToolbarButton } from '@app/toolbar/registry';

export function activate(): () => void {
  return registerToolbarButton({ id: 'jira.link', label: 'Link Jira issue', run: () => openJiraPicker() });
}

declare function openJiraPicker(): void;
```

```ts file=packages/integration-slack/src/index.ts
import { registerToolbarButton } from '@app/toolbar/registry';

export function activate(): () => void {
  return registerToolbarButton({ id: 'slack.share', label: 'Share to Slack', run: () => openSlackShare() });
}

declare function openSlackShare(): void;
```

```ts file=packages/integration-github/src/index.ts
import { registerToolbarButton } from '@app/toolbar/registry';

export function activate(): () => void {
  return registerToolbarButton({ id: 'github.link', label: 'Link pull request', run: () => openPullRequestPicker() });
}

declare function openPullRequestPicker(): void;
```

### Must not flag

- Records a concern for the "Use registries for real extension needs" rule, or recommends replacing the registry with direct calls.

### Must read

- `review-rules/rules/use-registries-for-real-extensions.md`
