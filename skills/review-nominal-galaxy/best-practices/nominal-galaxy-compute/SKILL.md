---
name: nominal-galaxy-compute
description: Use for Galaxy compute subscriptions, streaming time, series status, Arrow access and worker cache ownership.
---

# Galaxy compute best practices

## Subscriptions

- Search `apps/scout/src/client/hooks/compute` before adding another subscription hook.
- Use `useSubscriptionStatuses` for status-only reads. Avoid memo dependencies on entire `SeriesData` values.
- Keep streaming subscriptions independent of continually changing workbook time ranges. Inspect `SinglePointSubscriptionRequest` for the current approach.
- Use real subscription UUIDs that remain stable for the subscription lifetime. Keep identity with its lifecycle owner rather than generating it on every render.

## Data processing

- Read the target repository's `docs/arrow.md` when working with Arrow tables. Verify its guidance against the installed APIs.
- Search compute-worker handlers and `SeriesDataCache` before adding bookkeeping state.
- Check relevant empty, sparse, high-frequency and disconnected cases. Use actual data bounds.
- Support performance claims with comparable measurements. Consider a runtime metric when useful.
- Keep warnings actionable and avoid repeated toast spam.
