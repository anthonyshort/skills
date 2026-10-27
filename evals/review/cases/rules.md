# Review rules

One case per rule in [the rule index](../../../skills/review/rules/README.md) that no other category covers. Each change clearly breaks its rule, so the rule pass should select the rule, read it and record a concern. The architecture and Valtio files cover the remaining three rules.

## lint-suppression: Load the profile when the page opens

A lint suppression hides a missing hook dependency. The rule makes this a P0.

### Requirements

The profile page loads the profile for the user in the URL. Navigating between profiles shows the new user's profile.

### Before

```json file=package.json
{ "name": "profiles", "private": true, "dependencies": { "react": "18.3.1" } }
```

```ts file=src/api.ts
export type Profile = { id: string; name: string };

export async function fetchProfile(userId: string): Promise<Profile> {
  const response = await fetch(`/api/users/${userId}`);
  return response.json();
}
```

### After

```tsx file=src/ProfilePage.tsx
import { useEffect, useState } from 'react';
import { fetchProfile, type Profile } from './api';

export function ProfilePage({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<Profile>();

  useEffect(() => {
    fetchProfile(userId).then(setProfile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <h1>{profile?.name ?? 'Loading'}</h1>;
}
```

### Must find

- The `react-hooks/exhaustive-deps` suppression hides the missing `userId` dependency, so navigating to another profile keeps showing the first user's profile. Reports it as a required fix and recommends depending on `userId` instead of suppressing the rule.
- The report's rule results record a concern for the "Fix the code instead of disabling lint checks" rule.

### Must read

- `review/rules/fix-code-instead-of-disabling-lint.md`

## mixed-cleanup-shapes: Watch the network status next to the theme

A new watcher returns a different cleanup shape from its neighbours, so the caller has to know both.

### Requirements

The app shell watches the network status as well as the theme and window size. Everything is released when the shell unmounts.

### Before

```ts file=src/watchers.ts
export function watchTheme(onChange: (theme: 'light' | 'dark') => void): () => void {
  const query = matchMedia('(prefers-color-scheme: dark)');
  const listener = () => onChange(query.matches ? 'dark' : 'light');
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}

export function watchWindowSize(onChange: (width: number) => void): () => void {
  const listener = () => onChange(innerWidth);
  addEventListener('resize', listener);
  return () => removeEventListener('resize', listener);
}
```

```ts file=src/startShell.ts
import { watchTheme, watchWindowSize } from './watchers';

export function startShell(update: (patch: object) => void): () => void {
  const stops = [watchTheme(theme => update({ theme })), watchWindowSize(width => update({ width }))];
  return () => stops.reverse().forEach(stop => stop());
}
```

### After

```ts file=src/watchNetwork.ts
export function watchNetwork(onChange: (online: boolean) => void): { dispose(): void } {
  const online = () => onChange(true);
  const offline = () => onChange(false);
  addEventListener('online', online);
  addEventListener('offline', offline);
  return {
    dispose() {
      removeEventListener('online', online);
      removeEventListener('offline', offline);
    },
  };
}
```

```ts file=src/startShell.ts
import { watchTheme, watchWindowSize } from './watchers';
import { watchNetwork } from './watchNetwork';

export function startShell(update: (patch: object) => void): () => void {
  const stops = [watchTheme(theme => update({ theme })), watchWindowSize(width => update({ width }))];
  const network = watchNetwork(online => update({ online }));
  return () => {
    stops.reverse().forEach(stop => stop());
    network.dispose();
  };
}
```

### Must find

- `watchNetwork` returns `{ dispose() }` while the other watchers return a stop function, so `startShell` needs special-case bookkeeping. Recommends returning a stop function like the others so it joins the same list.
- The report's rule results record a concern for the "Use consistent cleanup contracts for similar resources" rule.

### Must read

- `review/rules/make-cleanup-contracts-consistent.md`

## select-then-confirm: Duplicate a dashboard

A one-click action gains a selection state and a confirm button the task doesn't need.

### Requirements

Each dashboard in the list has a way to duplicate it. Duplicating is instant and can be undone by deleting the copy, so it needs no confirmation. Show a spinner while it runs and an error if it fails.

### Before

```ts file=src/api.ts
export async function duplicateDashboard(id: string): Promise<void> {
  const response = await fetch(`/api/dashboards/${id}/duplicate`, { method: 'POST' });
  if (!response.ok) throw new Error(`Duplicate failed: ${response.status}`);
}
```

### After

