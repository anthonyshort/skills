# Performance and resources

## Workload and repeated work

- Establish the affected workload and required performance. Support findings with measurements or a concrete execution path. Another approach being theoretically faster is not enough.
- Trace repeated requests or computations to their logical inputs. Establish frequency and cost before proposing caching or batching. Distinguish cheap status checks from expensive encoding, uploads, subscriptions or fetches. Check whether expensive work repeats after success.
- Check algorithm cost against expected input growth. Prefer a simpler single-pass or greedy approach only when it preserves the required result. Use native loops where they improve clarity or address a demonstrated cost.
- Prefer `flatMap` over `filter().map()` when it expresses the same operation clearly. Treat this as a style preference. Make performance claims only with workload evidence.
- When caching or batching, trace freshness, cancellation and failure behaviour through the proposed change.

## Resources and concurrency

- Trace how buffers, caches, queues and parallel tasks grow and drain. Consider both item count and memory size across inputs and lifetimes.
- Identify synchronous work blocking a latency-sensitive event loop before recommending asynchronous I/O, yielding or offloading.
- Before parallelising, show that sequential independent work causes relevant delay. Preserve required ordering, failure handling and resource limits.

## Background work and cleanup

- Follow timers, subscriptions and background tasks from creation through cleanup. Check for retained resources, work surviving its owner and work preventing expected shutdown.
- Register returned cleanup with its owner. Clearing a timer does not cancel work already started.
- Before replacing polling, compare its frequency and cost with an available event mechanism. Preserve required update and failure behaviour.
