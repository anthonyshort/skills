# Galaxy shared UI and resources

## Checklist

**Shared UI and resources**

- [ ] **UI imports** - Import reused components and hooks from their defining package.
- [ ] **Deep comparison cost** - Check `useDeepCompareMemo` comparisons cost less than the work they avoid.
- [ ] **Component variants** - Check repeated overrides of shared defaults need a variant or a different component.
- [ ] **Design-system stories** - Check exported component changes have corresponding Storybook changes.
- [ ] **UI copy** - Use sentence case.
- [ ] **Locale and timezone** - Use the established hooks rather than hardcoded locales.
- [ ] **Class overrides** - Check cn preserves consumer overrides.
- [ ] **Error boundaries** - Use GenericErrorBoundary with its supported fallback and reset.
- [ ] **Toasts** - Use the established API and variants.
- [ ] **Resource hooks** - Preserve RID, batch lookup, and Loading<T> contracts.
- [ ] **Terminology** - Use the feature's product terms.
- [ ] **Feature flags** - Verify affected flag states.

## Guidance

### Shared UI and resources

Verify these captured conventions in the affected package before applying them.

- Search `packages/ui` and `apps/scout/src/client/components` for existing UI; import it from its defining package. When overrides replace visual or behavioural defaults, compare repeated uses for a missing named variant or a different component. One-off size and spacing overrides can remain local.
- Add corresponding Storybook changes for exported design-system components. Test complex rendering logic and check listener/timer cleanup.
- Check the size and depth of `useDeepCompareMemo` dependencies and how often they are compared. Large values can cost more to compare than to recompute. Prefer recomputation or `useMemo` with stable, narrow dependencies when deep comparison adds no benefit; measure when the trade-off is unclear.
- Use sentence case for UI copy. Read locale through `useLocale` or `useTimezoneAndLocale`; do not hardcode it.
- Use the established `cn` helper and override order where adopted.

  ```typescript
  cn(baseClasses, isSelected && selectedClasses, className)
  ```

- Reuse `GenericErrorBoundary` with the supported fallback and reset action.
- Use the existing toast API and variants where applicable.
- Preserve RID-based resource-hook contracts, including batch lookups and `Loading<T>` getters.
- Use product terminology and check feature-flag behaviour.
