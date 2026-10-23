# Review benchmark

Eight small TypeScript changes test bug detection and false positives. The set includes four seeded defects, two clean changes and two valid design exceptions. This is a controlled benchmark, not a substitute for large real-world PR reviews.

## Build and verify

Use Node 24 or another version with TypeScript stripping support. Install the fixture's pinned dependency in a temporary directory:

```sh
npm install --prefix /tmp/review-benchmark-deps --ignore-scripts --no-audit --no-fund valtio@1.13.2
python benchmarks/review/build.py \
  --inputs /tmp/review-benchmark-inputs \
  --key /tmp/review-benchmark-private/key.json \
  --node-modules /tmp/review-benchmark-deps/node_modules
python benchmarks/review/check_oracles.py \
  --key /tmp/review-benchmark-private/key.json \
  --node-modules /tmp/review-benchmark-deps/node_modules
```

Use fresh paths for a new run. Each input is a local Git repository with pinned base/head revisions, requirements and source. The scoring key and independent assertions live outside the input directory. One case deliberately has a passing test with the wrong expected result.

## Blind review

Give the reviewing agent only:

- The input `manifest.json` and case repositories.
- The review skill's path.
- A fresh output directory.

Forbid access to this builder, the scoring key and oracle results. Shared filesystem access means this is an instruction boundary, not a security sandbox.

Run the review without publishing or external PR research. Every case is a self-contained local change. Preserve generated checks, actual skill use, rule selections, evidence and execution limits.

For a batched run, the coordinator can delegate research across all cases, then one task per review question across the cases, followed by one combined rule pass. Disclose shared context. Do not call this eight independent end-to-end runs.

## Score after the review

Compare final findings with the hidden key only after the reviewer has finished.

Record:

- Seeded bugs found and missed, supported by the actual finding text.
- Unsupported defects raised on clean and exception cases.
- Whether valid exceptions were respected.
- Whether evidence supports each trigger and consequence.
- Actionability and severity of recommendations.
- Checklist and rule coverage, including blocked checks.
- Wall time and token usage only when actually available.

An optional suggestion is not automatically a false-positive bug. Judge any additional unseeded finding on its evidence rather than rejecting it because it is absent from the key. Do not match findings by keywords alone.

## Limits

Small fixtures make specific failure modes easy to reproduce. They do not test external research quality, browser interactions, Galaxy integration, PR-thread handling or GitHub publishing.

A repeated run can measure stability, but keep its reviewers isolated from earlier results and the scoring key. Add historical production changes later with subsequent fixes and discussion hidden from reviewers.

## Recorded runs

- [22 October 2026: eight-case blind benchmark](results/2026-10-22/README.md).
