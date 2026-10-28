---
name: PR 77 description publication evidence
description: Internal sources and publication verification for picco PR 77
created: '2026-10-28T17:22:04.090Z'
project: picco
updated: '2026-10-28T17:23:01.451Z'
---
Internal evidence for https://github.com/anthonyshort/picco/pull/77.

- Read writing-pull-request-description and communication skills in full from the current repository.
- Fresh metadata: `/tmp/pr-description-subagents/picco-77/original-metadata.json`.
- Full current diff: `/tmp/pr-description-subagents/picco-77/current.diff`. Behaviour grounded in `packages/plugin-github/src/notification.ts` and `notification.test.ts`.
- No applicable PR template found in recursive trees for main or actual base branch; path listings saved beside metadata.
- Dependency confirmed by `/tmp/pr-description-subagents/picco-77/dependency.json`: PR 75 is open and its head matches PR 77’s base.
- Published final body: `/tmp/pr-description-subagents/picco-77/final-body.md`.
- No product tests or live-provider checks run. Description proposes one remaining manual live-token check.
- Advisor reviewed saved draft before publication.
- Pre-publication metadata matched original exactly, including body and head SHA: `/tmp/pr-description-subagents/picco-77/pre-publication-metadata.json`.
- Published only the body using `gh pr edit 77 --repo anthonyshort/picco --body-file /tmp/pr-description-subagents/picco-77/final-body.md`.
- Verification passed: remote body exactly matches saved final body; title, base/head refs, head SHA, state and draft status unchanged. Snapshot: `/tmp/pr-description-subagents/picco-77/verification-snapshot.json`.
