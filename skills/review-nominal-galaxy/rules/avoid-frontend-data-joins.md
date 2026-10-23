# Keep backend data joins out of UI callers

## When to check

A frontend caller fetches multiple backend resources and assembles a domain result.

## What to check

Consider moving backend joins into an owning tRPC or backend operation. Preserve permissions, errors and necessary partial results.

## Why it matters

Repeated client joins spread orchestration and can multiply requests.

## Exceptions

UI-only projections and independent resources need not become server joins. Show actual request cost and a supported server boundary.

## Good and bad examples

**Bad for this case**

```typescript
const reports = await listReports();
const rows = await Promise.all(reports.map(async report => ({
  report, owner: await getUser(report.ownerId),
})));
```

**Good for this case**

```typescript
const rows = await getReportRows();
```

getReportRows represents a proposed server operation. Verify or implement that contract rather than assuming it exists.
