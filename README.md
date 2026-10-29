# Skills

Personal agent skills for Codex, Pi and Claude Code. The initial collection contains
15 code-quality skills and `writing-voice`, extracted from `anthonyshort/pi-config`,
plus the `review-nominal-galaxy` profile migrated from pi-config.

## Layout

Workflow skills live at `skills/<name>/SKILL.md`. Best-practice skills live at
`skills/best-practices/<topic>/SKILL.md` with standard `name` and `description`
YAML frontmatter. References and assets stay inside their owning skill. Related
skills use relative links; install the whole collection to retain those links.

```text
skills/
  review/SKILL.md
  review/references/
  review/templates/
  best-practices/react/SKILL.md
  writing-voice/SKILL.md
  ...
package.json
scripts/link.py
src/review/
workflows/review.js  # generated from TypeScript
```

The `pi` manifest exports the skills and an opt-in review workflow. The ordinary review skill uses equivalent agents or its documented fallback when named agents are unavailable. The personal GitHub review attribution remains `Sent with Pi` on all agents.

## Review workflow for Pi

The experimental named `review` workflow runs the required assessments in an existing Pi session and returns the report, approval assessment and accepted evidence in memory. GitHub publication requires the separate [Picco GitHub plugin](https://github.com/anthonyshort/picco/tree/main/packages/plugin-github/src) to expose `github_comment` for progress and `github_review` for the final report and inline findings. Missing tools are reported as publication failures while the accepted report remains available. The original review skill remains unchanged.

Install this package and `@tintinweb/pi-subagents@0.22.0` in Pi, enable package workflow discovery and reload. Invoke `SubagentWorkflow` with:

```json
{
  "name": "review",
  "args": {
    "packageRoot": "/home/me/dev/skills",
    "repository": "/home/me/dev/app",
    "target": "owner/app PR #42",
    "base": "FULL_BASE_COMMIT_SHA",
    "head": "FULL_HEAD_COMMIT_SHA",
    "runId": "app-pr42-review",
    "publication": "local-only"
  }
}
```

Use a clean checkout at the pinned head. `local-only` suppresses external updates. To enable them, use `publication: "publish"` and supply `github: { "repository": "owner/app", "pr": 42 }`. Host notifications use the configured host tools and default to the key `review:RUN_ID`; pass `notification: null` to disable them. `comment-only` submits a comment review without approving. `publish` may approve only when the assessment allows it and the publishing agent verifies the current head, CI and discussion. `publication.review.state` records the confirmed submission state; the assessment alone does not confirm approval. These freshness checks are agent instructions; the Picco tool pins the commit but does not enforce them.

Start at `src/review/workflow.ts` for the sequence and delivery wiring. Named workers in `src/review/steps.ts` own their schemas, validation and embedded Markdown prompts. `schemas.ts` contains review inputs and evidence; GitHub and notification schemas live beside their consumers.

Other workflows can use `createWorkflowRun<Input, Results>` from `src/workflow/run.ts`. `run([{ name, execute }])` executes a parallel batch against one prior-results snapshot; singleton arrays preserve the sequence. Tasks receive `{ input, results }`, and task names determine the accepted result keys. `result()` returns accepted values and failures. `WorkflowTaskFailure` stops dependent work while retaining successful siblings. The runner emits awaited `tasksStarted` and `tasksFinished` events; each workflow owns its domain events and completion policy. `src/workflow/agent.ts` provides structured-output validation and bounded agent retries through an explicit agent-call dependency. The runner does not retry tasks or delivery.

Run `npm install`, then `npm run build` to rebuild the JavaScript Pi loads. `npm test` checks types, oxfmt, generated-output freshness and colocated unit tests. These checks do not validate live model behaviour or real delivery.

## Communication style

`communication` guides how the assistant explains things: conversational wording, concrete examples and a clear progression from one idea to the next. Its core guidance applies across replies and written work. The skill also covers written formatting, while specialised skills can add document-specific rules. `writing-voice` remains for drafting messages as the user.

Link the skill locally or update your managed skills installation. To make it a default rather than relying only on skill discovery, point your shared agent instructions at `skills/communication/SKILL.md` in this checkout. Reload resources or start a new session after installation.

## Code readability

[`code-readability`](skills/best-practices/code-readability/SKILL.md) guides naming, comments, control flow, function composition and file organisation when writing, refactoring or reviewing code. The review workflow uses it for its dedicated readability pass.

## Handoffs

[`handoff`](skills/handoff/SKILL.md) creates a Markdown document so a fresh agent can continue a conversation or task. It records goals, scope exclusions, decisions, progress, verification, relevant files, research from the session and related PRs. It defaults to `HANDOFF.md`.

## Pull request descriptions

[`writing-pull-request-description`](skills/writing-pull-request-description/SKILL.md) writes concise PR descriptions with a summary, usage example, short change bullets and the largest risks.

## Local authoring

```sh
git clone git@github.com:anthonyshort/skills.git ~/dev/anthonyshort/skills
cd ~/dev/anthonyshort/skills
python3 scripts/link.py
```

The script finds skills recursively and links each skill directly from this checkout into `~/.agents/skills`
(Codex and current Pi) and `~/.claude/skills` (Claude Code). Edits take effect from
this checkout without reinstalling. It can be rerun and refuses to overwrite
existing skills. `--home <directory>` supports an alternative agent home.
Reload skills or start a new session after linking.

## Install from GitHub

For a managed installation rather than a live development checkout:

```sh
npx skills add anthonyshort/skills --global --agent codex pi claude-code --skill '*' --yes
```

Preview discovery without installing:

```sh
npx skills add anthonyshort/skills --list
```

`npx skills` copies skills into a managed canonical directory, then links agent
locations to that copy. Use the local linking script above for live editing.
Choose one installation method per skill to avoid replacing a development link.
Private repository installation requires GitHub access through Git.

Pi can also install this repository directly as a package:

```sh
pi install git:github.com/anthonyshort/skills
# Or load a local checkout as a Pi package:
pi install ~/dev/anthonyshort/skills
```

The Pi package route is an alternative to the shared-directory links. Codex and
Claude Code need their own discovery links or `npx skills` installation.

## Migration

The source is now this repository. On the original workstation, pi-config retains
compatibility symlinks at `home/.pi/agent/skills/code-quality` and
`home/.pi/agent/skills/writing-voice` and
`home/.pi/agent/skills/galaxy/galaxy-review`. These legacy links live outside this checkout. The old Galaxy link needs updating
to `skills/review-nominal-galaxy` after this rename.
The original uncommitted `review/SKILL.md` edits were preserved during extraction.
Cross-skill links use relative paths across the grouped layout. Galaxy profile delegation uses the resolved
skill path so the profile can be installed outside the original home directory.

## Galaxy review

`review-nominal-galaxy` runs the main review workflow with Galaxy-specific skills
and rules. It uses the main report templates and submits comments only when
requested. Approval remains a human decision.

Galaxy guidance lives under `skills/review-nominal-galaxy/`. The old
`skills/galaxy-review` path has been removed. Re-run the linking script when adding
skills, and update external consumers that still use the old path.

## Format and installation references

- [Agent Skills specification](https://agentskills.io/specification)
- [Codex skill discovery and symlinks](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills)
- [Claude Code skills and symlinks](https://code.claude.com/docs/en/skills#choose-where-skills-load)
- [Pi packages](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md)
- [Pi skill discovery and deduplication](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/skills.ts)
- [npx skills repository layout](https://github.com/vercel-labs/skills/blob/main/docs/creating-skills.md)
- [npx skills commands](https://github.com/vercel-labs/skills/blob/main/docs/commands.md)
- [npx skills installation implementation](https://github.com/vercel-labs/skills/blob/main/src/installer.ts)
