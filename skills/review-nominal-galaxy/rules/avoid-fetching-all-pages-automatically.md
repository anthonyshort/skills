# Avoid fetching every page to complete one request

## When to check

A frontend operation automatically walks all backend pages.

## What to check

Identify whether a better endpoint in nominal-io/scout can answer the actual task. Measure requests and preserve completeness.

## Why it matters

Unbounded page walking makes latency and resource usage grow with all stored data.

## Exceptions

User-driven pagination and intentional bounded exports differ. Do not replace complete results with a single incomplete page.

## Good and bad examples

**Bad for this case**

```typescript
const items = await fetchEveryPage(listReports);
const match = items.find(report => report.id === reportId);
```

**Good for this case**

```typescript
const match = await getReport(reportId);
```

This comparison assumes an adopted direct lookup exists and enforces equivalent access and error behaviour.
