---
name: PR description skill evaluation
description: >-
  Internal evidence for reviewer-focused formatting guidance and a trial rewrite
  of Picco PR 78.
created: '2026-10-28T17:05:44.483Z'
updated: '2026-10-28T17:06:10.006Z'
---
# PR description skill evaluation

Updated `skills/writing-pull-request-description/SKILL.md` to require reviewer-focused headings and short change bullets for multi-part descriptions, with optional concrete examples and risks.

## Evidence from supplied PRs

- Skills #4: prototype results distract from this PR; the baseline dependency appears last.
- Picco #78: rationale is present, but reservations, receipts, schemas and routing are mixed into dense paragraphs.
- Picco #77: the usage snippet helps, but adapter behaviour, safeguards, testing and exclusions need separation.
- Picco #76: branch logistics precede motivation; one paragraph combines the feature, API and failure handling.

The research agent fetched all four bodies with GitHub CLI. No linked PR was edited.

## Trial draft for Picco #78

The test agent read the revised skill, fetched the PR body and diff, and returned this draft. Its validation figures are attributed to the original PR, not independently verified by this session.

---

Preserves keyed notification messages across restarts so progress updates edit the original message instead of creating duplicates.

Depends on #75, which adds scoped, editable broadcast notifications.

### Why

Keyed messages currently lose their provider IDs when the plugin stops. Persisting those IDs lets an agent resume updates after restarting.

### What changed

- **Persistent identity**: Stores recipient identities, provider message IDs and content hashes in SQLite, without message text or credentials.
- **Duplicate protection**: Reserves writes before contacting providers and rejects stale concurrent reservations. Uncertain attempts remain blocked rather than automatically sending again.
- **Storage limits**: Handles aren’t expired or evicted; new messages are refused at capacity until deliberate operator maintenance.

Preserve `messages.sqlite` when restarting or moving an agent. Receipt lookup remains process-local, and no reconciliation command is provided.

### Example

Send keyed progress → restart with the same database and recipient bindings → send changed progress with the same scope and key → edit the original message.

### Validation

- Original PR reports `pnpm validate` passed build, formatting, types, lint, 628 unit tests and 27 integration tests. Not rerun for this draft.
- Added tests cover restart updates, crash-left reservations, concurrent connections, capacity and failed confirmation writes.
- Reported adapter checks used stubbed external transports; live delivery remains unverified.

## Assessment and limits

- The draft exposes the rationale, three main changes, dependency, behaviour and validation without dense paragraphs or oversized bullets.
- Opening and Why overlap slightly, but Why adds the specific cause. The behavioural example shows a useful sequence without inventing API code.
- Operator maintenance and process-local lookup would fit better under the skill’s optional risks and limitations heading. The draft is useful evidence, not proof of perfect compliance.
- The test identified ambiguity about inherited test results. Added an explicit instruction to attribute results taken from existing PRs or CI rather than implying they were rerun.
- `git diff --check` passed. No skill-creator validator was found in the installed skill directories searched.
- This was one qualitative drafting trial, not an automated behavioural test suite. No Picco tests were run and no GitHub bodies were changed.
