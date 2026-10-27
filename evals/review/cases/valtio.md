# Valtio

Cases that misuse Valtio v1 in ways that compile but break reactivity, leak work or show stale state.

## mutate-snapshot: Add a tag from the tag picker

The click handler writes to the frozen snapshot instead of the proxy.

### Requirements

Clicking a suggested tag adds it to the document's tags. The tag list re-renders with the new tag.

### Before

```json file=package.json
{ "name": "tags", "private": true, "dependencies": { "react": "18.3.1", "valtio": "1.13.2" } }
```

```ts file=src/tagStore.ts
import { proxy } from 'valtio';

export const tagStore = proxy({ tags: [] as string[], suggestions: ['bug', 'design', 'urgent'] });
```

```tsx file=src/TagList.tsx
import { useSnapshot } from 'valtio';
import { tagStore } from './tagStore';

export function TagList() {
  const snap = useSnapshot(tagStore);
  return <ul>{snap.tags.map(tag => <li key={tag}>{tag}</li>)}</ul>;
}
```

### After

```tsx file=src/TagPicker.tsx
import { useSnapshot } from 'valtio';
import { tagStore } from './tagStore';

export function TagPicker() {
  const snap = useSnapshot(tagStore);
  return (
    <div>
      {snap.suggestions.map(tag => (
        <button key={tag} disabled={snap.tags.includes(tag)} onClick={() => snap.tags.push(tag)}>
          {tag}
        </button>
      ))}
    </div>
  );
}
```

### Must find

- The click handler mutates the snapshot (`snap.tags.push`) instead of the `tagStore` proxy. Snapshots are read-only, so the push fails and the store never changes. Recommends writing to `tagStore.tags`.

### Must read

- `best-practices/valtio/SKILL.md`

## subscription-without-cleanup: Sync the unread count to the page title

The subscription is never released, so each mount adds another listener.

### Requirements

While the inbox is open, the browser tab title shows the unread count. Leaving the inbox restores the original title.

### Before

```json file=package.json
{ "name": "inbox", "private": true, "dependencies": { "react": "18.3.1", "valtio": "1.13.2" } }
```

```ts file=src/inboxStore.ts
import { proxy } from 'valtio';

export const inboxStore = proxy({ messages: [] as { id: string; read: boolean }[] });
```

### After

```tsx file=src/Inbox.tsx
import { useEffect } from 'react';
import { subscribe } from 'valtio';
import { inboxStore } from './inboxStore';
import { MessageList } from './MessageList';

export function Inbox() {
  useEffect(() => {
    const originalTitle = document.title;
    subscribe(inboxStore, () => {
      const unread = inboxStore.messages.filter(message => !message.read).length;
      document.title = unread ? `(${unread}) Inbox` : 'Inbox';
    });
    return () => {
      document.title = originalTitle;
    };
  }, []);

  return <MessageList />;
}
```

### Must find

- The effect never calls the unsubscribe function returned by `subscribe`. After leaving the inbox the listener keeps running, overwrites the restored title on the next store change and accumulates on every remount. Recommends releasing the subscription in the effect cleanup.

### Must read

- `best-practices/valtio/SKILL.md`

## stale-snapshot-in-timer: Autosave the draft after typing stops

A delayed callback reads a value captured from an old render.

### Requirements

The editor saves the draft one second after the user stops typing. The saved text must be the latest text.

### Before

```json file=package.json
{ "name": "drafts", "private": true, "dependencies": { "react": "18.3.1", "valtio": "1.13.2" } }
```

```ts file=src/draftStore.ts
import { proxy } from 'valtio';

export const draftStore = proxy({ text: '' });

export async function saveDraft(text: string): Promise<void> {
  await fetch('/api/draft', { method: 'PUT', body: text });
}
```

### After

```tsx file=src/DraftEditor.tsx
import { useRef } from 'react';
import { useSnapshot } from 'valtio';
import { draftStore, saveDraft } from './draftStore';

export function DraftEditor() {
  const snap = useSnapshot(draftStore);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const scheduleSave = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => saveDraft(snap.text), 1000);
  };

  return (
    <textarea
      value={snap.text}
      onChange={event => {
        draftStore.text = event.target.value;
        scheduleSave();
      }}
    />
  );
}
```

### Must find

- The timeout saves `snap.text` captured from the render that scheduled it, which is the text before the latest keystroke. The last character typed is not saved. Recommends reading `draftStore.text` when the timer fires.

### Must read

- `best-practices/valtio/SKILL.md`

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

## stored-derived-total: Remove items from the cart

The store keeps a total in sync by hand, and the new action forgets to update it.

### Requirements

Users can remove an item from the cart. The cart total always equals the sum of the remaining items.

### Before

```json file=package.json
{ "name": "cart", "private": true, "dependencies": { "react": "18.3.1", "valtio": "1.13.2" } }
```

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

### Must find

- `removeItem` does not subtract the removed item's price, so `totalCents` no longer matches the items after a removal.
- Recommends deriving the total from `items` (for example a getter) instead of storing it, so actions cannot drift from it.
- The report's rule results record a concern for the "Avoid storing values that can be calculated" rule.

### Must read

- `review/rules/avoid-duplicate-live-state.md`
- `best-practices/valtio/SKILL.md`

## idiomatic-store: Track which panels are collapsed

A control case. The store follows the Valtio guidance, so the review should not report Valtio misuse.

### Requirements

Users can collapse sidebar panels. The sidebar header shows how many panels are collapsed. The collapsed state is saved to local storage while the sidebar is mounted.

### Before

```json file=package.json
{ "name": "sidebar", "private": true, "dependencies": { "react": "18.3.1", "valtio": "1.13.2" } }
```

### After

```ts file=src/panelStore.ts
import { proxy } from 'valtio';
import { proxySet } from 'valtio/utils';

export const panelStore = proxy({
  collapsedIds: proxySet<string>(),
  get collapsedCount() {
    return this.collapsedIds.size;
  },
});

export function togglePanel(id: string): void {
  if (panelStore.collapsedIds.has(id)) panelStore.collapsedIds.delete(id);
  else panelStore.collapsedIds.add(id);
}
```

```tsx file=src/Sidebar.tsx
import { useEffect } from 'react';
import { subscribe, useSnapshot } from 'valtio';
import { panelStore, togglePanel } from './panelStore';

const panels = ['files', 'search', 'history'];

export function Sidebar() {
  const snap = useSnapshot(panelStore);

  useEffect(
    () =>
      subscribe(panelStore, () => {
        localStorage.setItem('collapsedPanels', JSON.stringify([...panelStore.collapsedIds]));
      }),
    [],
  );

  return (
    <aside>
      <header>{snap.collapsedCount} collapsed</header>
      {panels.map(id => (
        <section key={id}>
          <button onClick={() => togglePanel(id)}>{snap.collapsedIds.has(id) ? 'Expand' : 'Collapse'}</button>
        </section>
      ))}
    </aside>
  );
}
```

### Must not flag

- Reports a Valtio misuse as a required fix, such as mutating a snapshot, leaking the subscription, using a non-reactive collection or storing derived state.

### Must read

- `best-practices/valtio/SKILL.md`
