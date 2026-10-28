---
name: PR 76 description publication evidence
description: >-
  Internal evidence and verification for the Telegram notification PR body
  rewrite
created: '2026-10-28T17:22:38.352Z'
updated: '2026-10-28T17:23:20.039Z'
---
# Evidence

Assigned body only: https://github.com/anthonyshort/picco/pull/76.

Read the current writing-pull-request-description and communication skills in full. Independently inspected the full current diff, saved as `/tmp/pr-description-subagents/picco-76/full.diff`. Original metadata is `original-metadata.json` in that directory; head is `5b16d484321902edb0402b128eca608a1127811f`.

Checked #75 fresh metadata (`dependency-75.json`) and read notification `types.ts` and `messages.ts` at #76’s exact head. These confirm scoped message-key calls, uncertain results for adapter throws, and in-memory message tracking. Diff confirms Telegram update behaviour and error mapping. No PR template found in the actual base tree; owner default `.github` repository returns 404.

Final published body: `/tmp/pr-description-subagents/picco-76/final-body.md`.

# Verification

Fetched `pre-publication-metadata.json` immediately before publication and compared it with original metadata: all fields, including original body and head SHA, matched. Published only the body with the requested `gh pr edit 76 --repo anthonyshort/picco --body-file` command.

Fetched `verification-metadata.json`: remote body exactly matches the saved body file. Title, head/base branches, state, draft flag, head SHA and URL are unchanged from the pre-publication snapshot. Verification passed.

No product tests or live-provider checks run. No repository source files or skills changed.
