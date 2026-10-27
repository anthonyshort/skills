# Architecture and coupling

Cases where the code works but is in the wrong place, depends on the wrong things or duplicates an owner. Each case gives the reviewer an `ARCHITECTURE.md` so the expected boundaries are written down rather than guessed.

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

## domain-operation-needs-editor: Close editor tabs when archiving a project

A domain operation takes a mounted UI object, so the background job has to fake one.

### Requirements

Archiving a project marks it archived and closes any open editor tabs for it. Projects are archived from the project menu and by the nightly inactive-project job.

### Before

```md file=ARCHITECTURE.md
# Architecture

- `src/domain/` holds business operations. They run in the browser and in background jobs, so they must not depend on React, the DOM or editor UI objects.
- `src/ui/` holds components and editor integration.
- `src/jobs/` holds background jobs that run without any UI.
```

```ts file=src/domain/projects/archiveProject.ts
import { db } from '../db';

export async function archiveProject(projectId: string): Promise<void> {
  await db.projects.update(projectId, { archivedAt: new Date() });
}
```

```ts file=src/ui/editor/EditorView.ts
export interface EditorView {
  openTabs(): { id: string; projectId: string }[];
  closeTab(tabId: string): void;
  showToast(message: string): void;
}
```

```tsx file=src/ui/projects/ProjectMenu.tsx
import { archiveProject } from '../../domain/projects/archiveProject';

export function ProjectMenu({ projectId }: { projectId: string }) {
  return <button onClick={() => archiveProject(projectId)}>Archive</button>;
}
```

```ts file=src/jobs/archiveInactiveProjects.ts
import { archiveProject } from '../domain/projects/archiveProject';
import { db } from '../domain/db';

export async function archiveInactiveProjects(): Promise<void> {
  for (const project of await db.projects.inactiveSince(90)) {
    await archiveProject(project.id);
  }
}
```

### After

```ts file=src/domain/projects/archiveProject.ts
import { db } from '../db';
import type { EditorView } from '../../ui/editor/EditorView';

export async function archiveProject(projectId: string, editor: EditorView): Promise<void> {
  await db.projects.update(projectId, { archivedAt: new Date() });
  for (const tab of editor.openTabs()) {
    if (tab.projectId === projectId) editor.closeTab(tab.id);
  }
  editor.showToast('Project archived');
}
```

```tsx file=src/ui/projects/ProjectMenu.tsx
import { archiveProject } from '../../domain/projects/archiveProject';
import { useEditor } from '../editor/useEditor';

export function ProjectMenu({ projectId }: { projectId: string }) {
  const editor = useEditor();
  return <button onClick={() => archiveProject(projectId, editor)}>Archive</button>;
}
```

```ts file=src/jobs/archiveInactiveProjects.ts
import { archiveProject } from '../domain/projects/archiveProject';
import { db } from '../domain/db';

const noEditor = { openTabs: () => [], closeTab: () => {}, showToast: () => {} };

export async function archiveInactiveProjects(): Promise<void> {
  for (const project of await db.projects.inactiveSince(90)) {
    await archiveProject(project.id, noEditor);
  }
}
```

### Must find

- `archiveProject` is a domain operation that now depends on the editor UI, and the background job has to pass a fake no-op editor to call it.
- Recommends keeping `archiveProject` UI-free and closing tabs and showing the toast at the UI call site, or through an event or subscription the editor owns.

## import-cycle: Show team names next to user names

Two features that already have a one-way dependency start importing each other.

### Requirements

The team member list shows each member's display name followed by their team name. The users feature already formats display names and the teams feature formats team names.

### Before

```md file=ARCHITECTURE.md
# Architecture

- Each folder under `src/features/` is a feature. Other features import it only through its `index.ts`.
- Feature dependencies must stay acyclic. `users` is a lower-level feature that `teams` and others build on.
```

```ts file=src/features/users/index.ts
export type User = { id: string; firstName: string; lastName: string; nickname?: string; teamId: string };
export { getUserDisplayName } from './displayName';
export { getUserBadge } from './badge';
```

```ts file=src/features/users/displayName.ts
import type { User } from './index';

export function getUserDisplayName(user: User): string {
  return user.nickname ?? `${user.firstName} ${user.lastName}`;
}
```

```ts file=src/features/users/badge.ts
import type { User } from './index';
import { getUserDisplayName } from './displayName';

export function getUserBadge(user: User): string {
  return getUserDisplayName(user);
}
```

```ts file=src/features/teams/index.ts
export type Team = { id: string; name: string; memberIds: string[] };
export { getTeamName } from './teamName';
```

```ts file=src/features/teams/teamName.ts
import type { Team } from './index';

export function getTeamName(team: Team): string {
  return team.name.trim() || 'Untitled team';
}
```

### After

```ts file=src/features/users/badge.ts
import type { User } from './index';
import { getUserDisplayName } from './displayName';
import { getTeamName, type Team } from '../teams';

export function getUserBadge(user: User, teams: Map<string, Team>): string {
  const team = teams.get(user.teamId);
  return team ? `${getUserDisplayName(user)} · ${getTeamName(team)}` : getUserDisplayName(user);
}
```

```ts file=src/features/teams/memberList.ts
import { getUserBadge, type User } from '../users';
import type { Team } from './index';

export function memberLabels(team: Team, users: User[]): string[] {
  const teams = new Map([[team.id, team]]);
  return users.filter(user => team.memberIds.includes(user.id)).map(user => getUserBadge(user, teams));
}
```

```ts file=src/features/teams/index.ts
export type Team = { id: string; name: string; memberIds: string[] };
export { getTeamName } from './teamName';
export { memberLabels } from './memberList';
```

