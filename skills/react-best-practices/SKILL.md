---
name: react-best-practices
description: Use when writing, refactoring, or reviewing React and TypeScript components, hooks, context, state, effects, and rendering behaviour.
---

# React best practices

## Goal

Keep React state, effects, and rendering predictable across interactions, recovery, and component lifetimes.

## Checklist

Track checks in task notes, not here. Mark done only after verifying; explain N/A and report blocked or unverified checks. Run independent checks in parallel where useful.

**Component APIs**

- [ ] **Component responsibility** - Identify each component’s state, behaviour or layout; flag wrappers adding no contract or behaviour.
- [ ] **Props and exports** - Follow named component/props conventions and existing exports; avoid React.FC solely for props.
- [ ] **Shared component API** - Verify shared state/configuration has one owner and consistent defaults, controlled state and actions.
- [ ] **Class overrides** - Put forwarded className last with the established merging helper.
- [ ] **Custom hooks** - Follow useName naming and reuse suitable feature hooks.
- [ ] **Hook contracts** - Fit return shapes to consumers and keep shared read/write hooks together.
- [ ] **Pure utilities** - Use hooks only when React behaviour is needed.

**State ownership**

- [ ] **State ownership** - Keep interaction state local and shared state in one source of truth.
- [ ] **Prop drilling** - Check deep state or action forwarding needs a store, provider, or narrower API.
- [ ] **Derived state** - Calculate values rather than storing and synchronising them with effects.
- [ ] **Previous state** - Use functional setters for updates based on previous state.
- [ ] **Mirrored refs** - Require synchronous imperative reads, one update path, and no render-time reads.
- [ ] **DOM ownership** - Use props/state for React-owned DOM state; refs for imperative integrations.

**Rendering and recovery**

- [ ] **Hook order** - Call hooks before conditional returns.
- [ ] **Rendering states** - Render loading, error, and empty states explicitly.
- [ ] **Variant rendering** - Check variants exhaustively and provide safe unknown-variant fallbacks.
- [ ] **List keys** - Use stable keys.
- [ ] **Direct rendering** - Prefer JSX or map over assembled arrays where clearer.
- [ ] **Error boundaries** - Verify independent recovery keeps neighbouring UI usable and offers a supported recovery action.
- [ ] **Boundary reset** - Clear the state responsible for the failure.

**Effects and requests**

- [ ] **Render purity** - Check render and memoisation callbacks for requests or mutations.
- [ ] **Effect purpose** - Synchronise external systems; keep interaction work in handlers.
- [ ] **Effect dependencies** - Include reactive dependencies.
- [ ] **Related hooks** - Compare hooks sharing inputs and lifetimes; combine only with correct dependencies, cleanup and timing.
- [ ] **Effect cleanup** - Release subscriptions, timers, and requests safely under repeated mounting.
- [ ] **Request races** - Abort obsolete requests and prevent stale responses replacing current results.
- [ ] **Cancellation** - Keep cancellation separate from user-visible failures.
- [ ] **Server state** - Use the established query layer for caching and deduplication.

**Performance and verification**

- [ ] **Memoisation benefit** - Require an expensive pure calculation or concrete identity benefit for useMemo.
- [ ] **Repeated execution** - Trace pending → ready → later render before flagging repeated work.
- [ ] **Initialisation retries** - Preserve pending retries and latch only the first successful result.
- [ ] **Context identity** - Stabilise values when it prevents unwanted updates; include dependencies.
- [ ] **Callback identity** - Require an identity-sensitive consumer or subscription; include dependencies.
- [ ] **Transition support** - Use transitions for non-urgent updates and check async support against React's version.
- [ ] **Async transitions** - Handle failures, cancellation, and request races.
- [ ] **Interaction checks** - Verify important changed interactions, recovery and effect lifetimes at the cheapest layer that can catch the risk.

## Guidance

### Component APIs

- Identify the state, behaviour, layout or contract each changed component owns. Wrappers can own styling, accessibility, context, lifecycle or integration. For a split, name independently changeable responsibilities and the coupling it removes; line count alone is not evidence.
- When sub-components share configuration or state, trace each value and action to its owner. Compare defaults, controlled behaviour and actions across consumers. Props, context and compound components are possible mechanisms; props alone do not make this check N/A.