```tsx file=src/DashboardList.tsx
import { useState } from 'react';
import { duplicateDashboard } from './api';

export function DashboardList({ dashboards }: { dashboards: { id: string; name: string }[] }) {
  const [selectedId, setSelectedId] = useState<string>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  const confirmDuplicate = async () => {
    if (!selectedId) return;
    setPending(true);
    setError(undefined);
    try {
      await duplicateDashboard(selectedId);
      setSelectedId(undefined);
    } catch (cause) {
      setError(String(cause));
    } finally {
      setPending(false);
    }
  };

  return (
    <div>
      <ul>
        {dashboards.map(dashboard => (
          <li key={dashboard.id}>
            {dashboard.name}
            <button onClick={() => setSelectedId(dashboard.id)}>Select to duplicate</button>
          </li>
        ))}
      </ul>
      {selectedId && (
        <button disabled={pending} onClick={confirmDuplicate}>
          {pending ? 'Duplicating…' : 'Confirm duplicate'}
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
```

### Must find

- The select-then-confirm flow adds a selection state and an extra step that the requirements say isn't needed. Recommends a duplicate button per dashboard that runs the action directly, keeping the spinner, error message and protection against double clicks.
- The report's rule results record a concern for the "Remove interaction steps the task does not need" rule.

### Must read

- `review/rules/remove-unnecessary-interaction-steps.md`

## placeholder-arguments: Show overdue invoices on the dashboard

The new caller has to pass booleans and placeholder values it doesn't care about.

### Requirements

The dashboard widget lists the account's overdue invoices. It doesn't paginate.

### Before

```ts file=src/invoices.ts
export type Invoice = { id: string; dueAt: string; paid: boolean };

/**
 * includeDrafts: also return draft invoices.
 * refresh: bypass the cache.
 * cursor: pagination cursor, '' for the first page.
 * limit: page size, 0 for the server default.
 */
export async function fetchInvoices(
  accountId: string,
  includeDrafts: boolean,
  refresh: boolean,
  cursor: string,
  limit: number,
): Promise<Invoice[]> {
  const params = new URLSearchParams({ drafts: String(includeDrafts), refresh: String(refresh), cursor, limit: String(limit) });
  const response = await fetch(`/api/accounts/${accountId}/invoices?${params}`);
  return response.json();
}
```

```ts file=src/InvoiceTable.ts
import { fetchInvoices } from './invoices';

export function loadInvoicePage(accountId: string, cursor: string) {
  return fetchInvoices(accountId, false, false, cursor, 50);
}
```

### After

```ts file=src/overdueWidget.ts
import { fetchInvoices } from './invoices';

export async function loadOverdueInvoices(accountId: string) {
  const invoices = await fetchInvoices(accountId, false, true, '', 0);
  return invoices.filter(invoice => !invoice.paid && new Date(invoice.dueAt) < new Date());
}
```

### Must find

- The call `fetchInvoices(accountId, false, true, '', 0)` uses positional booleans and placeholder pagination values, so a reader can't tell what it asks for without opening `fetchInvoices`. Recommends a clearer call, such as named options with defaults, showing the caller before and after.
- The report's rule results record a concern for the "Make function calls clear and direct" rule.

### Must read

- `review/rules/make-function-calls-clear.md`

## command-envelope: Load a project by id

A read goes through a command envelope, and the caller unpacks layers of wrapping.

### Requirements

Add an API for loading one project by id, and use it on the project page. The rest of the API is resource-shaped, such as `GET /api/projects` and `GET /api/users/:id`.

### Before

```ts file=server/routes.ts
import { app } from './app';
import { db } from './db';

app.get('/api/projects', async (_req, res) => res.json(await db.projects.list()));
app.get('/api/users/:id', async (req, res) => {
  const user = await db.users.get(req.params.id);
  return user ? res.json(user) : res.status(404).json({ code: 'USER_NOT_FOUND' });
});
```

### After

```ts file=server/routes.ts
import { app } from './app';
import { db } from './db';

app.get('/api/projects', async (_req, res) => res.json(await db.projects.list()));
app.get('/api/users/:id', async (req, res) => {
  const user = await db.users.get(req.params.id);
  return user ? res.json(user) : res.status(404).json({ code: 'USER_NOT_FOUND' });
});
app.post('/api/rpc', async (req, res) => {
  if (req.body.action === 'getProject') {
    const project = await db.projects.get(req.body.params.id);
    return res.json({ data: { result: { project } } });
  }
  return res.status(400).json({ code: 'UNKNOWN_ACTION' });
});
```

```ts file=src/ProjectPage.ts
export async function loadProject(id: string) {
  const response = await fetch('/api/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getProject', params: { id } }),
  });
  const body = await response.json();
  return body.data.result.project;
}
```

### Must find