### Must find

- The change creates an import cycle between the `users` and `teams` features (`users/badge.ts` imports `teams`, and `teams/memberList.ts` imports `users`), breaking the documented acyclic dependency rule.
- Recommends a way to break the cycle, such as keeping team formatting in `teams` and composing the label there, or passing the team name into the users feature.

## duplicated-discount-rules: Show the discounted total in the checkout summary

The change copies business rules that already have an owner, and the copy has already drifted.

### Requirements

The checkout summary shows the total after any discount code. The total must match what the customer is charged.

### Before

```ts file=src/domain/pricing.ts
export type DiscountCode = { code: string; percentOff: number; minimumSubtotal: number; expiresAt: Date };

/** Used by the payment service to calculate the charged amount. */
export function applyDiscount(subtotal: number, discount: DiscountCode | undefined, now = new Date()): number {
  if (!discount) return subtotal;
  if (discount.expiresAt <= now) return subtotal;
  if (subtotal < discount.minimumSubtotal) return subtotal;
  return Math.round(subtotal * (1 - discount.percentOff / 100));
}
```

```ts file=src/domain/payments/charge.ts
import { applyDiscount, type DiscountCode } from '../pricing';

export function chargeAmount(subtotal: number, discount?: DiscountCode): number {
  return applyDiscount(subtotal, discount);
}
```

### After

```tsx file=src/features/checkout/CheckoutSummary.tsx
import type { DiscountCode } from '../../domain/pricing';

export function CheckoutSummary({ subtotal, discount }: { subtotal: number; discount?: DiscountCode }) {
  let total = subtotal;
  if (discount && discount.expiresAt > new Date()) {
    total = Math.round(subtotal * (1 - discount.percentOff / 100));
  }
  return (
    <dl>
      <dt>Subtotal</dt>
      <dd>{formatCents(subtotal)}</dd>
      <dt>Total</dt>
      <dd>{formatCents(total)}</dd>
    </dl>
  );
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
```

### Must find

- `CheckoutSummary` re-implements the discount rules that `applyDiscount` in `src/domain/pricing.ts` already owns, instead of calling it.
- The copy omits the `minimumSubtotal` check, so for a subtotal below the minimum the summary shows a discounted total the customer is not charged.

## order-placement-calls-every-consumer: Notify sales of large orders

Order placement calls each interested module directly. Adding one more consumer makes an optional notification able to fail the order.

### Requirements

Post a message in the sales Slack channel when an order over $10,000 is placed. Order placement must not fail because of notifications.

### Before

```ts file=src/orders/placeOrder.ts
import { db } from '../db';
import { reserveStock } from '../inventory/reserveStock';
import { sendReceipt } from '../email/sendReceipt';
import { track } from '../analytics/track';

export type Order = { id: string; customerEmail: string; totalCents: number; lines: { sku: string; quantity: number }[] };

export async function placeOrder(order: Order): Promise<void> {
  await reserveStock(order.lines);
  await db.orders.insert(order);
  void sendReceipt(order.customerEmail, order.id).catch(error => console.error('Receipt failed', error));
  track('order_placed', { orderId: order.id, totalCents: order.totalCents });
}
```

```ts file=src/slack/postMessage.ts
export async function postMessage(channel: string, text: string): Promise<void> {
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.SLACK_TOKEN}` },
    body: JSON.stringify({ channel, text }),
  });
  if (!response.ok) throw new Error(`Slack returned ${response.status}`);
}
```

### After

```ts file=src/orders/placeOrder.ts
import { db } from '../db';
import { reserveStock } from '../inventory/reserveStock';
import { sendReceipt } from '../email/sendReceipt';
import { track } from '../analytics/track';
import { postMessage } from '../slack/postMessage';

export type Order = { id: string; customerEmail: string; totalCents: number; lines: { sku: string; quantity: number }[] };

export async function placeOrder(order: Order): Promise<void> {
  await reserveStock(order.lines);
  await db.orders.insert(order);
  void sendReceipt(order.customerEmail, order.id).catch(error => console.error('Receipt failed', error));
  track('order_placed', { orderId: order.id, totalCents: order.totalCents });
  if (order.totalCents > 1_000_000) {
    await postMessage('#sales', `Large order ${order.id}: $${order.totalCents / 100}`);
  }
}
```

### Must find

- The Slack call is awaited without handling errors, so a Slack failure rejects `placeOrder` after the order is saved, which breaks the requirement that notifications must not fail order placement.
- Order placement is directly coupled to each downstream consumer (inventory, email, analytics and now Slack). Recommends handling the notification outside the core operation, such as an `orderPlaced` event or post-placement hook, or at least isolating it like the receipt.

## injected-adapter: Export reports through the storage adapter

A control case. The change follows the documented boundaries, so the review should not invent coupling problems.

### Requirements

Users can export a report as CSV. The file is saved through the existing storage adapter so it works with both the S3 and local-disk backends.

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

```ts file=src/app.ts
import { s3Storage } from './infrastructure/s3Storage';

export const storage = s3Storage('reports-prod');
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
import { s3Storage } from './infrastructure/s3Storage';
import { exportReport } from './domain/reports/exportReport';
import type { Report } from './domain/reports/report';

export const storage = s3Storage('reports-prod');

export function exportReportToStorage(report: Report): Promise<string> {
  return exportReport(report, storage);
}
```

### Must not flag

- Reports a dependency-direction, layering or coupling problem as a required fix. The domain operation depends only on the `FileStorage` port and `app.ts` does the wiring, as documented.
- Recommends adding a plugin system, registry, event bus or other new abstraction for exporting reports.
