---
name: react
description: Use when writing, refactoring, or reviewing React and TypeScript components, hooks, context, state, effects, and rendering behaviour.
---

# React best practices

## Goal

Keep React state, effects, and rendering predictable across interactions, recovery, and component lifetimes.

## Guidance

### Component APIs

- Use named components and clear props types. Follow existing exports. Do not add `React.FC` solely to type props.
- Name custom hooks `useName` and reuse suitable feature hooks. Use plain functions for utilities that do not need React behaviour.

- Identify the state, behaviour, layout or contract each changed component owns. Wrappers can own styling, accessibility, context, lifecycle or integration. For a split, name independently changeable responsibilities and the coupling it removes; line count alone is not evidence.
- When sub-components share configuration or state, trace each value and action to its owner. Compare defaults, controlled behaviour and actions across consumers. Props, context and compound components are possible mechanisms; props alone do not make this check N/A.

- With the established class-merging helper, order base, conditional, then forwarded classes.

  ```tsx
  cn("rounded px-3", disabled && "opacity-50", className)
  ```

- Co-locate feature hooks and shared read/write hooks.
- Use tuples for state/setter pairs, objects for richer APIs, and getters for keyed batch results.

### State ownership

#### State and hooks

- Keep interaction state local and give shared state one source of truth.
- Calculate derived values rather than storing them and synchronising with effects.
- Use functional setters when an update depends on previous state.

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

### Effects and requests

- Keep requests and mutations out of render and memoisation callbacks.
- Use effects to synchronise external systems. Keep interaction work in handlers.
- Include reactive dependencies. Release subscriptions, timers and obsolete requests safely across repeated mounts.
- Use the established query layer for server-state caching and deduplication.

- Compare effects or memos sharing inputs and lifetimes for duplicated work. Combine them only when dependencies, conditional execution, ordering and cleanup remain correct. Keep separate hooks when update triggers or owners differ.

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

- Keep ordinary handlers inline when callback identity has no benefit. Stabilise callbacks and context values only for a concrete identity-sensitive consumer. Include their reactive dependencies.

- Use transitions for non-urgent updates. Async transition actions depend on the React version. Transitions do not handle every kind of network loading; handle failures, cancellation, and races explicitly.

- Verify changed interactions, effect cleanup and races at the cheapest layer that can catch the risk. Prefer store, client or helper tests for domain logic. React tests need a specific interaction, DOM, wiring or lifecycle risk not covered at that layer.
