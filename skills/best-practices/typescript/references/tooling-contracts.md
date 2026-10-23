# Tooling and contracts

- Search for canonical types before adding replacement models. Name types and functions for their domain purpose.
- Consider an options object for three or more parameters when it makes calls clearer. Preserve existing contracts unless migrating callers.

- Follow repository tooling and prefer strict checking. Do not impose `isolatedDeclarations` or change configuration for unrelated work.
- Mixed value/type imports can use inline `type` specifiers where module configuration permits.

- Annotate public returns for stable contracts or declaration requirements; allow useful local inference. Inspect emitted declarations for compatibility.

- Use `unknown` when a value's shape is deliberately unspecified.

## Verification

- Run applicable typechecks for changed construction sites and consumers.
- Inspect emitted declarations when public compatibility is at risk.
