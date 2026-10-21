# Galaxy compute and subscriptions

## Checklist

**Compute and subscriptions**

- [ ] **Existing hooks** - Reuse the compute subscription hooks before adding another.
- [ ] **Status subscriptions** - Use `useSubscriptionStatuses` when only series status is needed.
- [ ] **Series dependencies** - Avoid memoising whole `SeriesData` values.
- [ ] **Streaming time** - Keep streaming subscriptions independent of changing workbook time ranges.
- [ ] **Subscription IDs** - Use real UUIDs stable for the subscription lifetime.
- [ ] **Arrow reads** - Follow `docs/arrow.md` when reading Arrow tables.
- [ ] **Worker bookkeeping** - Check handlers and `SeriesDataCache` for an existing owner.
- [ ] **Compute cases** - Test relevant empty, sparse, high-frequency, and disconnected states.
- [ ] **Performance baseline** - Check performance changes have a Vitest benchmark committed on main.
- [ ] **Performance metrics** - Check whether a runtime metric can show the improvement.
- [ ] **Warnings** - Avoid repeated warnings or toast spam.

## Guidance

### Compute and subscriptions

- Reuse hooks in `apps/scout/src/client/hooks/compute`. Use `useSubscriptionStatuses` for status-only reads; avoid dependencies on whole `SeriesData` values.
- While streaming, do not subscribe to the workbook's continually changing `timeRange`. Split components where hook order requires it; inspect `SinglePointSubscriptionRequest` for the established approach.
- Keep subscription UUIDs stable. Creating a new UUID on every render belongs in the store instead.
- Read `docs/arrow.md` for Arrow table access. Search compute-worker handlers and `SeriesDataCache` before adding bookkeeping state.
- Test the changed algorithm against relevant empty, sparse, high-frequency, and disconnected data. Check bounds and actual data extent using the shared TypeScript guidance.
- For a performance improvement, require a Vitest benchmark already committed on main so before/after results are comparable. Look for a reasonable runtime metric as well.
- Keep warnings useful; do not spam users with repeated toasts.
