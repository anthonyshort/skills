# Check what package imports load

## When to check

The change adds a package import, changes a package entry point, or moves code into a worker or separately built package.

## What to check

- Follow the entry point to the code it loads. Check side effects, browser-only code, worker support and bundle size where relevant. Importing one function from an index does not prove that only that function will be included.
- Use a smaller supported entry point when it avoids unwanted work. Check the package’s exports before recommending a deep import that bypasses its public API.
- Check where nested dependencies actually resolve in the built output and target runtime. A dependency working from the repository root does not prove it is declared and available for the package that uses it.
- Use the actual package manager, module format and build settings as evidence. Keep source-level concerns separate from a reproduced loading or bundle failure.

## Why it matters

An import can pull unrelated code into a worker or browser bundle. A package can also fail after installation if its dependency resolves only by accident in the development checkout.

## Exceptions

An index import is fine when the build removes unused code and its side effects are appropriate. Some packages expose only one supported entry point. Do not replace public imports with private paths or assert a bundle regression without checking the build.

## Good and bad examples

Assume this package publicly exports both paths. Its main index immediately starts browser-only tools, while the `format` entry point has no such startup work. These are illustrative package names and exports.

```typescript
// Bad for this worker: importing the index starts the browser-only tools.
import { formatNumber } from "table-tools";

export const previewLabel = formatNumber(1234);
```

```typescript
// Good for this worker: use the supported formatter entry point.
import { formatNumber } from "table-tools/format";

export const previewLabel = formatNumber(1234);
```

The second import is not automatically valid for another package. Verify its exported paths and resolved dependencies before suggesting the same change.
