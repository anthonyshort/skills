# Localise values shown to users

## When to check

Changed code displays or formats currency, dates, times, numbers, percentages or other locale-sensitive values.

## What to check

- Trace the displayed value from its caller to the formatter and the active application locale. Inspect hardcoded locale strings, implicit runtime defaults, `Intl` calls and custom formatting helpers as leads, not proof of a violation.
- Use the existing locale-aware component or formatter. If a pure helper cannot accept locale, add that capability and pass the active locale from the UI boundary. Do not call a React hook from a plain formatter or module-level column definition.
- Preserve the value's currency code, precision, units and domain timezone. Locale changes presentation, not which currency an amount represents or when a deadline occurs.
- Compare meaningful output in different supported locales. Check date boundaries when timezone or calendar-date semantics matter. Do not require migrating unrelated callers to fix the changed presentation.
- Treat verified failures to follow the active application locale as required corrections, not optional style suggestions. Explain the affected output and supported correction. Severity depends on impact, and unavailable locale evidence remains a coverage gap.

## Why it matters

Fixed or machine-default formatting can show unfamiliar separators, currency placement or dates that disagree with the rest of the application. Formatting changes can also accidentally alter financial precision or calendar-day meaning.

## Exceptions

Machine-readable serialisation, identifiers, protocol formats and explicitly fixed scientific or domain displays may require a stable format. An intentional UTC calendar date can still use the viewer's locale. Preserve an established technical display mode rather than assuming every number should use locale grouping.

## Good and bad examples

Assume the caller has the active locale, amounts are in whole currency units, and this display requires two decimal places. The currency comes from the record, not from locale. A real caller must retain its own precision policy.

```typescript
// Bad: ignores the active locale.
function formatAmountBefore(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Good: the UI supplies locale while the amount's contract stays the same.
function formatAmount(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
```

For `1234.5` USD, compare `en-GB` with `de-DE`: grouping, decimal separators and currency placement should follow locale while USD and two decimal places remain unchanged.

An intentionally UTC date is a valid exception to viewer-timezone conversion, not to localisation:

```typescript
function formatBillingDay(day: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(day);
}
```