- Reading a project goes through a `POST /api/rpc` command envelope, and the caller unpacks `data.result.project`, unlike the rest of the resource-shaped API. Recommends `GET /api/projects/:id` returning the project, with a 404 for a missing project like the users route.
- The report's rule results record a concern for the "Simplify HTTP calls without changing their meaning" rule.

### Must read

- `review/rules/simplify-http-calls.md`

## legacy-client: Show the user's avatar in comments

New code uses a client the team has already replaced.

### Requirements

Comments show the author's avatar.

### Before

```md file=MIGRATION.md
# API client migration

`src/api/client.ts` replaces `src/legacy/userApi.ts`. It is adopted for all user reads: it adds auth headers, retries and caching. New code must use `client.users.get`. Remaining legacy callers are listed in issue #412 and will be moved separately.
```

```ts file=src/legacy/userApi.ts
/** @deprecated Use client.users.get from src/api/client.ts. */
export async function fetchUser(id: string): Promise<{ id: string; name: string; avatarUrl: string }> {
  const response = await fetch(`/api/users/${id}`);
  return response.json();
}
```

```ts file=src/api/client.ts
import { cachedRequest } from './request';

export const client = {
  users: {
    get: (id: string) => cachedRequest<{ id: string; name: string; avatarUrl: string }>(`/api/users/${id}`),
  },
};
```

### After

```tsx file=src/comments/CommentAuthor.tsx
import { useEffect, useState } from 'react';
import { fetchUser } from '../legacy/userApi';

export function CommentAuthor({ userId }: { userId: string }) {
  const [avatarUrl, setAvatarUrl] = useState<string>();
  useEffect(() => {
    fetchUser(userId).then(user => setAvatarUrl(user.avatarUrl));
  }, [userId]);
  return avatarUrl ? <img src={avatarUrl} alt="" /> : null;
}
```

### Must find

- The new `CommentAuthor` uses the deprecated `fetchUser` instead of the adopted `client.users.get`, so it misses the auth headers, retries and caching. Recommends switching this caller to `client.users.get` without moving the other legacy callers in this PR.
- The report's rule results record a concern for the "Migrate callers in small supported steps" rule.

### Must read

- `review/rules/migrate-callers-in-small-steps.md`

## forwarding-service: Add a project service

A new layer only renames calls to the existing client.

### Requirements

The project page loads and renames projects through the API client.

### Before

```ts file=src/api/client.ts
export type Project = { id: string; name: string };

export const api = {
  projects: {
    get: async (id: string): Promise<Project> => (await fetch(`/api/projects/${id}`)).json(),
    rename: async (id: string, name: string): Promise<void> => {
      await fetch(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
    },
  },
};
```

### After

```ts file=src/services/projectService.ts
import { api, type Project } from '../api/client';

export const projectService = {
  getProject(id: string): Promise<Project> {
    return api.projects.get(id);
  },
  renameProject(id: string, name: string): Promise<void> {
    return api.projects.rename(id, name);
  },
};
```

```tsx file=src/ProjectPage.tsx
import { projectService } from './services/projectService';

export async function loadProjectPage(id: string) {
  return projectService.getProject(id);
}

export async function renameFromPage(id: string, name: string) {
  await projectService.renameProject(id, name);
}
```

### Must find

- `projectService` only forwards to `api.projects` under new names. It adds no validation, translation or boundary. Recommends calling `api.projects` directly from the page and removing the service.
- The report's rule results record a concern for the "Remove wrappers that add no value" rule.

### Must read

- `review/rules/remove-wrappers-that-add-no-value.md`

## single-entry-registry: Export a report as CSV

A registry with one fixed entry replaces a direct call and moves a missing registration from compile time to runtime.

### Requirements

The report page has an "Export CSV" button. CSV is the only export format and no others are planned.

### Before

```ts file=src/exportCsv.ts
export function exportCsv(rows: Record<string, unknown>[]): string {
  const headers = Object.keys(rows[0] ?? {});
  return [headers.join(','), ...rows.map(row => headers.map(header => String(row[header])).join(','))].join('\n');
}
```

### After

```ts file=src/exporters.ts
type Exporter = (rows: Record<string, unknown>[]) => string;

const exporters = new Map<string, Exporter>();

export function registerExporter(format: string, exporter: Exporter): void {
  exporters.set(format, exporter);
}

export function runExporter(format: string, rows: Record<string, unknown>[]): string {
  const exporter = exporters.get(format);
  if (!exporter) throw new Error(`No exporter registered for ${format}`);
  return exporter(rows);
}
```

```ts file=src/main.ts
import { registerExporter } from './exporters';
import { exportCsv } from './exportCsv';

registerExporter('csv', exportCsv);
```

