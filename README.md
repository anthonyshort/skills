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
```

There are no runtime dependencies or agent-specific copies. The small `pi` manifest
exports `./skills` as a Pi package. The review workflow uses equivalent agents or
its documented fallback when its named agents are unavailable. The personal GitHub
review attribution remains `Sent with Pi` on all agents.

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
