# End to end

A few full reviews with the real skills, to check the units work together. Each case checks the report's findings and that every step ran in order. Unit behaviour is tested in the unit folders, so keep this set small.

## shared-imports-feature: Default the date picker to the billing period

A shared component starts importing a feature store. It works today, but every other consumer of the picker now depends on billing.

### Requirements

The date range picker should open on the current billing period on the invoices page. Other pages keep the last-30-days default.

### Before

```md file=ARCHITECTURE.md
# Architecture

- `src/shared/` holds reusable UI and utilities. It must not import from `src/features/`.
- `src/features/<name>/` holds one feature. Features may import `src/shared/`. Other features use a feature only through its `index.ts`.
```

```tsx file=src/shared/ui/DateRangePicker.tsx
import { useState } from 'react';

export type DateRange = { from: Date; to: Date };

function lastThirtyDays(): DateRange {
  const to = new Date();
  return { from: new Date(to.getTime() - 30 * 86_400_000), to };
}

export function DateRangePicker({ onChange }: { onChange: (range: DateRange) => void }) {
  const [range, setRange] = useState(lastThirtyDays);
  const update = (next: DateRange) => {
    setRange(next);
    onChange(next);
  };
  return <RangeInputs value={range} onChange={update} />;
}

function RangeInputs({ value, onChange }: { value: DateRange; onChange: (range: DateRange) => void }) {
  return (
    <div>
      <input type="date" value={value.from.toISOString().slice(0, 10)} onChange={e => onChange({ ...value, from: new Date(e.target.value) })} />
      <input type="date" value={value.to.toISOString().slice(0, 10)} onChange={e => onChange({ ...value, to: new Date(e.target.value) })} />
    </div>
  );
}
```

```ts file=src/features/billing/store.ts
import { proxy, useSnapshot } from 'valtio';

export const billingStore = proxy({ periodStart: new Date('2026-10-01'), periodEnd: new Date('2026-10-31') });

export function useBillingPeriod() {
  const snap = useSnapshot(billingStore);
  return { from: snap.periodStart, to: snap.periodEnd };
}
```

```ts file=src/features/billing/index.ts
export { useBillingPeriod } from './store';
```

```tsx file=src/features/invoices/InvoicesPage.tsx
import { DateRangePicker } from '../../shared/ui/DateRangePicker';

export function InvoicesPage({ onRangeChange }: { onRangeChange: (range: { from: Date; to: Date }) => void }) {
  return <DateRangePicker onChange={onRangeChange} />;
}
```

```tsx file=src/features/reports/ReportsPage.tsx
import { DateRangePicker } from '../../shared/ui/DateRangePicker';

export function ReportsPage({ onRangeChange }: { onRangeChange: (range: { from: Date; to: Date }) => void }) {
  return <DateRangePicker onChange={onRangeChange} />;
}
```

### After

```tsx file=src/shared/ui/DateRangePicker.tsx
import { useState } from 'react';
import { useBillingPeriod } from '../../features/billing/store';

export type DateRange = { from: Date; to: Date };

function lastThirtyDays(): DateRange {
  const to = new Date();
  return { from: new Date(to.getTime() - 30 * 86_400_000), to };
}

export function DateRangePicker({ onChange, useBilling = false }: { onChange: (range: DateRange) => void; useBilling?: boolean }) {
  const billingPeriod = useBillingPeriod();
  const [range, setRange] = useState(() => (useBilling ? billingPeriod : lastThirtyDays()));
  const update = (next: DateRange) => {
    setRange(next);
    onChange(next);
  };
  return <RangeInputs value={range} onChange={update} />;
}

function RangeInputs({ value, onChange }: { value: DateRange; onChange: (range: DateRange) => void }) {
  return (
    <div>
      <input type="date" value={value.from.toISOString().slice(0, 10)} onChange={e => onChange({ ...value, from: new Date(e.target.value) })} />
      <input type="date" value={value.to.toISOString().slice(0, 10)} onChange={e => onChange({ ...value, to: new Date(e.target.value) })} />
    </div>
  );
}
```

```tsx file=src/features/invoices/InvoicesPage.tsx
import { DateRangePicker } from '../../shared/ui/DateRangePicker';

export function InvoicesPage({ onRangeChange }: { onRangeChange: (range: { from: Date; to: Date }) => void }) {
  return <DateRangePicker onChange={onRangeChange} useBilling />;
}
```

### Must find

- The shared `DateRangePicker` now imports from `src/features/billing`, reversing the documented dependency direction so every consumer of the shared picker depends on billing.
- Recommends keeping billing knowledge in the invoices feature, such as passing an initial range prop from `InvoicesPage` using `useBillingPeriod` from the billing `index.ts`.
- The report's rule results record a concern for the "Keep shared code independent of its consumers" rule.

### Must read

- `review-rules/rules/keep-shared-code-independent.md`

### Steps

- risk.md
- research.md
- guidance.md
- product.md, system-fit.md, simplicity.md, readability.md, correctness.md
- rules.md
- review-report.md

## native-set-in-proxy: Select rows in the invoice table

A native `Set` inside a proxy does not notify subscribers when it changes.

### Requirements

Clicking a row toggles its selection. The toolbar shows how many invoices are selected and updates immediately.

### Before

```json file=package.json
{ "name": "invoices", "private": true, "dependencies": { "react": "18.3.1", "valtio": "1.13.2" } }
```

```ts file=src/invoiceStore.ts
import { proxy } from 'valtio';

export const invoiceStore = proxy({ invoices: [] as { id: string; total: number }[] });
```

### After

