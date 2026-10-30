# Use the app’s locale when formatting values

## When to check

The change formats money, dates, times, numbers, percentages or other values whose display depends on the user’s language and region.

## What to check

- Find where the app gets the user’s language and region preferences, called its locale. Follow the displayed value to the formatter and check that it uses this locale. A fixed locale, the runtime’s default or a custom formatter is a reason to inspect the caller, not proof of a problem.
- Use an existing component or formatter that uses the app’s locale. If a plain helper cannot use it, add a locale argument and pass it from the UI. Call React hooks from a component or columns hook, not from a plain function or a column definition at module level.
- Keep the amount’s currency, decimal places and units unchanged. Keep the timezone chosen for the feature. Locale controls how a value is written, not which currency it is in or when a deadline falls.
- Compare the output in different supported locales. For dates, check times near midnight when changing timezone could change the day shown. Limit the fix to the changed display and callers it affects.
- When the output uses the wrong locale, require a fix rather than calling it an optional style change. Show the affected output and how to correct it with an available API. Set priority from the impact. If the expected locale cannot be established, say what is unknown.

## Why it matters

A fixed locale or server default can show separators, currency symbols or dates differently from the rest of the app. A formatting fix can also accidentally round an amount differently or show the wrong day.

## Exceptions

Data sent between systems, identifiers and protocol messages may need a fixed format. Scientific displays or formats required by a feature can also stay fixed. A date that must be shown in UTC can still use the viewer’s locale. Keep the chosen scientific or technical number format when changing it would change its meaning.

## Good and bad examples

In this example, the caller has the app’s locale. Amounts are already in whole currency units, and this display requires two decimal places. The currency comes from the record. Other callers should keep the number of decimal places their feature requires.

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

// Good: use the app's locale without changing the amount or currency.
function formatAmount(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
```

For `1234.5` USD, compare `en-GB` with `de-DE`. Grouping, decimal separators and currency placement should change. The currency should still be USD, with two decimal places.

If a billing date must stay in UTC, pass the locale without changing that timezone:

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
