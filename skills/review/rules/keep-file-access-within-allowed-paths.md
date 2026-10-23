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

## Good and bad examples

The service reads files below `/srv/uploads`. A sibling such as `/srv/uploads-private` is outside that directory.

**Bad: a string prefix accepts the sibling directory**

```typescript
const candidate = path.resolve(base, requestedPath);
if (!candidate.startsWith(base)) throw new Error("Outside upload directory");
return readFile(candidate);
```

**Good: check path segments rather than string prefixes**

```typescript
const resolvedBase = path.resolve(base);
const candidate = path.resolve(resolvedBase, requestedPath);
const relative = path.relative(resolvedBase, candidate);

if (
  relative === ".." ||
  relative.startsWith(`..${path.sep}`) ||
  path.isAbsolute(relative)
) {
  throw new Error("Outside upload directory");
}

return readFile(candidate);
```

The good example fixes lexical containment only. It assumes the directory tree contains no escaping symlinks and cannot be modified by an untrusted actor during access. If that assumption does not hold, check filesystem-level protections and handle-based access guarantees. Resolving symlinks before opening a path still leaves a check/use race.