```ts file=src/invoiceStore.ts
import { proxy } from 'valtio';

export const invoiceStore = proxy({
  invoices: [] as { id: string; total: number }[],
  selectedIds: new Set<string>(),
});

export function toggleSelected(id: string): void {
  if (invoiceStore.selectedIds.has(id)) invoiceStore.selectedIds.delete(id);
  else invoiceStore.selectedIds.add(id);
}
```

```tsx file=src/InvoiceToolbar.tsx
import { useSnapshot } from 'valtio';
import { invoiceStore } from './invoiceStore';

export function InvoiceToolbar() {
  const snap = useSnapshot(invoiceStore);
  return <span>{snap.selectedIds.size} selected</span>;
}
```

### Must find

- `selectedIds` is a native `Set`, which Valtio v1 does not track, so `add` and `delete` do not notify subscribers and the toolbar count does not update. Recommends `proxySet` from `valtio/utils`.


### Must read

- `best-practices/valtio/SKILL.md`

### Steps

- risk.md
- research.md
- guidance.md
- product.md, system-fit.md, simplicity.md, readability.md, correctness.md
- rules.md
- review-report.md

## retried-charge: Retry payments on network errors

Retrying a charge without an idempotency key can charge the customer twice.

### Requirements

Checkout retries the payment request up to three times when the network fails, so a dropped connection doesn't lose the sale.

### Before

```ts file=server/payments.ts
import { app } from './app';
import { paymentProvider } from './paymentProvider';

app.post('/api/charges', async (req, res) => {
  const charge = await paymentProvider.charge({ customerId: req.body.customerId, amountCents: req.body.amountCents });
  res.json({ chargeId: charge.id });
});
```

```ts file=src/checkout.ts
export async function pay(customerId: string, amountCents: number): Promise<string> {
  const response = await fetch('/api/charges', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId, amountCents }),
  });
  return (await response.json()).chargeId;
}
```

### After

```ts file=src/checkout.ts
export async function pay(customerId: string, amountCents: number): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch('/api/charges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, amountCents }),
      });
      return (await response.json()).chargeId;
    } catch (error) {
      if (attempt === 3) throw error;
    }
  }
}
```

### Must find

- If the charge succeeds but the response is lost, the retry sends a new charge request and the customer is charged twice. Recommends an idempotency key created once per checkout and passed through to the payment provider, so a retry returns the original charge.
- The report's rule results record a concern for the "Check retries for repeated side effects" rule.

### Must read

- `review-rules/rules/check-retries-for-repeated-effects.md`

### Steps

- risk.md
- research.md
- guidance.md
- product.md, system-fit.md, simplicity.md, readability.md, correctness.md
- rules.md
- review-report.md

## injected-adapter: Export reports through the storage adapter

A control case. The change follows the documented boundaries, so the review should not invent coupling problems.

### Requirements

Add a domain operation that exports a report as CSV through the existing storage adapter, so it works with both the S3 and local-disk backends. The export button that calls it is a separate PR.

### Before

```md file=ARCHITECTURE.md
# Architecture

- `src/domain/` holds business operations. They receive infrastructure through adapter interfaces defined in `src/domain/ports.ts`.
- `src/infrastructure/` implements those adapters. Domain code must not import it.
- `src/app.ts` wires adapters into domain operations.
```

```ts file=src/domain/ports.ts
export interface FileStorage {
  save(path: string, contents: string, contentType: string): Promise<{ url: string }>;
}
```

```ts file=src/domain/reports/report.ts
export type Report = { id: string; rows: { label: string; value: number }[] };
```

```ts file=src/infrastructure/s3Storage.ts
import type { FileStorage } from '../domain/ports';

export function s3Storage(bucket: string): FileStorage {
  return {
    async save(path, contents, contentType) {
      // Upload omitted for brevity.
      return { url: `https://${bucket}.s3.amazonaws.com/${path}` };
    },
  };
}
```

```ts file=src/infrastructure/localDiskStorage.ts
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { FileStorage } from '../domain/ports';

export function localDiskStorage(root: string): FileStorage {
  return {
    async save(path, contents) {
      const target = join(root, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, contents);
      return { url: pathToFileURL(resolve(target)).href };
    },
  };
}
```

```ts file=src/app.ts
import { localDiskStorage } from './infrastructure/localDiskStorage';
import { s3Storage } from './infrastructure/s3Storage';

export const storage = process.env.STORAGE === 's3' ? s3Storage(process.env.REPORTS_BUCKET!) : localDiskStorage('./data');
```

### After

```ts file=src/domain/reports/exportReport.ts
import type { FileStorage } from '../ports';
import type { Report } from './report';

export async function exportReport(report: Report, storage: FileStorage): Promise<string> {
  const csv = ['label,value', ...report.rows.map(row => `${csvField(row.label)},${row.value}`)].join('\n');
  const { url } = await storage.save(`reports/${report.id}.csv`, csv, 'text/csv');
  return url;
}

function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
```

```ts file=src/app.ts
import { localDiskStorage } from './infrastructure/localDiskStorage';
import { s3Storage } from './infrastructure/s3Storage';
import { exportReport } from './domain/reports/exportReport';
import type { Report } from './domain/reports/report';

export const storage = process.env.STORAGE === 's3' ? s3Storage(process.env.REPORTS_BUCKET!) : localDiskStorage('./data');

export function exportReportToStorage(report: Report): Promise<string> {
  return exportReport(report, storage);
}
```

### Must not flag

- Reports a dependency-direction, layering or coupling problem as a required fix. The domain operation depends only on the `FileStorage` port and `app.ts` does the wiring, as documented.
- Recommends adding a plugin system, registry, event bus or other new abstraction for exporting reports.

### Steps

- risk.md
- research.md
- guidance.md
- product.md, system-fit.md, simplicity.md, readability.md, correctness.md
- rules.md
- review-report.md
