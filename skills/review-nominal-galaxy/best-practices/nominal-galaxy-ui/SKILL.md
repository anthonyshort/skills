---
name: nominal-galaxy-ui
description: Use for Galaxy shared UI components, resource hooks, locale, errors, notifications and design-system consumers.
---

# Galaxy UI best practices

## Shared components

- Search `packages/ui` and `apps/scout/src/client/components` for existing components. Import them from their defining package.
- Check what DataTable already does for loading and user actions before adding table code in a feature. Infinite scroll is not the right choice for every flow. If paging controls belong with the shared table, add them there and let the feature supply the rows and any functions needed to load more.
- Use the column builder’s `withOptions` before adding a helper that only forwards options. Look for shared column definitions when the same column behaviour is repeated. Do not create a registry for possible future callers.
- Repeated overrides that replace shared defaults may justify a named variant or a different component. One-off spacing can stay local.
- Include corresponding Storybook changes for exported design-system component changes.
- Use the adopted `cn` helper with consumer `className` last.
- Reuse `GenericErrorBoundary` with its supported fallback and reset action.
- Use the existing toast API and variants.

## Resources and presentation

- Preserve RID-based resource contracts, batch lookups and `Loading<T>` getters.
- Use sentence case and the feature's product terminology.
- Check affected feature-flag states.
- Trace read-only, locked and historical-view state through the existing permissions or editing provider. Keep controls consistent with that owner instead of inventing local editability checks. UI gating does not replace server authorisation.
- Check the size, depth and frequency of `useDeepCompareMemo` inputs. Prefer recomputation or narrow stable dependencies when comparison costs more than the work avoided.

## Formatting values

- Read the app’s language and region preferences through `useLocale` from `@react-aria/i18n`, or use `useTimezoneAndLocale` when timezone is also needed. Call these hooks from a component or columns hook, then pass locale to formatting functions.
- Use Scout’s `TimestampDisplay` to show timestamps. It uses `useDisplayTimezone` to get locale and the timezone set by an enclosing `DisplayTimezoneProvider`. When creating a string without that component, check the current `formatTimestamp` options and pass locale and the intended timezone. A billing date that must stay in UTC need not use the viewer’s timezone.
- Use `formatNum` with `displayOption: "LOCALE"` and pass locale when numbers should follow the user’s language and region. Keep scientific or other technical modes when the feature needs them.
- Check which arguments and defaults the current currency helper supports. If `formatCurrency` fixes a locale and has no locale argument, add one before suggesting that callers pass it. Keep the record’s currency and the required decimal places, and check the helper’s existing callers when changing it.

Verify these captured conventions in the affected package before applying them.
