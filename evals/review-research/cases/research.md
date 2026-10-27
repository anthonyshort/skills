# Research

Each case supplies exports from Slack, Notion, Linear or GitHub as fixed inputs. A tool with no export is unavailable. The brief should find the context that changes the review, cite where it came from and say what it couldn't check.

## deprecated-in-slack: Add a CSV export to the reports page

A Slack decision says the export path this change extends is being removed. Linear has no export, so it's unavailable.

### Requirements

Users can export the reports table as CSV from a new button. PR #482.

### Before

```ts file=src/reports/legacyExport.ts
/** Builds a download URL on the legacy export service. */
export function legacyExportUrl(reportId: string, format: 'xlsx' | 'pdf'): string {
  return `https://exports.internal/legacy/${reportId}.${format}`;
}
```

### After

```ts file=src/reports/legacyExport.ts
/** Builds a download URL on the legacy export service. */
export function legacyExportUrl(reportId: string, format: 'xlsx' | 'pdf' | 'csv'): string {
  return `https://exports.internal/legacy/${reportId}.${format}`;
}
```

```tsx file=src/reports/ExportButton.tsx
import { legacyExportUrl } from './legacyExport';

export function CsvExportButton({ reportId }: { reportId: string }) {
  return <a href={legacyExportUrl(reportId, 'csv')}>Export CSV</a>;
}
```

### Inputs

```md file=slack/data-platform.md
# #data-platform

**Priya Raman** · 2026-10-02
Decision from today's sync: the legacy export service (`exports.internal/legacy`) is frozen. No new formats or callers. It's switched off on 2026-12-01. New exports go through the reports API: `POST /api/reports/:id/exports`.

**Tom Ellis** · 2026-10-02
Ack. I'll move the xlsx and pdf buttons in Q4.

**Sam Ortiz** · 2026-10-20
Anyone know if CSV is on the roadmap? Customers keep asking.

**Priya Raman** · 2026-10-20
Yes, via the reports API only. See the export spec in Notion.
```

```md file=notion/reports-export-spec.md
# Reports export spec

Status: Approved, 2026-09-28

- All exports are created through `POST /api/reports/:id/exports` with `{ "format": "csv" | "xlsx" | "pdf" }`.
- The API returns a job id. The client polls `GET /api/exports/:jobId` and downloads from the returned URL.
- CSV must escape commas and quotes and include a header row.
```

```md file=github/pr-482.md
# PR #482: Add a CSV export to the reports page

No comments yet. CI: not run.
```

### Must find

- Reports the Slack decision that the legacy export service is frozen, takes no new formats or callers and is switched off on 2026-12-01, citing the #data-platform thread, and says this change adds a format and a caller to it.
- Reports from the Notion spec that CSV exports should go through `POST /api/reports/:id/exports`.
- Records Linear as unavailable or not searched, rather than reporting no relevant Linear issues.

### Must not flag

- Claims Linear was searched or reports Linear results.

## overlapping-open-pr: Show the account owner on invoices

Another open PR renames the function this change starts using.

### Requirements

Each invoice shows the name of the account owner. PR #510.

### Before

```ts file=src/accounts/owners.ts
export type Account = { id: string; ownerId: string };
export type User = { id: string; name: string };

export function getOwnerName(account: Account, users: Map<string, User>): string {
  return users.get(account.ownerId)?.name ?? 'Unknown';
}
```

### After

```tsx file=src/invoices/InvoiceHeader.tsx
import { getOwnerName, type Account, type User } from '../accounts/owners';

export function InvoiceHeader({ account, users }: { account: Account; users: Map<string, User> }) {
  return <h2>Owner: {getOwnerName(account, users)}</h2>;
}
```

### Inputs

```md file=github/pr-510.md
# PR #510: Show the account owner on invoices

No comments yet. CI: passing.
```

```md file=github/open-prs.md
# Open PRs touching src/accounts

## PR #497: Support accounts with several owners (open, approved, merging this week)

Changes `src/accounts/owners.ts`:

- Replaces `ownerId: string` with `ownerIds: string[]` on `Account`.
- Removes `getOwnerName`. Adds `getOwnerNames(account, users): string[]`.
- Updates every existing caller.

## PR #503: Fix typo in accounts README (open)