```tsx file=src/ExportButton.tsx
import { runExporter } from './exporters';

export function ExportButton({ rows }: { rows: Record<string, unknown>[] }) {
  return <button onClick={() => download(runExporter('csv', rows))}>Export CSV</button>;
}

function download(text: string) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  link.download = 'report.csv';
  link.click();
}
```

### Must find

- The exporter registry has one fixed entry and no real extension need. It hides the dependency on `exportCsv` and turns a missing registration into a runtime error, for example when `ExportButton` is used before `main.ts` registers the exporter. Recommends calling `exportCsv` directly.
- The report's rule results record a concern for the "Use registries for real extension needs" rule.

### Must read

- `review/rules/use-registries-for-real-extensions.md`

## save-by-event: Save the document from the toolbar

The toolbar fires an event and immediately says "Saved", so a failed save is reported as a success.

### Requirements

Clicking Save stores the document. Show "Saved" only after the save succeeds, and an error if it fails.

### Before

```ts file=src/documents.ts
export async function saveDocument(id: string, body: string): Promise<{ revision: number }> {
  const response = await fetch(`/api/documents/${id}`, { method: 'PUT', body });
  if (!response.ok) throw new Error(`Save failed: ${response.status}`);
  return response.json();
}
```

```ts file=src/events.ts
type Listener = (payload: { id: string; body: string }) => void;
const listeners: Listener[] = [];

export const events = {
  onSave(listener: Listener) {
    listeners.push(listener);
  },
  emitSave(payload: { id: string; body: string }) {
    listeners.forEach(listener => listener(payload));
  },
};
```

### After

```ts file=src/autosaveListener.ts
import { events } from './events';
import { saveDocument } from './documents';

events.onSave(({ id, body }) => {
  saveDocument(id, body);
});
```

```tsx file=src/Toolbar.tsx
import { events } from './events';

export function Toolbar({ id, body, showStatus }: { id: string; body: string; showStatus: (text: string) => void }) {
  return (
    <button
      onClick={() => {
        events.emitSave({ id, body });
        showStatus('Saved');
      }}
    >
      Save
    </button>
  );
}
```

### Must find

- The toolbar emits a save event and shows "Saved" straight away. The listener doesn't await `saveDocument`, so a failed save shows "Saved" and its rejection goes unhandled. Recommends awaiting `saveDocument` from the click handler and showing "Saved" or the error from the result.
- The report's rule results record a concern for the "Await operations whose results matter" rule.

### Must read

- `review/rules/await-required-operations.md`

## fragmented-decision: Decide when to send an invoice reminder

A two-condition check is split into tiny helpers that are harder to read than the expression.

### Requirements

Send a reminder for an invoice that is unpaid and more than 7 days overdue.

### Before

```ts file=src/invoice.ts
export type Invoice = { id: string; paid: boolean; dueAt: Date };
```

### After

```ts file=src/reminders.ts
import type { Invoice } from './invoice';

const DAY = 86_400_000;

const isTrue = (value: boolean) => value === true;
const not = (value: boolean) => !value;
const both = (a: boolean, b: boolean) => a && b;
const daysBetween = (from: Date, to: Date) => (to.getTime() - from.getTime()) / DAY;
const isMoreThan = (value: number, limit: number) => value > limit;
const isPaid = (invoice: Invoice) => isTrue(invoice.paid);
const isOverdueBy = (invoice: Invoice, days: number, now: Date) => isMoreThan(daysBetween(invoice.dueAt, now), days);

export function shouldSendReminder(invoice: Invoice, now = new Date()): boolean {
  return both(not(isPaid(invoice)), isOverdueBy(invoice, 7, now));
}
```

### Must find

- The decision is split into tiny helpers (`isTrue`, `not`, `both`, `isMoreThan`) with no other callers, which makes a two-condition rule harder to read. Recommends a single direct expression, such as `!invoice.paid && now - dueAt > 7 days`.
- The report's rule results record a concern for the "Extract decisions only when it helps" rule.

### Must read

- `review/rules/extract-decisions-only-when-useful.md`

## changed-error-code: Tidy the invoice API error codes

The server renames an error code that a client still checks for.

### Requirements

Make invoice API error codes shorter. The invoice page offers to recover a deleted invoice when it gets a not-found error.

### Before

```ts file=server/invoices.ts
import { app } from './app';
import { db } from './db';

app.get('/api/invoices/:id', async (req, res) => {
  const invoice = await db.invoices.get(req.params.id);
  if (!invoice) return res.status(404).json({ code: 'INVOICE_NOT_FOUND' });
  return res.json(invoice);
});
```

