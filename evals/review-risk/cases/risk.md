# Risk assessment

Each case has a risk level that size alone would get wrong, or a scope question the assessment should spot.

## small-destructive-change: Clean up expired sessions faster

Eight changed lines that can delete live user data. Small size must not mean low risk.

### Requirements

The nightly cleanup job deletes expired sessions. Make it also remove sessions for deleted accounts.

### Before

```ts file=src/jobs/cleanupSessions.ts
import { db } from '../db';

/** Runs nightly against the production database. */
export async function cleanupSessions(now: Date): Promise<number> {
  const result = await db.query('DELETE FROM sessions WHERE expires_at < $1', [now]);
  return result.rowCount;
}
```

### After

```ts file=src/jobs/cleanupSessions.ts
import { db } from '../db';

/** Runs nightly against the production database. */
export async function cleanupSessions(now: Date): Promise<number> {
  const result = await db.query(
    'DELETE FROM sessions WHERE expires_at < $1 OR account_id NOT IN (SELECT id FROM accounts WHERE deleted_at IS NULL)',
    [now],
  );
  return result.rowCount;
}
```

### Must find

- Rates production risk as high, or at least not low, because the job irreversibly deletes production rows and a mistake in the new condition logs out active users. Says the small diff does not reduce this risk.
- Notes a specific verification gap, such as no test of which rows the new condition matches or what happens with a null `account_id`.

### Must not flag

- Gives a numerical risk score.

## large-mechanical-change: Add French translations

Most of the diff is translation data. The meaningful change is one line.

### Requirements

Add French. The language picker lists it and the app loads its strings.

### Before

```ts file=src/i18n/languages.ts
export const languages = ['en', 'de'] as const;
```

```json file=src/i18n/en.json
{ "app.title": "Invoices", "invoice.due": "Due {date}", "invoice.paid": "Paid" }
```

### After

```ts file=src/i18n/languages.ts
export const languages = ['en', 'de', 'fr'] as const;
```

```json file=src/i18n/fr.json
{
  "app.title": "Factures",
  "invoice.due": "Échéance {date}",
  "invoice.paid": "Payée"
}
```

```txt file=src/i18n/fr-glossary.txt repeat=400
term-{n}: traduction relue {n}
```

### Must find

- Separates the bulk translation and glossary data from the one-line code change, and treats the bulk as low-risk data rather than code to review line by line.
- Rates production risk as low, with a reason such as the change only adds an option and existing languages are untouched.

### Must not flag

- Recommends splitting the PR because of its line count.

## inactive-code: Add a currency conversion module

New code with no callers. Its immediate production impact is low.

### Requirements

Add a currency conversion helper for the upcoming multi-currency work. Nothing uses it yet.

### Before

```ts file=src/money/format.ts
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
```

### After

```ts file=src/money/convert.ts
export type Rates = Record<string, number>;

export function convertCents(cents: number, from: string, to: string, rates: Rates): number {
  const fromRate = rates[from];
  const toRate = rates[to];
  if (fromRate === undefined || toRate === undefined) throw new Error(`Missing rate for ${from} or ${to}`);
  return Math.round((cents / fromRate) * toRate);
}
```

### Must find

- Checks activation and finds that `convertCents` has no callers, imports or registration, so it has little immediate production impact.
- Distinguishes the low production risk now from the risk once callers use it, such as rounding or missing rates, and says what should be verified before then.

## mixed-changes: Rename customer to client and add CSV export

One PR mixes a wide rename, a new feature and a dependency upgrade. The assessment should spot the isolation problem.

### Requirements

Rename "customer" to "client" everywhere, add a CSV export of clients, and upgrade the date library to the new major version.

### Before

```json file=package.json
{ "name": "crm", "private": true, "dependencies": { "date-fns": "2.30.0" } }
```

```ts file=src/customers.ts
import { format } from 'date-fns';

export type Customer = { id: string; name: string; createdAt: Date };

export function describeCustomer(customer: Customer): string {
  return `${customer.name} (since ${format(customer.createdAt, 'yyyy-MM-dd')})`;
}
```

### After

```json file=package.json
{ "name": "crm", "private": true, "dependencies": { "date-fns": "3.6.0" } }
```

```ts file=src/customers.ts
import { format } from 'date-fns';

export type Client = { id: string; name: string; createdAt: Date };

export function describeClient(client: Client): string {
  return `${client.name} (since ${format(client.createdAt, 'yyyy-MM-dd')})`;
}

export function clientsToCsv(clients: Client[]): string {
  return ['id,name,created', ...clients.map(client => `${client.id},${client.name},${client.createdAt.toISOString()}`)].join('\n');
}
```

### Must find

- Identifies three distinct changes (the rename, the CSV export and the major dependency upgrade) that need different verification, and recommends separating at least the dependency upgrade.
- Notes the rename changes exported names (`Customer` and `describeCustomer`), so callers outside this diff may break.
