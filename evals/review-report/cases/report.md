# Report

Each case supplies a complete set of review artefacts. The report should be faithful to them: merge duplicates, keep severities, resolve or surface disagreements, keep gaps visible and add no findings of its own invention.

## merge-duplicate-findings: Remove items from the cart

Correctness and the rule pass report the same bug. Readability has a nit. The report should show one required finding and keep the nit optional.

### Requirements

Users can remove an item from the cart. The cart total always equals the sum of the remaining items.

### Before

```ts file=src/cartStore.ts
import { proxy } from 'valtio';

export type CartItem = { id: string; priceCents: number };
export const cartStore = proxy({ items: [] as CartItem[], totalCents: 0 });

export function addItem(item: CartItem): void {
  cartStore.items.push(item);
  cartStore.totalCents += item.priceCents;
}
```

### After

```ts file=src/cartStore.ts
import { proxy } from 'valtio';

export type CartItem = { id: string; priceCents: number };
export const cartStore = proxy({ items: [] as CartItem[], totalCents: 0 });

export function addItem(item: CartItem): void {
  cartStore.items.push(item);
  cartStore.totalCents += item.priceCents;
}

export function removeItem(id: string): void {
  cartStore.items = cartStore.items.filter(item => item.id !== id);
}
```

### Inputs

```md file=risk.md
# Risk

- Size: 4 added lines in one file.
- Production risk: medium. The cart total is shown at checkout. A wrong total misleads customers, although the server recalculates the charge.
- Open question: does anything read `totalCents` besides the cart summary?
```

```md file=research.md
# Research

- Callers: `CartSummary.tsx` renders `cartStore.totalCents`. The server recalculates the charge from item ids.
- CI: unavailable. Slack, Notion and Linear: unavailable.
```

```md file=product.md
# Product

Verdict: proceed. Removing items is the requested feature. No conflicts found.
```

```md file=system-fit.md
# System fit

Verdict: fits. Store actions live next to the store, matching `addItem`.
```

```md file=simplicity.md
# Simplicity

Verdict: reasonably minimal. No simplifications found.
```

```md file=readability.md
# Readability

Verdict: clear. Nit (optional): `removeItem` could be named `removeCartItem` to match the store name. Preference, not a convention.
```

```md file=correctness.md
# Correctness

Verdict: defect found.

- C1 (P1): `removeItem` does not subtract the removed item's price. After removing a 500-cent item from a 1,500-cent cart, `totalCents` stays 1,500 while the items sum to 1,000. Source trace: `src/cartStore.ts:13-15`.
- Test coverage: none for `removeItem`.
```

```md file=rules.md
# Rule assessment

| Rule | Selection | Result | Finding |
| --- | --- | --- | --- |
| Avoid storing values that can be calculated | Selected | Concern found | `totalCents` is maintained by hand and `removeItem` forgets it. Derive it with a getter. |
| Keep shared state rules in shared actions | Selected | Satisfied | Both actions live in the store module. |

The other 16 rules were skipped as not relevant, each with a reason.
```

### Must find

- Reports the stale `totalCents` after `removeItem` as one required P1 finding that combines the correctness finding and the rule concern, recommending a derived total.
- Keeps the `removeCartItem` naming suggestion as an optional nit, not a required fix.
- Summarises the rule results: one concern, one satisfied and 16 skipped.

### Must not flag

- Lists the stale total as two separate findings.
- Adds a finding that none of the inputs support.

## unresolved-disagreement: Default the date picker to the billing period

System fit and simplicity disagree. The report should decide with evidence or record an open question, not silently drop one view.

### Requirements

The date range picker should open on the current billing period on the invoices page. Other pages keep the last-30-days default.

### Before

```md file=ARCHITECTURE.md
# Architecture

- `src/shared/` holds reusable UI and utilities. It must not import from `src/features/`.
```

```tsx file=src/shared/ui/DateRangePicker.tsx
export function DateRangePicker({ onChange }: { onChange: (range: { from: Date; to: Date }) => void }) {
  return <input type="date" onChange={e => onChange({ from: new Date(e.target.value), to: new Date() })} />;
}
```

