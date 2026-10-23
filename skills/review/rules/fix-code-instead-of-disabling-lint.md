# Fix the code instead of disabling lint checks

## When to check

Changed code is covered by a lint suppression, including an existing one. Also check changes that disable rules, lower their severity, remove plugins or exclude files from linting.

## What to check

- **Find bypasses:** Inspect line, block and file directives such as `eslint-disable`, `oxlint-disable` and `biome-ignore`. Check configuration, ignore patterns and lint commands too.
- **Understand the check:** Identify the disabled rule, affected code and what the rule protects. A passing lint job does not verify excluded code.
- **Fix the design:** Look for a solution that keeps the rule enabled. For hook dependencies, make reactive inputs explicit or change who owns the calculation and subscription.
- **Apply the blocking policy:** Suppressing React's dependency checks, such as `react-hooks/exhaustive-deps`, is a P0 required fix in this review. This includes suppressions used to add an artificial invalidation dependency. Ask for a different implementation even when no stale result has been reproduced.
- **Keep evidence precise:** Cite the suppression and affected hook or configuration. Explain the bypass and required change. Do not claim a runtime failure without evidence. Assess other disabled rules by what they protect and the supported risk.

## Why it matters

Suppressions can hide fragile dependencies and prevent tooling from catching later mistakes. Explaining a workaround in a comment does not restore that protection.

## Exceptions

A narrow suppression for a verified tool bug, generated code or an intentional test fixture can be reasonable. Explain why a code fix is unsuitable and keep the exception scoped to the affected rule and code.

These exceptions do not waive the P0 policy for React dependency checks. Only an explicit user-approved exception can do that. Do not flag unrelated, untouched legacy suppressions.

## Good and bad examples

The total must reflect the current items. A separate revision value makes callers responsible for remembering when to invalidate it.

**Bad: disable the check and rely on a separate invalidation signal**

```tsx
function CartTotal({ items, revision }: {
  items: readonly { price: number }[];
  revision: number;
}) {
  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.price, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [revision],
  );
  return <span>{total}</span>;
}
```

**Good: calculate from the actual input**

```tsx
function CartTotal({ items }: {
  items: readonly { price: number }[];
}) {
  const total = items.reduce((sum, item) => sum + item.price, 0);
  return <span>{total}</span>;
}
```

This example assumes a cheap calculation and React updates when items change. An expensive calculation can use `useMemo` with its actual dependencies. For an external store, expose and subscribe to the required reactive values. Removing the suppression alone is insufficient if the underlying invalidation contract is still hidden.
