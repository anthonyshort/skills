---
name: nominal-galaxy-testing
description: Use for Galaxy store and domain-client test setup, reactive scheduling, MSW harnesses and test discovery.
---

# Galaxy testing best practices

## Stores and clients

- Use real stores and small valid workbook or report fixtures. Invoke public methods and inspect observable state and domain effects.
- Flush the package's actual reactive scheduler before asserting scheduled results. Use fake time for debounce and timer behaviour.
- Dispose owned stores and subscriptions.
- Test domain-client operations through their real public APIs without mounting editor UI merely to reach them.
- Supply stores through supported providers. Keep actual publishers and subscribers when checking event wiring.

## Backend harness

- Inspect the active package's generated clients, context construction and MSW setup.
- Reuse the selected test project's shared server lifecycle. Reset handlers and fail unexpected requests.
- If a suitable harness is missing, report the gap. A pure unit stand-in does not prove real transport or persistence.

## Discovery and execution

- Keep ordinary tests beside the implementation with `.test.ts` or `.test.tsx`. When a feature needs several distinct suites, a nearby `tests/` or `perf/` folder is fine. Avoid multiplying filename suffixes and verify discovery in the active runner.
- Do not put tests in non-API Next.js `pages/` folders. Move testable logic and adjacent tests into `client/`.
- Check the active Vitest project's inclusion and exclusion patterns. Dedicated browser or bundled projects may differ.
- Distinguish exact-head local results from CI evidence. Use focused Bazel targets through `./bazelw` according to the current repository setup.
- Check available version managers and `.nvmrc` before declaring a Node version mismatch a blocker.