### After

```tsx file=src/shared/ui/DateRangePicker.tsx
import { useBillingPeriod } from '../../features/billing/store';

export function DateRangePicker({ onChange, useBilling = false }: { onChange: (range: { from: Date; to: Date }) => void; useBilling?: boolean }) {
  const period = useBillingPeriod();
  return <input type="date" defaultValue={useBilling ? period.from.toISOString().slice(0, 10) : undefined} onChange={e => onChange({ from: new Date(e.target.value), to: new Date() })} />;
}
```

### Inputs

```md file=risk.md
# Risk

- Size: 4 changed lines. Production risk: low.
```

```md file=research.md
# Research

- `ARCHITECTURE.md` says `src/shared/` must not import from `src/features/`.
- Consumers of `DateRangePicker`: invoices page and reports page.
```

```md file=product.md
# Product

Verdict: proceed.
```

```md file=system-fit.md
# System fit

Verdict: conflicts with the system. `DateRangePicker` in `src/shared/` now imports `features/billing/store`, which `ARCHITECTURE.md` forbids. Every consumer, including reports, now depends on billing. Recommend passing an initial range prop from the invoices page.
```

```md file=simplicity.md
# Simplicity

Verdict: reasonably minimal. Adding a `useBilling` flag is the smallest change. Passing a prop would touch an extra file.
```

```md file=readability.md
# Readability

Verdict: clear.
```

```md file=correctness.md
# Correctness

Verdict: no defects found in the verified scope.
```

```md file=rules.md
# Rule assessment

| Rule | Selection | Result | Finding |
| --- | --- | --- | --- |
| Keep shared code independent of its consumers | Selected | Concern found | Shared picker imports a feature store. |

The other 17 rules were skipped as not relevant, each with a reason.
```

### Must find

- Addresses the disagreement between system fit and simplicity explicitly, and resolves it in favour of fixing the dependency because `ARCHITECTURE.md` forbids it, or records it as an open question with both views.
- Reports the shared-to-feature import as a finding with the recommended initial range prop.

### Must not flag

- Presents the change as fitting the system without mentioning the system fit conclusion or the rule concern.

## missing-assessment: Show the invoice due date

The simplicity assessment is missing and some rules weren't verified. The report should keep those gaps visible.

### Requirements

The invoice list shows each invoice's due date.

### Before

```tsx file=src/InvoiceRow.tsx
export function InvoiceRow({ invoice }: { invoice: { id: string; dueAt: string } }) {
  return <tr><td>{invoice.id}</td></tr>;
}
```

### After

```tsx file=src/InvoiceRow.tsx
export function InvoiceRow({ invoice }: { invoice: { id: string; dueAt: string } }) {
  return <tr><td>{invoice.id}</td><td>{new Date(invoice.dueAt).toLocaleDateString()}</td></tr>;
}
```

### Inputs

```md file=risk.md
# Risk

- Size: 1 changed line. Production risk: low.
```

```md file=research.md
# Research

- CI: unavailable. Slack, Notion and Linear: unavailable.
```

```md file=product.md
# Product

Verdict: proceed.
```

```md file=system-fit.md
# System fit

Verdict: fits.
```

```md file=readability.md
# Readability

Verdict: clear.
```

```md file=correctness.md
# Correctness

Verdict: no defects found in the verified scope. Not verified: how `toLocaleDateString` renders for users outside the US, because no locale requirement was found.
```

```md file=rules.md
# Rule assessment

| Rule | Selection | Result |
| --- | --- | --- |
| Keep API changes compatible with callers | Selected | Not verified: callers of `InvoiceRow` outside this repository could not be inspected. |

The other 17 rules were skipped as not relevant, each with a reason.

The simplicity worker failed and returned no assessment.
```

### Must find

- States that the simplicity assessment is missing, rather than reporting the change as reasonably minimal.
- Keeps the unverified rule and the unverified locale behaviour visible as gaps, distinct from passed checks.

### Must not flag

- Claims that simplicity was assessed or that every rule was satisfied.
