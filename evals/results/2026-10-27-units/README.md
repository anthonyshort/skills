# Unit evals — 27 October 2026

The first run of the unit evals after splitting the review skill. Research and the coordinator are out of scope for now. Each run is a single trial with `claude -p`.

## Current skills

46 of 52 unit cases pass.

| Unit | Passed | Failures |
| --- | --- | --- |
| review-risk | 4/4 | None, after fixing the translation fixture. |
| review-guidance | 3/4 | `http-route`: skipped the typescript skill, arguing a one-line guard needs no TypeScript guidance. The skill says to select a skill when the change uses its technology. |
| review-assess | 19/20 | `order-placement-calls-every-consumer`: an ambiguous criterion that two gradings read differently. The criterion has since been made precise. |
| review-rules | 20/21 | `access-wrapper`: `rules.md` used shortened rule names and no file names, but the skill asks for "Name and file". |
| review-report | 0/3 | Every report met its criteria, but none ran the editorial subagent the skill requires. |

No unit run launched a subagent where its skill asked for one. The coordinator runs showed the same pattern.

## Is each unit's eval sensitive to regressions?

Two broken copies of the skills were used.

**Bad standards on controls.** Adding standards that condemn good code made all 8 controls fail, as expected.

**Contradicting instructions on problem cases.** One line was added to each unit telling it to skip its work, such as "do not open the rule files, mark every rule satisfied". The reviewer mostly refused. It pointed out the contradiction with the rest of the skill and followed the original instructions. Only 16 of 44 cases failed. This shows the reviewer resists contradictory edits. It doesn't show whether the cases would catch a real regression.

The next check should remove guidance instead of contradicting it, for example deleting rule files, the report template or a best-practice skill.

## What the assess cases can and can't show

Before the split, a minimal "review this change" skill found the planted problem in every assessment case. These cases confirm the unit produces correct assessments. They don't show that the unit's guidance is what finds the problems. That needs harder cases that a minimal skill fails.

## Harness and case fixes from this run

- Reads through relative paths, shell loops and globs are now counted.
- The grader is retried once when it returns no JSON or skips a criterion.
- Tool denials are recorded, not failed.
- The coordinator's stubs were rewritten because the coordinator changed behaviour when it saw obvious stubs.
- Fixed the translation fixture and two over-broad criteria.
- Grading isn't fully consistent. One report passed one grading and failed the next on an ambiguous criterion.
