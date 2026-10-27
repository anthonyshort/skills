# Readability

Cases where the code behaves correctly but is harder to read than it needs to be. Each case also checks that the review does not invent a behaviour bug.

## nested-conditionals: Check who can edit a document

Correct logic hidden in a pyramid of nested `if`/`else` blocks.

### Requirements

Suspended users cannot edit anything. Admins can edit any document. Nobody else can edit a locked document. Owners can edit their own documents. Members can also edit documents shared with one of their teams. Guests can only edit their own documents.

### Before

```ts file=src/permissions.ts
export type User = { id: string; role: 'admin' | 'member' | 'guest'; suspended: boolean; teamIds: string[] };
export type Doc = { ownerId: string; locked: boolean; teamIds: string[] };
```

### After

```ts file=src/permissions.ts
export type User = { id: string; role: 'admin' | 'member' | 'guest'; suspended: boolean; teamIds: string[] };
export type Doc = { ownerId: string; locked: boolean; teamIds: string[] };

export function canEditDocument(user: User | undefined, doc: Doc): boolean {
  if (user) {
    if (!user.suspended) {
      if (user.role === 'admin') {
        return true;
      } else {
        if (!doc.locked) {
          if (doc.ownerId === user.id) {
            return true;
          } else {
            if (user.role === 'member') {
              let shared = false;
              for (const teamId of user.teamIds) {
                if (doc.teamIds.includes(teamId)) {
                  shared = true;
                }
              }
              return shared;
            } else {
              return false;
            }
          }
        } else {
          return false;
        }
      }
    } else {
      return false;
    }
  } else {
    return false;
  }
}
```

### Must find

- The deeply nested conditionals and `else` branches after `return` make the permission rules hard to follow. Recommends flattening them, for example with early-return guard clauses that read in the same order as the rules.

### Must not flag

- Reports a behaviour bug in `canEditDocument`. It implements the stated rules correctly.

## vague-names: Import calendar events

The logic is fine but names like `handle`, `d`, `f` and `tmp` hide what it does, and a positional boolean is unreadable at the call site.

### Requirements

Import events from an uploaded calendar file. When "Skip undated events" is checked, events without a start time are dropped. Otherwise they are imported with no start time. Show how many events were imported.

### Before

```ts file=src/calendar/storage.ts
export type CalendarEvent = { title: string; start: Date | null };

export async function saveEvents(events: CalendarEvent[]): Promise<void> {
  await fetch('/api/events', { method: 'POST', body: JSON.stringify(events) });
}
```

### After

```ts file=src/utils/helpers.ts
import { saveEvents } from '../calendar/storage';

export async function handle(d: { title: string; ts?: string }[], f: boolean): Promise<number> {
  const res = [];
  for (const x of d) {
    const tmp = x.ts ? new Date(x.ts) : null;
    if (f && !tmp) continue;
    res.push({ title: x.title, start: tmp });
  }
  await saveEvents(res);
  return res.length;
}
```

```tsx file=src/calendar/ImportButton.tsx
import { handle } from '../utils/helpers';

export function ImportButton({ rows, skipUndated }: { rows: { title: string; ts?: string }[]; skipUndated: boolean }) {
  const onClick = async () => {
    const n = await handle(rows, skipUndated);
    alert(`Imported ${n} events`);
  };
  return <button onClick={onClick}>Import</button>;
}
```

### Must find

- The function and variable names (`handle`, `d`, `f`, `x`, `tmp`, `res`) do not describe what they hold or do. Suggests descriptive names, such as `importCalendarEvents`, `rows` and `skipUndated`.
- The generic `src/utils/helpers.ts` location hides that this is calendar import logic. Recommends moving it into `src/calendar/`.

## mixed-responsibilities: Create an order from the checkout form

One long handler parses, validates, prices, saves and formats. Each step is simple, but together they are hard to follow and test.

### Requirements

Submitting the checkout form validates the email and quantities, calculates the total with 10% tax, saves the order and returns a confirmation message. Invalid input returns an error message instead.

