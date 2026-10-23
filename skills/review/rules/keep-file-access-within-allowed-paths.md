# Keep file access within allowed paths

## When to check

External input controls a filesystem path or the change checks access within a permitted directory.

## What to check

- Resolve the path against the permitted base and use path-aware containment checks. A string prefix can match an unrelated sibling directory.
- Check absolute paths, parent traversal and relevant platform path forms.
- Trace symlinks and changes between checking and opening the path. An earlier containment check may no longer protect the operation.
- Check the actual filesystem operation and its guarantees. Explain the violating input or race instead of only flagging a path API.

## Why it matters

A caller may read, write or delete files outside the intended boundary.

## Exceptions

Trusted fixed paths may not need containment checks. Account for actual filesystem permissions and supported platform guarantees. Do not claim a race is prevented without checking the operation used.
