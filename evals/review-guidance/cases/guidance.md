# Guidance selection

The best-practice skills are css, error-handling, html, http-api, react, testing, trpc, typescript and valtio. Each case checks that the guidance matches what the change actually uses, including clues beyond file extensions.

## valtio-component: Show the unread count in the header

A React component reading a Valtio store.

### Requirements

The header shows the number of unread messages.

### Before

```json file=package.json
{ "name": "inbox", "private": true, "dependencies": { "react": "18.3.1", "valtio": "1.13.2" } }
```

```ts file=src/inboxStore.ts
import { proxy } from 'valtio';

export const inboxStore = proxy({ messages: [] as { id: string; read: boolean }[] });
```

### After

```tsx file=src/Header.tsx
import { useSnapshot } from 'valtio';
import { inboxStore } from './inboxStore';

export function Header() {
  const snap = useSnapshot(inboxStore);
  const unread = snap.messages.filter(message => !message.read).length;
  return <header>Inbox ({unread})</header>;
}
```

### Must find

- Selects the valtio skill, citing the `useSnapshot` and store usage.
- Selects the react skill.
- Selects the typescript skill.

### Must not flag

- Selects css, trpc or http-api as relevant to this change.

## http-route: Return 404 for missing invoices

A server route change. No UI is involved.

### Requirements

`GET /api/invoices/:id` returns 404 with a machine-readable code when the invoice doesn't exist, instead of 500.

### Before

```ts file=server/invoices.ts
import { app } from './app';
import { db } from './db';

app.get('/api/invoices/:id', async (req, res) => {
  const invoice = await db.invoices.get(req.params.id);
  res.json({ id: invoice.id, total: invoice.totalCents });
});
```

### After

```ts file=server/invoices.ts
import { app } from './app';
import { db } from './db';

app.get('/api/invoices/:id', async (req, res) => {
  const invoice = await db.invoices.get(req.params.id);
  if (!invoice) return res.status(404).json({ code: 'INVOICE_NOT_FOUND' });
  res.json({ id: invoice.id, total: invoice.totalCents });
});
```

### Must find

- Selects the http-api skill.
- Selects the error-handling skill.
- Selects the typescript skill.

### Must not flag

- Selects react, valtio, css or html as relevant to this change.

## styles-only: Tighten the table spacing

A CSS-only change.

### Requirements

Reduce row padding in dense tables and keep focus outlines visible.

### Before

```css file=src/styles/table.css
.table td {
  padding: 12px 16px;
}

.table td:focus-visible {
  outline: 2px solid var(--focus);
}
```

### After

```css file=src/styles/table.css
.table--dense td {
  padding: 4px 8px;
}

.table td {
  padding: 12px 16px;
}

.table td:focus-visible {
  outline: none;
}
```

### Must find

- Selects the css skill, including its accessibility guidance because the change removes the focus outline.

### Must not flag

- Selects valtio, trpc, http-api or error-handling as relevant to this change.

## trpc-procedure: Add a procedure to archive a project

A tRPC procedure with input validation. The `.ts` extension alone doesn't reveal tRPC.

### Requirements

Clients can archive a project through the API.

### Before

```json file=package.json
{ "name": "api", "private": true, "dependencies": { "@trpc/server": "10.45.2", "zod": "3.23.8" } }
```

```ts file=server/router.ts
import { initTRPC } from '@trpc/server';

const t = initTRPC.create();
export const router = t.router;
export const procedure = t.procedure;
```

### After

```ts file=server/projects.ts
import { z } from 'zod';
import { procedure, router } from './router';
import { db } from './db';

export const projectsRouter = router({
  archive: procedure.input(z.object({ projectId: z.string() })).mutation(async ({ input }) => {
    await db.projects.update(input.projectId, { archivedAt: new Date() });
    return { ok: true };
  }),
});
```

### Must find

- Selects the trpc skill, citing the `@trpc/server` router or procedure.
- Selects the typescript skill.

### Must not flag

- Selects react, valtio or css as relevant to this change.
