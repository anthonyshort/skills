# Galaxy review rules

Select relevant rules alongside the main review rules. Verify current APIs and product intent before applying a rule. Use the same rule-checking subagent for both collections. Work through rules one at a time and record evidence, exceptions or skip reasons.

| Rule | When to check |
| --- | --- |
| [Keep series data out of stores](keep-series-data-out-of-stores.md) | Workbook store methods or state start carrying computed series data. |
| [Keep panels independent of workbook internals](keep-panels-independent-of-workbook-internals.md) | A panel imports workbook inspector state or assumes a workbook-specific host. |
| [Keep backend data joins out of UI callers](avoid-frontend-data-joins.md) | A frontend caller fetches multiple backend resources and assembles a domain result. |
| [Avoid fetching every page to complete one request](avoid-fetching-all-pages-automatically.md) | A frontend operation automatically walks all backend pages. |
| [Use download URLs for large files](use-download-urls-for-large-files.md) | Next.js proxies large backend or object-storage payloads. |
| [Design mutation tools for batches](design-mcp-tools-for-batches.md) | A new or changed mutation tool in apps/nominal-mcp handles one item at a time. |
| [Bound tool requests and results](bound-mcp-work-and-output.md) | An MCP tool lists, expands or mutates multiple resources. |