Changes `src/accounts/README.md` only.
```

### Must find

- Identifies PR #497 as a real conflict, not just file overlap: it removes `getOwnerName` and `ownerId`, which this change starts using, so one of the two must be updated depending on merge order.
- Distinguishes PR #503 as unrelated file overlap or omits it as irrelevant.
- Records Slack, Notion and Linear as unavailable.

## superseded-decision: Store user preferences in local storage

An old Notion page supports the approach, but a newer Slack decision replaced it.

### Requirements

Remember each user's table density and theme between visits. PR #530.

### Before

```ts file=src/preferences.ts
export type Preferences = { density: 'compact' | 'comfortable'; theme: 'light' | 'dark' };

export const defaultPreferences: Preferences = { density: 'comfortable', theme: 'light' };
```

### After

```ts file=src/preferences.ts
export type Preferences = { density: 'compact' | 'comfortable'; theme: 'light' | 'dark' };

export const defaultPreferences: Preferences = { density: 'comfortable', theme: 'light' };

export function loadPreferences(): Preferences {
  const saved = localStorage.getItem('preferences');
  return saved ? { ...defaultPreferences, ...JSON.parse(saved) } : defaultPreferences;
}

export function savePreferences(preferences: Preferences): void {
  localStorage.setItem('preferences', JSON.stringify(preferences));
}
```

### Inputs

```md file=notion/client-state.md
# Client state guidelines

Last edited: 2025-03-14

- Store UI preferences such as theme and density in `localStorage`. They don't need to follow the user between devices.
```

```md file=slack/frontend.md
# #frontend

**Dana Wu** · 2026-08-11
Heads up: we're moving user preferences server-side so they follow people across devices. Use `PUT /api/me/preferences` for anything new. The old Notion client-state page is out of date. I'll update it.

**Leo Park** · 2026-08-11
👍 the settings page already uses the new endpoint.
```

```md file=linear/issues.md
# Linear search: preferences

## FE-881: Preferences should sync across devices (In progress)

Created 2026-08-09 by Dana Wu. Move theme, density and table column choices to `/api/me/preferences`.
```

### Must find

- Reports that the 2026-08-11 Slack decision and Linear FE-881 replace the older Notion guidance: new preferences belong in `PUT /api/me/preferences`, not `localStorage`.
- Treats the Notion page as out of date rather than as support for the change, and cites the newer sources.

### Must not flag

- Presents the Notion client-state page as the current decision.

## unopened-link: Add rate limiting to the login endpoint

A Slack message links a design doc that isn't in the exports. The brief should treat it as an unread lead.

### Requirements

Limit failed login attempts per account. PR #541.

### Before

```ts file=server/login.ts
import { app } from './app';
import { verifyPassword } from './auth';

app.post('/api/login', async (req, res) => {
  const user = await verifyPassword(req.body.email, req.body.password);
  if (!user) return res.status(401).json({ code: 'INVALID_CREDENTIALS' });
  res.json({ token: user.token });
});
```

### After

```ts file=server/login.ts
import { app } from './app';
import { verifyPassword } from './auth';

const failures = new Map<string, number>();

app.post('/api/login', async (req, res) => {
  const email = String(req.body.email);
  if ((failures.get(email) ?? 0) >= 5) return res.status(429).json({ code: 'TOO_MANY_ATTEMPTS' });
  const user = await verifyPassword(email, req.body.password);
  if (!user) {
    failures.set(email, (failures.get(email) ?? 0) + 1);
    return res.status(401).json({ code: 'INVALID_CREDENTIALS' });
  }
  failures.delete(email);
  res.json({ token: user.token });
});
```

### Inputs

```md file=slack/security.md
# #security

**Ana Silva** · 2026-10-15
For login rate limiting, please follow the approach in the auth hardening doc: https://notion.so/acme/auth-hardening-3f9a. It covers lockout duration, IP limits and the multi-instance setup.

**Ben Kim** · 2026-10-15
Will do.
```

### Must find

- Reports the auth hardening doc linked from #security as relevant but unread, because it isn't available, and lists what it may decide (lockout duration, IP limits and multiple instances) as open questions rather than facts.
- Notes from the code that the in-memory `failures` map is per process, so the limit doesn't hold across several server instances, as a risk to check against that doc.

### Must not flag

- States what the auth hardening doc requires as if it had been read.
