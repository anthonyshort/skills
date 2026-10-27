# Product

Cases for "Should we build this?". The change should solve the stated problem in a reasonably simple way for the user.

## misses-the-requirement: Archive many projects at once

The requirement is bulk archiving. The change adds a single-project archive with a confirmation step, so the user's problem remains.

### Requirements

Customers with hundreds of finished projects asked for a way to archive many projects at once from the project list. Archiving can be undone from the archive page.

### Before

```ts file=src/api.ts
export async function archiveProject(id: string): Promise<void> {
  await fetch(`/api/projects/${id}/archive`, { method: 'POST' });
}
```

### After

```tsx file=src/ProjectRow.tsx
import { useState } from 'react';
import { archiveProject } from './api';

export function ProjectRow({ project }: { project: { id: string; name: string } }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <li>
      {project.name}
      {confirming ? (
        <button onClick={() => archiveProject(project.id)}>Confirm archive</button>
      ) : (
        <button onClick={() => setConfirming(true)}>Archive</button>
      )}
    </li>
  );
}
```

### Must find

- The change archives one project at a time, so a customer with hundreds of projects still needs hundreds of clicks. It doesn't meet the bulk-archiving requirement.
- Recommends adjusting the approach, such as selecting several projects and archiving them in one action.

## solves-the-problem: Show which invoices are overdue

A control case. The change does what the user asked in a simple way.

### Requirements

Finance asked to see at a glance which invoices are overdue in the invoice list.

### Before

```tsx file=src/InvoiceRow.tsx
export type Invoice = { id: string; dueAt: string; paid: boolean };

export function InvoiceRow({ invoice }: { invoice: Invoice }) {
  return <tr><td>{invoice.id}</td><td>{invoice.dueAt}</td></tr>;
}
```

### After

```tsx file=src/InvoiceRow.tsx
export type Invoice = { id: string; dueAt: string; paid: boolean };

export function InvoiceRow({ invoice, now = new Date() }: { invoice: Invoice; now?: Date }) {
  const overdue = !invoice.paid && new Date(invoice.dueAt) < now;
  return (
    <tr>
      <td>{invoice.id}</td>
      <td>{invoice.dueAt}</td>
      <td>{overdue ? <strong>Overdue</strong> : null}</td>
    </tr>
  );
}
```

### Must not flag

- Recommends reconsidering or substantially changing the approach. The change meets the stated need.
