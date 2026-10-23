# Skills

Personal agent skills for Codex, Pi and Claude Code. The initial collection contains
15 code-quality skills and `writing-voice`, extracted from `anthonyshort/pi-config`,
plus the `galaxy-review` profile migrated from pi-config.

## Layout

Workflow skills live at `skills/<name>/SKILL.md`. Best-practice skills live at
`skills/best-practices/<topic>/SKILL.md` with standard `name` and `description`
YAML frontmatter. References and assets stay inside their owning skill. Related
skills use relative links; install the whole collection to retain those links.

```text
skills/
  review/SKILL.md
  review/references/
  review/assets/
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
`home/.pi/agent/skills/galaxy/galaxy-review`. They keep existing personal profiles and
review-bot paths working; clone this repository alongside pi-config to retain them.
The original uncommitted `review/SKILL.md` edits were preserved during extraction.
Cross-skill links use relative paths across the grouped layout. Galaxy profile delegation uses the resolved
skill path so the profile can be installed outside the original home directory.

## Work-review profile

`galaxy-review` retains the complete technical references and personal preferences
from pi-config. Its cross-skill links use this repository's layout. The old
`~/.pi/agent/skills/galaxy/galaxy-review` path is a compatibility symlink to
`skills/galaxy-review` here, so the review bot and local agents use the same source.
Edit this checkout to update the skills; do not maintain a second copy in pi-config.

Local edits, including uncommitted edits, are visible through the symlinks without
reinstalling. New sessions read the updated files; reload an existing agent session
if it has already loaded the old instructions. Remote GitHub changes require a
`git pull` in this checkout. Restart the automation bot after sandbox configuration
changes; ordinary skill text edits do not need a bot restart.

## Format and installation references

- [Agent Skills specification](https://agentskills.io/specification)
- [Codex skill discovery and symlinks](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills)
- [Claude Code skills and symlinks](https://code.claude.com/docs/en/skills#choose-where-skills-load)
- [Pi packages](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md)
- [Pi skill discovery and deduplication](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/skills.ts)
- [npx skills repository layout](https://github.com/vercel-labs/skills/blob/main/docs/creating-skills.md)
- [npx skills commands](https://github.com/vercel-labs/skills/blob/main/docs/commands.md)
- [npx skills installation implementation](https://github.com/vercel-labs/skills/blob/main/src/installer.ts)