### Before

```ts file=src/checkout/api.ts
export type OrderLine = { sku: string; quantity: number; unitCents: number };

export async function saveOrder(order: { email: string; lines: OrderLine[]; totalCents: number }): Promise<string> {
  const response = await fetch('/api/orders', { method: 'POST', body: JSON.stringify(order) });
  return (await response.json()).id;
}
```

```ts file=src/checkout/prices.ts
export const PRICES: Record<string, number> = { 'mug': 1200, 'shirt': 2500, 'sticker': 300 };
```

### After

```ts file=src/checkout/submitCheckout.ts
import { saveOrder, type OrderLine } from './api';
import { PRICES } from './prices';

export async function submitCheckout(form: FormData): Promise<{ ok: boolean; message: string }> {
  const email = String(form.get('email') ?? '').trim();
  if (!email || !email.includes('@') || email.startsWith('@') || email.endsWith('@')) {
    return { ok: false, message: 'Enter a valid email address.' };
  }
  const lines: OrderLine[] = [];
  for (const [key, value] of form.entries()) {
    if (!key.startsWith('qty-')) continue;
    const sku = key.slice(4);
    const quantity = Number(value);
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 99) {
      return { ok: false, message: `Quantity for ${sku} must be between 0 and 99.` };
    }
    if (quantity === 0) continue;
    const unitCents = PRICES[sku];
    if (unitCents === undefined) {
      return { ok: false, message: `Unknown product ${sku}.` };
    }
    lines.push({ sku, quantity, unitCents });
  }
  if (lines.length === 0) {
    return { ok: false, message: 'Add at least one item.' };
  }
  let subtotalCents = 0;
  for (const line of lines) {
    subtotalCents += line.quantity * line.unitCents;
  }
  const taxCents = Math.round(subtotalCents * 0.1);
  const totalCents = subtotalCents + taxCents;
  const orderId = await saveOrder({ email, lines, totalCents });
  const itemCount = lines.reduce((count, line) => count + line.quantity, 0);
  const formattedTotal = `$${(totalCents / 100).toFixed(2)}`;
  return {
    ok: true,
    message: `Order ${orderId} confirmed: ${itemCount} item${itemCount === 1 ? '' : 's'}, ${formattedTotal} including tax.`,
  };
}
```

### Must find

- `submitCheckout` mixes several responsibilities (reading and validating form input, pricing, saving and formatting the message) in one long function. Recommends splitting it into named steps, such as parsing the lines, calculating the total and formatting the confirmation, so each can be read and tested on its own.

## clear-helper: Format durations for the activity feed

A control case. The helper is small, well named and tested, so the review should not ask for readability changes.

### Requirements

The activity feed shows how long ago something happened: "just now" under a minute, then minutes, hours and days, such as "5m ago", "3h ago" and "2d ago".

### Before

```json file=package.json
{ "name": "feed", "private": true, "type": "module" }
```

### After

```ts file=src/feed/formatTimeAgo.ts
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatTimeAgo(elapsedMs: number): string {
  if (elapsedMs < MINUTE) return 'just now';
  if (elapsedMs < HOUR) return `${Math.floor(elapsedMs / MINUTE)}m ago`;
  if (elapsedMs < DAY) return `${Math.floor(elapsedMs / HOUR)}h ago`;
  return `${Math.floor(elapsedMs / DAY)}d ago`;
}
```

```ts file=src/feed/formatTimeAgo.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatTimeAgo } from './formatTimeAgo.ts';

test('formats each unit', () => {
  assert.equal(formatTimeAgo(59_000), 'just now');
  assert.equal(formatTimeAgo(5 * 60_000), '5m ago');
  assert.equal(formatTimeAgo(3 * 3_600_000), '3h ago');
  assert.equal(formatTimeAgo(2 * 86_400_000), '2d ago');
});
```

### Must not flag

- Reports a readability problem as a required fix, such as unclear names, nesting, file placement or missing comments. Optional nits are fine.
