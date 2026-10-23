# Check retries for repeated side effects

## When to check

The change affects an operation with side effects and a realistic retry or duplicate-request path.

## What to check

- Trace what happens when the operation succeeds but its response is lost. Check whether retrying repeats the side effect.
- Check concurrent duplicate requests, not just sequential retries.
- Where idempotency keys exist, check that the same key and inputs return a consistent result without repeating the effect.
- Check what happens when the same key is reused with different inputs. Verify conflicting reuse is handled according to the contract.
- Inspect the effect boundary and any transaction or deduplication guarantees. A caller precheck alone does not prevent concurrent duplicates.
- Use a code trace or focused reproduction to explain the effect, conditions and limits. Do not claim a retry was exercised when only source code was inspected.

## Why it matters

A lost response does not mean the operation failed. Retrying can duplicate writes, charges, messages or other work.

## Exceptions

Do not require idempotency infrastructure for every API. Read-only operations, harmless repeated effects and operations without a realistic retry path may not need it. Judge the actual consequence and supported contract.
