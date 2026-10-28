---
name: address-pr-feedback
description: Address review feedback on a PR. Use when asked to apply reviewer comments, respond to review feedback, or work through a list of review notes on a change.
---

# Address PR feedback

Work through review comments on a PR: research first, triage, then apply changes under explicit size and risk rules. The work is tracked in a live progress comment on the PR, which ends with a summary of the work. There is no separate presentation step. You read the progress comment.

## Rules

- Default to delegating code changes to a subagent. The parent session gathers context, triages, coordinates and reports. Apply a trivial one-line fix directly when a subagent is unavailable.
- Read the PR description, diff and CI before triaging. Judge each comment against what the change is trying to do, so fixes stay appropriately sized.
- Not every comment is valid. Classify invalid, already addressed, duplicate and out-of-scope feedback as such, with the evidence behind the call.
- Apply the fixes the triage judges worth doing, without confirmation. You can redirect the work separately if you want to.
- Skip low-risk or low-impact issues whose fix is disproportionately large. Leave a note in the summary.
- Post the progress comment and its final summary without asking. It records work already done, and commits preserve a record of the code changes.
- Add a thumbs-up reaction to addressed inline comments instead of replying. Reactions are added after the push.
- Do not resolve review threads automatically.
- Keep the progress comment current. Update the comment before starting a stage (mark it active) and after completing it (mark it complete with evidence), using [the helper](scripts/progress.py).
- If publishing the comment or its summary fails, continue the local work, preserve the intended summary, and report the publication failure to the user. The helper saves intended changes before publishing, so a failed publication can be retried with `python3 scripts/progress.py sync --state <file>`.

## Workflow

The checklist has one entry per stage: `Gathering context`, `Reading feedback`, `Deciding on changes`, `Applying changes`, `Verifying and committing`. Reactions to inline comments happen after finalisation and are not a checklist stage.

### 1. Gather context

Resolve `scripts/progress.py` relative to this skill's directory, not the target repository. Create the progress comment: `python3 scripts/progress.py start --pr <number>`. The helper prints the state file path; pass it to every later call via `--state`. To resume an existing run, pass its state file without `--pr`: `python3 scripts/progress.py start --state <file>`. Adapt the checklist items to the actual work when the stages differ.

Mark `Gathering context` active, then read the PR description, the diff, the changed files and CI. Mark it complete with the evidence: PR description, diff and CI read.

Mark `Reading feedback` active, then read every review comment, inline and general. Mark it complete with the evidence: every inline and general comment read. Understand what the change does before judging the feedback.

For example:

    python3 scripts/progress.py update --state <file> --active "Gathering context"
    python3 scripts/progress.py update --state <file> --complete "Gathering context" --evidence "PR description, diff and CI read"

When a stage is skipped or blocked, record it instead:

    python3 scripts/progress.py update --state <file> --skip "Applying changes" --reason "no valid fixes"
    python3 scripts/progress.py update --state <file> --block "Verifying and committing" --reason "CI is failing"

### 2. Triage

Mark `Deciding on changes` active before triaging. For each comment, classify it and estimate the size of the fix:

| Classification | When | Action |
| --- | --- | --- |
| Apply | Aligned with the PR's intent and worth the effort | Apply via subagent |
| Skip | Low-risk or low-impact issue with a disproportionately large fix | Note it in the summary |
| Dismiss | Invalid, already addressed, duplicate or out of scope | Note the evidence in the summary |

When a comment is borderline:

- Default to skipping disproportionate low-impact fixes.
- Proceed with clear, small fixes.
- Judge large fixes on whether they are worth the effort for their impact.

Estimate size per coherent fix, counting additions and deletions together. A coherent fix addresses one underlying issue, which may cover several related comments. Do not bundle unrelated issues into one estimate. A fix over 200 lines of changed code is significant. Judge whether it is worth the effort for the impact it has. If a fix grows past its estimate, pause the subagent and re-estimate. Mark `Deciding on changes` complete with the evidence: all comments classified.

### 3. Apply

Delegate changes to a subagent, one coherent change at a time. Give the subagent the PR description, the relevant diff and the comment it is addressing. It must read the surrounding code before editing, so the change fits the PR's intent and stays appropriately sized.

Tell the subagent explicitly:

- **Scope:** the change's scope and its size limit.
- **Checks:** the focused checks (tests, typechecks) to run for the change.
- **Publication:** no posting to the PR or reacting to comments. That stays with the parent session.

The rules still apply mid-work. Mark `Applying changes` complete with the evidence: applied diff inspected.

### 4. Verify and commit

The worker runs focused checks for each change. The parent inspects the actual diff and runs the focused checks itself before accepting — a subagent's "verified" is not evidence, since it may not have run them. Do not report a fix as done on the worker's word alone.

Before running checks, match the repo's pinned runtime (`.mise.toml`, `.nvmrc`, `package.json` engines) and build the workspace dependencies the checks need (e.g. `turbo run build:js`/`build:types` in a monorepo). A monorepo's tests may not resolve until its dependency graph is built.

Commit and push the verified, task-only changes. Before committing and pushing: verify the checkout is based on the PR's head, preserve unrelated changes, and stage only this task's files. The local branch may differ from the PR's head branch (a worktree prefix, for example), so push to the PR's head branch explicitly (`git push origin HEAD:<head-branch>`). Do not force-push. If checks or pushing fail, report the blocker in the summary without claiming the PR contains the fix. Mark `Verifying and committing` complete with the evidence: checks run, diff inspected, commit pushed.

### 5. Post the summary

Write the feedback summary following [the template](templates/feedback-summary.md), then finalise the progress comment: `python3 scripts/progress.py finish --state <file> --summary <file>`. The helper preserves completed, skipped and blocked outcomes, then appends the summary below the checklist. Post it without asking. The summary describes applied work. Report the comment URL in the final message to the user.

### 6. React to inline comments

Reactions happen after finalisation and after the push. Add a thumbs-up reaction to each inline comment that was addressed (applied fixes only; dismissed comments are explained in the summary, not reacted to):

    gh api repos/<owner>/<repo>/pulls/comments/<comment_id>/reactions -f content=+1

Inline review comments use the `pulls/comments` endpoint; a general comment on the PR body uses `issues/comments`. A reaction acknowledges the comment without a reply.
