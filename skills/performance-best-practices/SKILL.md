---
name: performance-best-practices
description: Write, refactor, or review code affecting latency-sensitive paths, repeated work, resource growth, concurrency, or lifecycle cleanup using concrete workload evidence.
---

# Performance

## Goal

Prevent demonstrated performance and resource-lifecycle problems. Avoid speculative optimisation and preserve behaviour.

## Checklist

Track checks in task notes, not here. Mark done only after verifying; explain N/A and report blocked or unverified checks. Run independent checks in parallel where useful.

**Evidence and repeated work**

- [ ] **Workload target** - Establish the affected workload and required performance.
- [ ] **Cost evidence** - Support findings with measurements or a concrete execution path.
- [ ] **Repeated work** - Establish frequency and cost for duplicate requests or expensive calculations.
- [ ] **Success-path repeats** - Confirm expensive work repeats after success before raising severity.
- [ ] **Algorithm cost** - Check unnecessary complexity; prefer greedy approaches and native loops where suitable.
- [ ] **Array passes** - Prefer flatMap over filter followed by map.
- [ ] **Cache behaviour** - Preserve freshness, cancellation, and failures when caching or batching.
- [ ] **Query growth** - Inspect changed queries against plans and expected data volume.
- [ ] **Index benefit** - Demonstrate filtering, ordering, or lookup cost before adding indexes.

**Resources and concurrency**

- [ ] **Bounded growth** - Verify bounded buffers, caches, queues, and parallel work across inputs and lifetimes.
- [ ] **Blocking work** - Identify synchronous work blocking a latency-sensitive event loop.
- [ ] **Concurrency benefit** - Show sequential independent work causes relevant delay before parallelising.
- [ ] **Task coordination** - Preserve failures, required ordering, and resource limits.

**Lifecycle**

- [ ] **Owner cleanup** - Stop or release timers, subscriptions, and background work when owners end.
- [ ] **Expected shutdown** - Check background work does not prevent shutdown.
- [ ] **Polling replacement** - Demonstrate polling cost and a behaviour-preserving event alternative.

## Guidance

### Evidence and repeated work

- Trace the affected execution path and its workload. Compare observed or expected cost with the required performance; another approach might be faster, but that alone is not enough evidence.

  ```typescript
  const durationMs: number[] = [];
  for (const input of representativeInputs) {
    const startedAt = performance.now();
    await loadReport(input);
    durationMs.push(performance.now() - startedAt);
  }
  ```

- For retry loops, distinguish cheap settling or status checks from encoding, GPU uploads, subscriptions, and fetches. Cheap retries are not P1. Reserve P1 for expensive work repeated after success or incorrect success-path logic; rare empty/error retries remain P2.
- Check algorithmic complexity against input growth. Prefer a greedy approach over repeated passes where it solves the same problem, and native `for` loops where suitable. Prefer `flatMap` over `filter().map()` as a code-style preference; support performance claims with workload evidence.

- Follow repeated work back to its logical input. Establish request or computation frequency before proposing caching or batching, then trace freshness, cancellation, and failures through the proposed change.
- For growing data sets, inspect the query plan and expected volume. Tie an index recommendation to the filtering, ordering, or lookup operation it improves rather than recommending an index for every query.

### Resources and concurrency

- Trace how buffers, caches, queues, and parallel tasks grow and drain. Identify inputs or lifetimes that could exhaust resources; account for item count and memory size.
- Find blocking synchronous work on a latency-sensitive event loop before recommending asynchronous I/O, yielding, or offloading.
- Compare sequential cost with the relevant latency requirement. Before changing task coordination, identify independent work, required ordering, failure propagation, and available resource limits.

### Lifecycle

- Follow timers, subscriptions, and background tasks from creation through cleanup. Look for retained resources, work surviving its owner, and work preventing shutdown. Register returned cleanup with its owner; clearing a timer does not cancel work already started.


- Compare polling frequency and duplicate work with an available event mechanism. Preserve the required update and failure behaviour when recommending replacement.
