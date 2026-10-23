# Bounds and conversions

- Check the relationship between independently derived indices, searches, and bounds, even when each is valid alone. Clamp at the composition site; current caller behaviour is not the helper's contract.

  ```typescript
  // Bad: valid indices can produce a negative length and throw.
  const uncheckedOutput = new Float64Array(endIndex - startIndex);

  // Good: clamp both bounds and preserve their order before allocation.
  const start = Math.max(0, Math.min(startIndex, values.length));
  const end = Math.max(start, Math.min(endIndex, values.length));
  const output = new Float64Array(end - start);
  ```

- Do not express exclusive ends, strictly-after checks, or next-tick semantics as the current storage quantum plus one. Use an exact lookup followed by an equality or ordering check; storage precision is not a domain guarantee.
- Read actual first and last values from the data. A query window or declared range can extend beyond the available values.
- For repeated A → B → C conversions, look for or add an A → C primitive on the owning type. Keep conversion details out of callers.
