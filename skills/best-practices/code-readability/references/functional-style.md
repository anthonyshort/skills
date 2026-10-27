# Make the main operation readable

This compact example separates selection, serialisation and writing. Both versions preserve row order, trim labels, skip empty selections and await the write. The same reasoning applies to larger bodies with these phases buried in detail.

Shared types:

```typescript
type Row = Readonly<{ id: string; name: string; hidden: boolean }>;
type ExportRecord = { id: string; label: string };
type Write = (content: string) => Promise<void>;
```

## Before: details obscure the steps

```typescript
async function exportRows(
  rows: readonly Row[],
  selectedIds: ReadonlySet<string>,
  write: Write,
): Promise<void> {
  const records: ExportRecord[] = [];
  for (const row of rows) {
    if (!row.hidden && selectedIds.has(row.id)) {
      records.push({ id: row.id, label: row.name.trim() });
    }
  }
  if (records.length === 0) {
    return;
  }
  await write(JSON.stringify(records));
}
```

The reader must follow selection and record construction to discover the operation’s shape.

## After: compose named operations

```typescript
async function exportRows(
  rows: readonly Row[],
  selectedIds: ReadonlySet<string>,
  write: Write,
): Promise<void> {
  const selectedRows = selectExportRows(rows, selectedIds);
  if (selectedRows.length === 0) {
    return;
  }
  await write(serialiseRows(selectedRows));
}
```

Keep the helpers private at module scope:

```typescript
function selectExportRows(
  rows: readonly Row[],
  selectedIds: ReadonlySet<string>,
): readonly Row[] {
  return rows.filter(row => !row.hidden && selectedIds.has(row.id));
}

function serialiseRows(rows: readonly Row[]): string {
  const records: ExportRecord[] = rows.map(row => ({
    id: row.id,
    label: row.name.trim(),
  }));
  return JSON.stringify(records);
}
```

The caller exposes the sequence. Each pure helper names a meaningful phase without capturing mutable local state. One caller is enough to justify this when it improves reading. A body this small can also reasonably stay inline.

## Avoid trivial fragmentation

These helpers add navigation without explaining a meaningful operation:

```typescript
function getName(row: Row): string {
  return row.name;
}

function trimName(name: string): string {
  return name.trim();
}
```

Prefer `row.name.trim()` to `trimName(getName(row))`. Extract meaningful steps, not every expression.
