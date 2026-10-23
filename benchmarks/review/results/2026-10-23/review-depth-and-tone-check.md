# Review depth and tone check — 23 October 2026

A separate agent checked the updated instructions and rewrote both local review previews. The parent checked the results. This was a wording and workflow exercise, not a fresh PR review.

| Case | Result |
| --- | --- |
| 12,867 or 2,001 meaningful added lines | Stop at a split plan before broad research, question agents or rules. |
| Exactly 2,000 added lines | No automatic gate. Assess size and risk normally. |
| Generated bulk with a small remaining change | A full review can be justified. Explain the exception. |
| Generic request to review a large PR | Does not override the split-only default. |
| Missing CI | Continue source inspection. No dependency installs or local validation. |
| Split-only reporting | Omit unperformed implementation and rule coverage. Publishing remains separately authorised. |

The previews use short requests and concrete outcomes. One sentence equated unused helpers with safe preparation. It was corrected to require no change to existing behaviour.

Original drafts and reports remain unchanged. Revised previews are in each review's temporary directory as `github-review-draft-v2.md`. They retain historical evidence and state that CI was not refreshed. Nothing was published.

The review, split-pr and writing-voice skills passed metadata validation. Local links and whitespace were checked. No new project commands or live CI checks were run.
