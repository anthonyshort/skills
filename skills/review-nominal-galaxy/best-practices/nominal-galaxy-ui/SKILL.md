---
name: nominal-galaxy-ui
description: Use for Galaxy shared UI components, resource hooks, locale, errors, notifications and design-system consumers.
---

# Galaxy UI best practices

## Shared components

- Search `packages/ui` and `apps/scout/src/client/components` for existing components. Import them from their defining package.
- Check DataTable's existing loading and interaction capabilities before adding feature-local table plumbing. Its infinite-loading support does not establish that infinite scroll suits every flow. Keep page controls with the shared table when that is their owner, while the feature supplies the data operation.
- Use the column builder's supported `withOptions` configuration before adding a forwarding wrapper. Look for existing shared column definitions when semantics repeat, without extracting a registry for a speculative consumer.
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

## Localised values

- Read locale through `useLocale` from `@react-aria/i18n`, or use `useTimezoneAndLocale` when both values are needed. Bind hooks in a component or columns hook and pass locale to pure formatters.
- Use Scout's `TimestampDisplay` for rendered timestamps. It reads `useDisplayTimezone`, preserving locale and the enclosing `DisplayTimezoneProvider` override. For strings outside that component, verify the current `formatTimestamp` options and supply locale and the intended timezone explicitly. An intentional UTC billing date need not switch to the viewer's timezone.
- Use `formatNum` with `displayOption: "LOCALE"` and explicit locale for locale-formatted numbers. Preserve deliberately selected scientific and other technical modes.
- Inspect the current currency helper's signature and defaults. If `formatCurrency` fixes a locale and cannot accept one, add locale support before suggesting a caller option. Preserve the record's currency and the owning precision policy, and check supported callers when extending the helper.

Verify these captured conventions in the affected package before applying them.
