---
name: valtio
description: Use when writing, refactoring, or reviewing Valtio v1 proxy stores, snapshots, subscriptions, refs, reactive collections, and derived state.
---

# Valtio best practices

## Goal

Keep Valtio v1 store ownership, tracked reads, mutations, and subscription lifetimes explicit.

## Guidance

### Ownership and React reads

Apply these rules to the standard Valtio v1 API. Follow applicable project conventions for internal store frameworks; do not assume their event or computed APIs are standard Valtio.

#### Ownership

- Define the initial proxy shape at its domain owner.

  ```typescript
  const cartStore = proxy<{ itemIds: string[]; isOpen: boolean }>({
    itemIds: [],
    isOpen: false,
  });
  ```

- Keep state in a component when only that component needs it. Use a store when values are shared or needed outside React.
- Keep stores with their feature. Split nested stores when different owners or subscription lifetimes justify it. Nesting alone is not a reason to split.

#### React consumption

- Snapshots are read-only render views; write to the original proxy.

  ```tsx
  const snap = useSnapshot(cartStore);
  return (
    <button onClick={() => { cartStore.isOpen = !cartStore.isOpen; }}>
      {snap.isOpen ? "Close cart" : "Open cart"}
    </button>
  );
  ```

- Access tracking limits updates to consumed properties. Spreading or enumerating snapshots broadens dependencies.

- Skip `useSnapshot` when the component does not consume store state.
- Callbacks needing current values should read the proxy, not a captured snapshot. A delayed or retained callback can outlive the render that created it.

```typescript
// Avoid: the timeout uses the count from the scheduling render.
const snap = useSnapshot(store);
const scheduleBefore = () => {
  setTimeout(() => saveCount(snap.count), 1000);
};

// Prefer: read the count when the timeout runs.
const scheduleAfter = () => {
  setTimeout(() => saveCount(store.count), 1000);
};
```

Keep a captured value when the action intentionally uses a historical snapshot. The timeout examples only illustrate reads. Its owner must also cancel pending timers when appropriate.

### Subscription lifetimes and opaque objects

- Subscription callbacks receive batched change operations; read the proxy for current values.

  ```typescript
  const unsubscribe = subscribe(cartStore, () => {
    document.title = String(cartStore.itemIds.length);
  });
  ```

- Return unsubscribe as effect cleanup or release it at the owner's lifecycle boundary. Cancel or otherwise bound background work that can outlive its owner.

  ```typescript
  useEffect(() => subscribe(cartStore, syncCart), [syncCart])
  ```

- Use `ref()` for opaque external instances or large immutable payloads, never primitives.

  ```typescript
  const store = proxy({ connection: ref(new EventTarget()) })
  ```

- Mutating inside a referenced object is untracked; replacing its store property notifies readers.

  ```typescript
  store.connection = ref(new EventTarget());
  ```

### Collections and derived values

- Native Map/Set instances stay unreactive inside `proxy()`. Use `proxyMap()`/`proxySet()` from `valtio/utils` for reactive collection behaviour.

  ```typescript
  const selectedIds = proxySet<string>();
  selectedIds.add("invoice-1");
  ```

- Read dependent properties through `this` in pure getters, and consume them through snapshots in React.

  ```tsx
  const store = proxy({
    count: 0,
    get doubled() { return this.count * 2; },
  });
  function Counter() {
    const snap = useSnapshot(store);
    return <span>{snap.doubled}</span>;
  }
  ```

- Getters do not provide general memoisation for expensive work.
- Verify legacy helpers such as `addComputed`/`proxyWithComputed` against the installed version. Prefer getters when compatible and sufficient.

### Actions and cross-store behaviour

- Default subscriptions batch synchronous updates; do not rely on batching across `await` or with synchronous subscriptions.

- Use shared actions when several callers must preserve the same state rule. Keep independent single-field mutations near their interaction when that remains clear.
- Mutate in actions, event handlers or synchronising effects. Never mutate during render.
- If the store framework already has domain actions or events, use those APIs when other code needs to know which operation happened. A low-level subscription shows state changes, not necessarily user intent.
- Standard Valtio does not define a project-specific domain event API. Check the actual framework before using one.
- Use scoped subscriptions or shared actions for cross-store work. Avoid cycles and needless event infrastructure. Await operations whose result or success is required before continuing.

### Verification

- Verify changed lifecycle cleanup, batching and state invariants with focused tests or runtime checks.
