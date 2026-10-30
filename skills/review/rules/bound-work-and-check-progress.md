# Bound work and check that loops advance

## When to check

The change reads repeated chunks, handles large requests, retains buffers or starts work for many items at once.

## What to check

- Trace request size, item count, concurrency and retained memory. Apply limits before allocating or buffering the full input. Check that limits hold across repeated requests, not only one small example.
- Check that every loop advances or stops. Establish what zero-byte reads, empty pages or unchanged cursors mean. Stop, wait or fail according to the API instead of spinning without progress.
- Release buffers, subscriptions and requests when work finishes, fails or is cancelled. A count limit does not bound memory when each item can be arbitrarily large.
- Report the input and path that can exceed a limit or get stuck. Do not call an operation bounded because a comment or helper name says it is.

## Why it matters

A large input or a loop that never advances can exhaust memory, block other work or keep retrying forever.

## Exceptions

A deliberate streaming operation may have no total byte limit if buffering, concurrency and cancellation are bounded. A zero-byte read need not mean end of input for every API. Check its contract and use the appropriate wait or stopping condition.

## Good and bad examples

Assume `maxBytes` is already a validated, bounded positive integer. This reader returns zero at end of input. Its count must be between zero and the supplied buffer length.

```typescript
type Reader = { read(target: Uint8Array): Promise<number> };

// Bad: a zero-byte read leaves the loop spinning at the same total.
async function readBefore(reader: Reader, maxBytes: number): Promise<number> {
  let total = 0;
  while (total < maxBytes) {
    total += await reader.read(new Uint8Array(4096));
  }
  return total;
}

// Good: reuse a bounded buffer, limit the last read and stop at end of input.
async function readAtMost(reader: Reader, maxBytes: number): Promise<number> {
  const buffer = new Uint8Array(Math.min(4096, maxBytes));
  let total = 0;
  while (total < maxBytes) {
    const target = buffer.subarray(0, Math.min(buffer.length, maxBytes - total));
    const count = await reader.read(target);
    if (count < 0 || count > target.length) {
      throw new Error("Invalid read count");
    }
    if (count === 0) {
      break;
    }
    total += count;
  }
  return total;
}
```

This reads at most the limit. It does not prove that the whole input was read or replace validation at the request boundary.
