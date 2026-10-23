---
name: nominal-galaxy-workbook
description: Use for Galaxy workbook and report domain clients, workbook-to-compute ownership, host capabilities and saved-data migrations.
---

# Galaxy workbook best practices

## Domain ownership

- Find the package that owns the schema, contract or operation. Check current exports before adding another implementation.
- Use supported `WorkbookClient`, `ReportClient` and `WorkbookTemplateClient` operations for creation, copying and layout changes. Verify availability in the reviewed branch.
- Keep reusable mutations callable without editor stores or mounted React. UI stores coordinate domain operations.
- Keep workbook-to-compute derivation in workbook-store when it selects sources, resolves domain defaults or combines workbook state.
- Put transformations that enforce workbook invariants in owning store actions. Display-only projections can stay in components.

## Saved data and migrations

- Check migrations against representative saved workbook and report fixtures.
- Keep version migrations distinct from normalisation on load. Repeated loading must not add duplicates or recreate intentionally removed inputs.
- Verify the active migration state before recommending replacement APIs. Keep supported intermediate boundaries.
