# Live review publication check

## Change

PR reviews maintain one progress comment per run and publish the canonical report at completion. The parent verifies findings and an editorial subagent reduces prose. Local-only and staged-output requests override automatic publication. GitHub mechanics live in a Python helper rather than the main skill.

## Validation

- `python3 -m unittest discover -s skills/review/scripts -p 'test_*.py' -v`: 17 tests passed using a fake `gh` backend.
- Both changed skills passed the skill-creator validator. Main skill and wrapper links resolved. `git diff --check` passed.
- Independent read-only workflow pass covered a small PR with new and existing concerns, a local-only branch review, a split-only review, editorial loss of uncertainty and requested staging. It found setup ordering and staging precedence gaps. Both were corrected and the follow-up pass confirmed resolution.

An independent helper review found literal HTML examples being mistaken for folds during splitting. This was corrected and covered by regression tests. A further regression checks that interrupting a failed final publication keeps its checkbox unchecked.

The tests cover resumed and distinct runs, lost comment and review responses, partial final publication, foreign pending reviews, changed heads, no findings, dry runs, interruptions, immutable retry inputs and oversized reports. Split reports reconstruct the original content and preserve complete tables, folds and fences.

## Limits

No live GitHub writes or full production PR review were performed. The fake backend checks lifecycle behaviour, not GitHub rendering or authorisation. One writer must own each state file. If a single Markdown block exceeds the comment budget, the helper reports it for editorial restructuring rather than truncating it. A changed PR head conservatively withholds automatic inline comments while preserving the original revision's findings in the report.
