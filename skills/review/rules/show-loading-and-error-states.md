# Show the actual loading and result state

## When to check

The change displays asynchronous results, progress, success messages or actions that can become unavailable.

## What to check

- Trace each result state from the request or worker to what the user sees. Keep failed, empty, missing, recovering and truncated results distinguishable where they require different next steps. An empty fallback must not hide a failed request.
- Check progress against the operation’s real completion condition. Reserve 100% and success messages for results that are ready to use. Finishing a transfer or rounding a percentage must not imply later processing has finished.
- Explain why an action is unavailable where the user can find the explanation, including when the disabled control cannot receive focus. Keep loading feedback visible without claiming success.
- Identify a reachable state that the changed UI misrepresents and the consequence for the user. Inspect transitions as well as initial rendering, including retries that retain an older result.

## Why it matters

Users may repeat work, trust incomplete results or assume there is no data when the operation actually failed. Unexplained disabled actions leave them unable to continue.

## Exceptions

Several internal phases can share one loading message when users do not need to distinguish them. A partial result can remain useful when its limits and current recovery state are clear. A progress bar for one explicitly named phase may finish before the whole operation does.

## Good and bad examples

Assume progress is a finite fraction between zero and one. The operation can finish transferring before its result is ready. These pure functions illustrate status text, not a complete accessible progress widget.

```typescript
type State =
  | { kind: "loading"; progress: number }
  | { kind: "recovering" }
  | { kind: "failed" }
  | { kind: "missing" }
  | { kind: "ready"; count: number; truncated: boolean };

// Bad: loading can say 100%, and failures look like empty results.
function messageBefore(state: State): string {
  if (state.kind === "loading") {
    return `${Math.round(state.progress * 100)}% complete`;
  }
  return state.kind === "ready" ? `${state.count} results` : "No results";
}

// Good: text preserves states that need different user responses.
function message(state: State): string {
  switch (state.kind) {
    case "loading":
      return `${Math.min(99, Math.floor(state.progress * 100))}% processing`;
    case "recovering":
      return "Reconnecting…";
    case "failed":
      return "Could not load results. Try again.";
    case "missing":
      return "This result is no longer available.";
    case "ready":
      if (state.truncated) {
        return `Showing the first ${state.count} results`;
      }
      return state.count === 0 ? "No results" : `100% complete: ${state.count} results`;
  }
}
```
