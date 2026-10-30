# Keep time values and units clear

## When to check

The change compares, stores or converts timestamps, durations, time ranges or positions on a timeline.

## What to check

- Find what each number means and its unit. Keep an absolute timestamp separate from elapsed time and an offset from a display origin. Check each conversion before comparing or combining values.
- Follow the value from its source through storage, calculations and display. Names or types should make seconds, milliseconds and other units clear at the calls that matter.
- Check the start and end of ranges, especially adjacent ranges, zero-length ranges and negative offsets where supported. Establish whether each end is included rather than assuming a convention.
- When dates or timezones are involved, preserve the intended instant or calendar day. A display timezone change must not silently change a duration or stored timestamp.

## Why it matters

Two numbers can both represent time while meaning different things. Mixing them can move an event, show the wrong duration or include a point in two ranges.

## Exceptions

Relative positions and fixed timezones can be correct for a feature. Use its actual requirements. Do not require new wrapper types or a move to absolute time when names and existing types already make the calculation clear.

## Good and bad examples

Assume the clock returns milliseconds and the stored start is in seconds.

```typescript
// Bad: subtracts seconds from milliseconds.
function elapsedBefore(nowMilliseconds: number, startedSeconds: number): number {
  return nowMilliseconds - startedSeconds;
}

// Good: convert before subtracting, and name the returned unit.
function elapsedMilliseconds(nowMilliseconds: number, startedSeconds: number): number {
  return nowMilliseconds - startedSeconds * 1000;
}
```

For adjacent ranges with an excluded end, a point at the shared edge belongs only to the next range:

```typescript
function containsTime(time: number, start: number, end: number): boolean {
  return time >= start && time < end;
}
```

An included end is also valid when required. Check that the callers agree on that choice and use the same unit for all three values.
