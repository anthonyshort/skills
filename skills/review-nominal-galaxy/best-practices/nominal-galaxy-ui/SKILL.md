---
name: nominal-galaxy-ui
description: Use for Galaxy shared UI components, resource hooks, locale, errors, notifications and design-system consumers.
---

# Galaxy UI best practices

## Shared components

- Search `packages/ui` and `apps/scout/src/client/components` for existing components. Import them from their defining package.
- Repeated overrides that replace shared defaults may justify a named variant or a different component. One-off spacing can stay local.
- Include corresponding Storybook changes for exported design-system component changes.
- Use the adopted `cn` helper with consumer `className` last.
- Reuse `GenericErrorBoundary` with its supported fallback and reset action.
- Use the existing toast API and variants.

## Resources and presentation

- Preserve RID-based resource contracts, batch lookups and `Loading<T>` getters.
- Read locale through `useLocale` or `useTimezoneAndLocale`. Avoid hardcoded locales.
- Use sentence case and the feature's product terminology.
- Check affected feature-flag states.
- Trace read-only, locked and historical-view state through the existing permissions or editing provider. Keep controls consistent with that owner instead of inventing local editability checks. UI gating does not replace server authorisation.
- Check the size, depth and frequency of `useDeepCompareMemo` inputs. Prefer recomputation or narrow stable dependencies when comparison costs more than the work avoided.

Verify these captured conventions in the affected package before applying them.
