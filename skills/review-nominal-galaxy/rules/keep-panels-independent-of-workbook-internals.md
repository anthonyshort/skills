# Keep panels independent of workbook internals

## When to check

A panel imports workbook inspector state or assumes a workbook-specific host.

## What to check

Use narrow host capabilities for settings, layout, actions and time policy. Do not force hosts to supply fake workbook, asset or run values.

## Why it matters

Panels become difficult to reuse when their host boundary exposes workbook internals.

## Exceptions

Workbook-only orchestration can know workbook details. A separate time policy needs a supported product reason.

## Good and bad examples

**Bad for this case**

```typescript
panel.workbook.inspector.selectedPanelId = panel.id;
```

**Good for this case**

```typescript
host.openPanelSettings(panel.id);
```

The host capability is illustrative. Verify the actual host API and preserve its time and lifecycle contracts.
