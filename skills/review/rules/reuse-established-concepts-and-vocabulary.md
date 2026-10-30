# Reuse established concepts and vocabulary

## When to check

A change adds or renames an API where the code already has a similar concept.

## What to check

- Find the existing API, who owns it and how callers use it.
- If the job is the same, extend that API and keep its terms. Moving code into a helper or adding loading state is not a reason to invent a new name for the concept.
- Make real differences clear. Callers should be able to tell loading state from available results without reading the implementation.
- If replacing the API, explain the benefit and how callers move to it. Show an example of the proposed API.

Confusing shared APIs are a design issue, not just a naming nit. Describe the confusion without claiming a runtime bug unless one is shown.

## Why it matters

Two names for the same concept make the code harder to learn and can split one job across competing APIs.

## Exceptions

Use different names for different concepts. Keep names required by external APIs at their boundary. A clearer name or a real change in meaning can justify a rename. Do not force unrelated jobs together or require a repository-wide rename.

## Good and bad examples

An input store already resolves queries into member lists. The change adds loading and errors to the same operation. These examples show API shape only.

```typescript
interface ResolvedInput {
  memberIds: readonly string[];
}

interface ResolutionState<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
}
```

```typescript
// Bad: two names for the same job.
interface InputStoreBefore {
  resolvedInputs: Record<string, ResolvedInput>;
  materializedInputs: Record<string, ResolvedInput>;
  resolveQueries(): Promise<void>;
  materializeQueries(): Promise<void>;
}
```

```typescript
// Good: keep the name and make the added state clear.
interface InputStoreAfter {
  resolvedInputs: Record<string, ResolvedInput>;
  inputResolutionStates: Record<string, ResolutionState<ResolvedInput>>;
  resolveQueries(): Promise<void>;
}
```

A new helper can be called `QueryResolver`. It still does the same job.

Keep existing behaviour when renaming. If `resolvedInputs` can include unresolved queries, a view that leaves them out needs a clear name, such as `availableResolvedInputs`. Matching names alone do not make the two views behave the same.