```ts file=src/InvoicePage.ts
export async function openInvoice(id: string, offerRecovery: (id: string) => void) {
  const response = await fetch(`/api/invoices/${id}`);
  if (response.ok) return response.json();
  const error = await response.json();
  if (error.code === 'INVOICE_NOT_FOUND') {
    offerRecovery(id);
    return undefined;
  }
  throw new Error(error.code);
}
```

### After

```ts file=server/invoices.ts
import { app } from './app';
import { db } from './db';

app.get('/api/invoices/:id', async (req, res) => {
  const invoice = await db.invoices.get(req.params.id);
  if (!invoice) return res.status(404).json({ code: 'NOT_FOUND' });
  return res.json(invoice);
});
```

### Must find

- The server now returns `NOT_FOUND`, but `openInvoice` still checks for `INVOICE_NOT_FOUND`. A missing invoice now throws instead of offering recovery. Recommends keeping the old code or updating the client in the same change.
- The report's rule results record a concern for the "Keep API changes compatible with callers" rule.

### Must read

- `review/rules/keep-api-changes-compatible.md`

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

- `review/rules/check-retries-for-repeated-effects.md`

## interpolated-query: Search customers by name

User input is interpolated into SQL.

### Requirements

The customer list can be searched by name and sorted by name or signup date, from query string parameters.

### Before

```ts file=server/db.ts
import { Pool } from 'pg';

export const pool = new Pool();
```

### After

```ts file=server/customers.ts
import { app } from './app';
import { pool } from './db';

app.get('/api/customers', async (req, res) => {
  const search = String(req.query.search ?? '');
  const sort = String(req.query.sort ?? 'name');
  const result = await pool.query(
    `SELECT id, name, created_at FROM customers WHERE name ILIKE '%${search}%' ORDER BY ${sort}`,
  );
  res.json(result.rows);
});
```

### Must find

- `search` and `sort` come from the query string and are interpolated into the SQL, so a request can inject SQL. Recommends binding `search` as a parameter (`$1`) and mapping `sort` to a fixed set of allowed columns.
- The report's rule results record a concern for the "Bind query values and restrict dynamic identifiers" rule.

### Must read

- `review/rules/bind-query-values.md`

## prefix-path-check: Download uploaded files

A string-prefix check lets a request read a sibling directory.

### Requirements

Users can download files they uploaded. Files are stored under `/srv/uploads`. Nothing outside that directory may be served.

### Before

```ts file=server/app.ts
import express from 'express';

export const app = express();
```

### After

```ts file=server/downloads.ts
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { app } from './app';

const UPLOADS = '/srv/uploads';

app.get('/api/files', async (req, res) => {
  const requested = path.resolve(UPLOADS, String(req.query.path));
  if (!requested.startsWith(UPLOADS)) return res.status(403).end();
  res.send(await readFile(requested));
});
```

### Must find

- The `startsWith(UPLOADS)` check accepts sibling paths such as `/srv/uploads-private/...`, for example via `?path=../uploads-private/secret`, so files outside the uploads directory can be read. Recommends a segment-aware check using `path.relative`.
- The report's rule results record a concern for the "Keep file access within allowed paths" rule.

### Must read

- `review/rules/keep-file-access-within-allowed-paths.md`

## duplicated-logout: Sign out when the session expires

A second entry point repeats the sign-out coordination and misses one field.

### Requirements

When the session expires, sign the user out exactly as the "Sign out" menu item does, so no data from the previous user remains.

### Before

```ts file=src/sessionStore.ts
import { proxy } from 'valtio';

export const sessionStore = proxy({
  user: undefined as { id: string; name: string } | undefined,
  permissions: [] as string[],
  recentProjectIds: [] as string[],
});
```

```ts file=src/menu/signOut.ts
import { sessionStore } from '../sessionStore';

export function signOutFromMenu(): void {
  sessionStore.user = undefined;
  sessionStore.permissions = [];
  sessionStore.recentProjectIds = [];
}
```

### After

```ts file=src/session/onExpired.ts
import { sessionStore } from '../sessionStore';

export function handleSessionExpired(): void {
  sessionStore.user = undefined;
  sessionStore.permissions = [];
}
```

### Must find

- `handleSessionExpired` repeats the sign-out field updates but doesn't clear `recentProjectIds`, so the previous user's recent projects remain after expiry. Recommends one shared `signOut` action in the session store that both entry points call.
- The report's rule results record a concern for the "Keep shared state rules in shared actions" rule.

### Must read

- `review/rules/keep-shared-state-rules-in-shared-actions.md`
