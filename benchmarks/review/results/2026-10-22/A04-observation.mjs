// Persisted from the separate coordinator diagnostic already executed during review.
const { counter, increment } = await import('/tmp/review-benchmark-inputs/A04/service.ts');
const { subscribe } = await import('/tmp/review-benchmark-inputs/A04/node_modules/valtio/esm/vanilla.mjs');
let notifications = 0;
const stop = subscribe(counter, () => notifications++, true);
const before = counter.count;
increment();
console.log(JSON.stringify({ before, after: counter.count, notifications }));
stop();
