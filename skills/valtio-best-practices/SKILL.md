---
name: valtio-best-practices
description: Use when writing, refactoring, or reviewing Valtio v1 proxy stores, snapshots, subscriptions, refs, reactive collections, and derived state.
---

# Valtio best practices

## Goal

Keep Valtio v1 store ownership, tracked reads, mutations, and subscription lifetimes explicit.

## Checklist

Track checks in task notes, not here. Mark done only after verifying; explain N/A and report blocked or unverified checks. Run independent checks in parallel where useful.

**Ownership and React reads**

- [ ] **Store ownership** - Define the proxy's initial shape and domain owner.
- [ ] **Feature state** - Keep stores with their feature and component-only state local.
- [ ] **Nested concerns** - Keep deep nesting consistent with ownership.
- [ ] **Render reads** - Read snapshots rather than untracked proxies in React.
- [ ] **Read tracking** - Read needed properties rather than spreading or enumerating snapshots.
- [ ] **Unused subscriptions** - Skip useSnapshot when no store state is consumed.
- [ ] **Callback reads** - Read current proxy values rather than captured snapshots.
- [ ] **Mutation target** - Write to proxies, not read-only snapshots.

**Subscription lifetimes and opaque objects**

- [ ] **Imperative subscriptions** - Use subscribe and read current proxy values.
- [ ] **Subscription cleanup** - Verify subscriptions release at their owning lifecycle boundary.
- [ ] **Opaque objects** - Use ref for opaque objects, never primitives.
- [ ] **Untracked internals** - Check callers do not expect changes inside referenced objects to notify subscribers.
- [ ] **Observable replacement** - Replace the property when referenced-object changes must become observable.

**Collections and derived values**

- [ ] **Reactive collections** - Use proxyMap/proxySet for reactive Map/Set semantics.
- [ ] **Simple collections** - Use ordinary objects or arrays when sufficient.
- [ ] **Derived getters** - Keep getters pure and read dependencies through this.
- [ ] **Getter consumption** - Read derived getters through snapshots in React.
- [ ] **Shared derived values** - Keep one owner and do not assume getters memoise expensive work.
- [ ] **Computed compatibility** - Match helpers to Valtio v1 and the actual store framework.

**Actions and cross-store behaviour**

- [ ] **Mutation timing** - Mutate in handlers, synchronising effects, or actions, never render.
- [ ] **Update batching** - Preserve invariants without assuming batching across await or synchronous subscriptions.
- [ ] **Shared invariants** - Enforce invariants in common actions rather than duplicated interactions.
- [ ] **Domain events** - Use the project's domain event API where adopted.
- [ ] **Cross-store dependencies** - Use scoped subscriptions or shared actions; avoid cycles and needless event frameworks.

**Verification**

- [ ] **Invariant checks** - Verify changed batching and cross-store invariants with tests or runtime checks.
- [ ] **Derived performance** - Measure costly derived work when it motivates the change.


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

- Split nested stores when ownership or subscription behaviour warrants it.

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

- Callbacks needing current values should read the proxy, not a captured snapshot.

- Use stores for shared values or state needed outside React.

### Subscription lifetimes and opaque objects

- Subscription callbacks receive batched change operations; read the proxy for current values.

  ```typescript
  const unsubscribe = subscribe(cartStore, () => {
    document.title = String(cartStore.itemIds.length);
  });
  ```

- Return the unsubscribe function as effect cleanup or release it at the owner's lifecycle boundary. Verify changed cleanup with tests or runtime checks where needed.

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

- For subscription costs and expensive derived values, load [performance](../performance-best-practices/SKILL.md).

### Actions and cross-store behaviour

- Default subscriptions batch synchronous updates; do not rely on batching across `await` or with synchronous subscriptions.

- Enforce shared invariants in common actions; keep simple mutations near their interaction.

  ```typescript
  function clearCart(): void {
    cartStore.itemIds = [];
    cartStore.isOpen = false;
  }
  ```

- With an established domain event API, express domain actions explicitly rather than inferring intent from arbitrary changes.
- Standard Valtio can use scoped subscriptions or shared actions for cross-store dependencies. Clean up and prevent cycles; do not invent an event framework solely to avoid subscriptions.

- For ownership and cross-store dependencies, load [architecture](../architecture-best-practices/SKILL.md).

### Verification

- For lifecycle cleanup, batching, and state invariants, load [testing](../testing-best-practices/SKILL.md).
