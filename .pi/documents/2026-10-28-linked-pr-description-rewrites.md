---
name: Linked PR description rewrites
description: >-
  Internal publication record for reviewer-focused rewrites of skills PR 4 and
  Picco PRs 76–78.
created: '2026-10-28T17:12:16.095Z'
updated: '2026-10-28T17:14:46.988Z'
---
# Linked PR description rewrites

The user authorised updating these PR bodies. All four were updated and verified against the saved drafts:

- https://github.com/anthonyshort/skills/pull/4
- https://github.com/anthonyshort/picco/pull/76
- https://github.com/anthonyshort/picco/pull/77
- https://github.com/anthonyshort/picco/pull/78

## Evidence and review

Independent drafting agents fetched each original description, metadata and full diff and checked repository templates. No template was found in the branches they inspected. Payloads and original metadata are saved under `/tmp/pr-description-rewrites/{skills-4,picco-76,picco-77,picco-78}/` as `body.md`, `original.json` and `diff.patch`.

Parent review checked all payloads and originals, the complete Telegram adapter diff, and targeted GitHub adapter, persistence and workflow-contract evidence. Adjustments simplified the skills wording, added the known missing standalone end-to-end check, retained the GitHub consumer configuration example, and clarified Telegram’s unchanged sends and process-local tracking.

## Final descriptions

Each starts with what changes and why, followed by focused change bullets. Dependencies appear near the top. Examples and limitations are retained where useful. Completed-test summaries and unrelated prototype results were removed.

Outstanding validation is actionable:

- Skills #4: standalone review of a known diff with extracted guidance, confirming stages, rules and evidence-backed reporting without an external workflow.
- Picco #76: real Telegram send, changed-text update and repeated-text update, confirming one message and successful updates.
- Picco #77: real GitHub comment send and update, confirming the same comment changes.
- Picco #78: keyed broadcast across restart with preserved database/bindings, confirming the original message is edited without duplicates.

## Publication checks

`/tmp/pr-description-rewrites/publish.py` compared current GitHub bodies, titles and base/head branch names with original metadata before each edit. All matched. It then updated only bodies using `gh pr edit --body-file` and fetched each PR again.

All four remote bodies match the saved drafts. Titles, base/head branches, open/closed state and draft status were unchanged during publication. Verified snapshots are saved as `verified.json` in each payload directory.

No product tests or live-provider checks were run as part of rewriting descriptions. Validation checkboxes describe outstanding work, not completed checks.