- With the established class-merging helper, order base, conditional, then forwarded classes.

  ```tsx
  cn("rounded px-3", disabled && "opacity-50", className)
  ```

- Co-locate feature hooks and shared read/write hooks.
- Use tuples for state/setter pairs, objects for richer APIs, and getters for keyed batch results.

- For changed type contracts or schemas, load [TypeScript](../typescript-best-practices/SKILL.md).

### State ownership

#### State and hooks

- Trace state and actions forwarded through many components. Use an appropriate store, provider, or narrower component API when intermediate components only relay them.

- Mirror state in a ref only for synchronous imperative reads. Update both through one setter and keep ref reads out of render.

- Use refs for integrations React cannot express through props and state; express React-owned DOM state through props and state.

  ```tsx
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={inputRef} disabled={isSaving} />
      <button onClick={() => inputRef.current?.focus()}>Focus input</button>
    </>
  );
  ```


### Rendering and recovery

- Put hooks before conditional returns so changing query state does not change hook order.

  ```tsx
  const results = useResults();
  if (results.status === "pending") return <p>Loading…</p>;
  if (results.status === "error") return <p>Could not load results.</p>;
  if (results.items.length === 0) return <p>No results.</p>;
  return results.items.map(item => <Row key={item.id} item={item} />);
  ```

- Assign unhandled variants to `never` so new variants expose missing rendering. Render a reasonable fallback for unknown runtime variants rather than throwing on version skew.

  ```tsx
  type Result = { status: "pending" } | { status: "ready"; value: string };
  function ResultView({ result }: { result: Result }) {
    switch (result.status) {
      case "pending": return <p>Loading…</p>;
      case "ready": return <p>{result.value}</p>;
      default: {
        const unhandled: never = result;
        void unhandled;
        return <p>Result unavailable.</p>;
      }
    }
  }
  ```

- Identify regions intended to recover independently. Trace a rendering failure to the fallback and verify required neighbouring UI remains usable. Check the fallback exposes a supported recovery action and identify the state it resets.
- Reset the state responsible for a boundary failure; remounting the fallback alone may reproduce it.

- For fallback and recovery behaviour, load [error handling](../error-handling-best-practices/SKILL.md).

### Effects and requests

- Compare effects or memos sharing inputs and lifetimes for duplicated work. Combine them only when dependencies, conditional execution, ordering and cleanup remain correct. Keep separate hooks when update triggers or owners differ.

- For tRPC query-layer work, load [tRPC best practices](../trpc-best-practices/SKILL.md).

- Guard both result and error handlers after abort; cancellation must not replace current state or show an obsolete failure.

  ```typescript
  useEffect(() => {
    const controller = new AbortController();
    void fetchData({ signal: controller.signal })
      .then(results => {
        if (!controller.signal.aborted) setResults(results);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) reportError(error);
      });
    return () => controller.abort();
  }, [fetchData, reportError, setResults]);
  ```

### Performance and verification

#### Rendering performance

- Before flagging a re-render, effect, or missing latch, trace pending → ready → a later parent render. Name the function that runs again and confirm whether the expensive work repeats after success.
- An unset ref or memo that retries while data is pending, then keeps its first successful result, is intentional. A fix must not latch pending data or prevent the retry that waits for it.

  ```tsx
  // Keep the first successful synchronous result for this mounted owner.
  const prepared = useRef<PreparedSeries | undefined>(undefined);
  useEffect(() => {
    // Pending data must remain eligible for a later retry.
    if (prepared.current !== undefined || series.status !== "ready") return;
    prepared.current = prepareSeries(series.data);
  }, [series]);
  ```

- Do not memoise every object prop by default; identify the expensive calculation or identity-sensitive consumer.

- Keep ordinary handlers inline when callback identity has no benefit.

- Async transition actions depend on the React version. Transitions do not handle every kind of network loading; handle failures, cancellation, and races explicitly.

- For measured rendering costs, load [TypeScript performance guidance](../typescript-best-practices/SKILL.md#performance-and-resources).
- For changed interactions, effect cleanup, or races, load [testing](../testing-best-practices/SKILL.md) and apply its coverage and layer-selection rules. Do not request a render test for every changed component. A store/client/helper test is preferable for domain logic; React tests need a specific interaction, DOM, wiring or lifecycle risk that remains uncovered at that layer.
