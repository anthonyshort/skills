# Blind review benchmark — 22 October 2026

The review found all four seeded bugs. It raised no unsupported defects on the four control cases. Both valid design exceptions were respected.

| Measure | Result |
| --- | --- |
| Seeded bugs found | 4/4 |
| Unsupported defects on control cases | 0/4 cases |
| Valid exceptions respected | 2/2 |
| Rules screened | 17 across 8 cases |
| Applicable rule decisions | 31: 27 satisfied, 4 concerns |
| Inapplicable rule decisions | 105, each with a reason |
| Skills loaded | Main review plus 4 best-practice skills |
| TypeScript references loaded | 7, with scoped exclusions recorded |
| Recorded review time | 12 minutes 25 seconds |
| Token usage | Unavailable |

The four rule concerns overlap existing findings. They are not four additional bugs.

## What it found

| Case | Expected outcome | Actual finding | Report |
| --- | --- | --- | --- |
| A01 | Bug | Detached method loses its receiver and retry throws. | [A01](reports/A01-review-report.md) |
| A02 | Bug | Keyboard clearing leaves the cart open. | [A02](reports/A02-review-report.md) |
| A03 | Bug | Mean counts distinct values. The passing test expects the same wrong answer. | [A03](reports/A03-review-report.md) |
| A04 | Bug | The action mutates the original object rather than the observed Valtio proxy. | [A04](reports/A04-review-report.md) |
| A05 | Clean | Ordered setup, rollback and idempotent disposal accepted. | [A05](reports/A05-review-report.md) |
| A06 | Clean | Bounded parser accepted without demanding a new schema dependency. | [A06](reports/A06-review-report.md) |
| A07 | Valid exception | Historical total accepted as an intentional saved value. | [A07](reports/A07-review-report.md) |
| A08 | Valid exception | Thin wrapper retained because it enforces authorisation. | [A08](reports/A08-review-report.md) |

The parent checked the final finding text against the hidden key. Each bug names the triggering input or action, observable consequence, exact source location and local correction. Severity P1 fits the explicit success-path failures. The mean bug and its incorrect test are one finding.

All eight expected outcomes were independently reproduced before review. A separate fresh build reproduced them again. The reviewer independently devised its own probes from the supplied specifications. It did not receive the scoring key or expected distribution.

## What was checked

Loaded best-practice skills were TypeScript, testing, Valtio and error handling. The main review supplied the five assessment questions. The rule worker screened all 17 general rules and read the selected rules in full.

- [Actual skills, references, tasks and timing](usage.json).
- [Guidance content hashes](guidance-versions.json).
- [Findings, exact base/head revisions and case-level guidance use](findings.json).
- [Every rule selection, outcome and reason](rules.json).
- [Research](worker-assessments/research.md), [product](worker-assessments/product.md), [system fit](worker-assessments/system-fit.md), [simplicity](worker-assessments/simplicity.md), [readability](worker-assessments/readability.md), [correctness](worker-assessments/correctness.md) and [rules](worker-assessments/rules.md).
- [Reviewer runtime probes](independent-checks.mjs) and [results](runtime-results.json).
- [Separate notification diagnostic](A04-observation.mjs) and [output](A04-observation.json).
- [Machine-readable score and limits](score.json).

Standalone case reports include their generated checklists and coverage. Source inspection, runtime execution, skipped checks and unavailable tools remain distinct.

## What needs attention

- **Overhead:** Seven sequential worker tasks took roughly 12 minutes for eight tiny changes. The session agent limit forced one worker to be reused.
- **Repetition:** The reports repeat similar question and rule evidence. A shared coverage matrix would be easier to scan in a batched run.
- **Report QA:** The parent reminded the coordinator to add finding IDs and expose counts and verification gaps. These formatting requirements were not met on the first draft.
- **Evidence preservation:** The shared Valtio probe stops at a failed count assertion. The parent requested the separate notification measurement be saved so its evidence was independently inspectable.
- **Harness accuracy:** An initial reviewer probe mixed CJS and ESM Valtio instances. The reviewer corrected it and discarded that harness result.

No skill instructions were changed based on this run.

## Limits

This was one batched workflow with shared research and worker context. It was not eight independent end-to-end reviews. The reviewer was blind to expected answers, but it received parent QA reminders about report structure and evidence preservation.

These are small synthetic fixtures. The result does not establish production PR recall, repeatability or resistance to false positives on complex changes. Most rule/case combinations were inapplicable. Further cases should exercise those rules directly.

External research, browser testing, the Galaxy wrapper and GitHub publishing were excluded. There was no configured typecheck, lint, formatter or CI suite. No source edits or reviews were published.

Fixtures were built by [build.py](../../build.py). The exact reviewed revisions are in findings.json. Rebuilding creates new repositories and revision IDs. Runtime scripts retain the original temporary input paths. Timing excludes initial instruction reads and parent scoring. The run crossed midnight UTC but occurred on 22 October in Los Angeles.
