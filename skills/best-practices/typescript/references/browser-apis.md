# Browser APIs and loading

## Prefer existing capabilities

Check native APIs and existing dependencies before adding a library or build step.

- Use `fetch`, `URL`, `URLSearchParams` and `Intl` when they meet the required behaviour.
- Preserve errors, retries, cancellation and compatibility when replacing a library.
- Check the values being copied before using `structuredClone`. It supports dates but cannot copy functions or DOM nodes.

## Write untrusted text safely

Use text APIs for untrusted text. A `<template>` does not make interpolated markup safe.

```typescript
// Avoid: input becomes markup.
message.innerHTML = untrustedText;

// Prefer: input remains text.
message.textContent = untrustedText;
```

Use an established sanitiser when the feature intentionally accepts HTML. Do not build a custom escaping system.

## Check browser loading costs

- Inspect actual bundle output. Import syntax alone does not prove unused code was removed.
- Split optional features or defer non-critical scripts when this improves loading.
- Measure affected rendering and interaction paths before claiming a performance improvement.
