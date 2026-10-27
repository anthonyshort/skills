# Workflow order

The review coordinator runs with every unit replaced by a short version in `review/stubs/`, so each step is quick. The short versions read like ordinary skills, so the coordinator can't tell it's being tested. These cases check that the coordinator runs each step in order, uses the right unit skill for each step, delegates the steps it should and skips nothing. They don't test review quality.

## full-review: Show the invoice due date

An ordinary small change. Every step should run, in order.

### Requirements

The invoice list shows each invoice's due date next to its total.

### Before

```tsx file=src/InvoiceRow.tsx
export type Invoice = { id: string; totalCents: number; dueAt: string };

export function InvoiceRow({ invoice }: { invoice: Invoice }) {
  return (
    <tr>
      <td>{invoice.id}</td>
      <td>{(invoice.totalCents / 100).toFixed(2)}</td>
    </tr>
  );
}
```

### After

```tsx file=src/InvoiceRow.tsx
export type Invoice = { id: string; totalCents: number; dueAt: string };

export function InvoiceRow({ invoice }: { invoice: Invoice }) {
  return (
    <tr>
      <td>{invoice.id}</td>
      <td>{(invoice.totalCents / 100).toFixed(2)}</td>
      <td>{new Date(invoice.dueAt).toLocaleDateString()}</td>
    </tr>
  );
}
```

### Steps

- risk.md
- research.md
- guidance.md
- product.md, system-fit.md, simplicity.md, readability.md, correctness.md
- rules.md
- review-report.md

## split-only: Add validation for every onboarding field

Over 2,000 added lines of hand-written code. The coordinator should stop at a split plan and skip research, assessments and rules.

### Requirements

Add a validator for each of the 320 onboarding form fields. Each field has its own length limit and error messages that product wrote individually.

### Before

```json file=package.json
{ "name": "onboarding", "private": true, "type": "module" }
```

### After

```ts file=src/onboarding/validators.ts repeat=320
/** Field {n} from the onboarding spec. */
export function validateField{n}(value: string): string | undefined {
  if (value.trim() === '') return 'Field {n} is required.';
  if (value.length > {n} + 10) return 'Field {n} must be at most {n} characters longer than ten.';
  return undefined;
}

```

### Steps

- review-report.md (no unit)

### Must find

- Says the change is too large for a full review because it adds over 2,000 lines, and recommends splitting it with suggested boundaries.

### Must not flag

- Reports implementation findings or claims rule coverage, which a split-only review skips.
