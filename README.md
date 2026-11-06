# Skills

Personal agent skills for Codex, Pi and Claude Code. The collection includes
shared technical guidance, writing skills and a client for the review-agent MCP service.
Repository-specific Galaxy guidance remains in its existing collection.

## Layout

Workflow skills live at `skills/<name>/SKILL.md`. Best-practice skills live at
`skills/best-practices/<topic>/SKILL.md` with standard `name` and `description`
YAML frontmatter. References and assets stay inside their owning skill. Related
skills use relative links; install the whole collection to retain those links.

```text
skills/
  review/SKILL.md
  review/rules/                 # retained compatibility resources
  review/templates/             # retained legacy formats
  best-practices/react/SKILL.md
  writing-voice/SKILL.md
  ...
package.json
scripts/link.py
```

The small `pi` manifest exports `./skills` as a Pi package without agent-specific
copies. Technical skills can be used independently. The `review` skill requires a
connected review-agent MCP service; it does not run a second local review workflow.

## Review service

[`review`](skills/review/SKILL.md) submits a GitHub PR review through MCP and retrieves
the complete saved report. Manual reviews default to local-only; publishing follows
the user’s authorised delivery choice. The service owns stage instructions,
checklists, output contracts, decision policy and GitHub delivery. See
[review-agent](https://github.com/anthonyshort/review-agent) for its workflow and
[MCP connection documentation](https://github.com/anthonyshort/review-agent/blob/main/docs/mcp-reviews.md).

The old generic rules, templates and Python publisher remain for compatibility
and historical references during migration. The MCP client does not load them.
New general review checks belong in review-agent; do not update both copies.

## Communication style

`communication` guides how the assistant explains things: conversational wording, concrete examples and a clear progression from one idea to the next. Its core guidance applies across replies and written work. The skill also covers written formatting, while specialised skills can add document-specific rules. `writing-voice` remains for drafting messages as the user.

Link the skill locally or update your managed skills installation. To make it a default rather than relying only on skill discovery, point your shared agent instructions at `skills/communication/SKILL.md` in this checkout. Reload resources or start a new session after installation.

## Code readability

[`code-readability`](skills/best-practices/code-readability/SKILL.md) guides naming, comments, control flow, function composition and file organisation when writing, refactoring or reviewing code. The review workflow uses it for its dedicated readability pass.

## Handoffs

[`handoff`](skills/handoff/SKILL.md) creates a Markdown document so a fresh agent can continue a conversation or task. It records goals, scope exclusions, decisions, progress, verification, relevant files, research from the session and related PRs. It defaults to `HANDOFF.md`.

## PR architecture walkthroughs

[`pr-architecture-walkthrough`](skills/pr-architecture-walkthrough/SKILL.md) prepares context before a review: how the relevant system works, how a PR or stack changes it, and where to start reading the source. It produces Markdown with Mermaid diagrams and supports unattended preparation. Assignment triggers and scheduling belong to a separate automation.

## Pull request descriptions

[`writing-pull-request-description`](skills/writing-pull-request-description/SKILL.md) writes concise PR descriptions with a summary, usage example, short change bullets and the largest risks.

## Local authoring

[`add-review-rule`](skills/add-review-rule/SKILL.md) turns review feedback and code examples into focused rules. It checks for overlap, chooses the service-owned general collection or an existing repository-specific collection, writes comparable examples and exceptions, and updates the owning index.

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

The `review-nominal-galaxy` wrapper, six technical skills and repository-specific
rules remain at their existing paths. When entering through that wrapper, the MCP
client passes its name to the service rather than repeating the review locally.
The wrapper’s stage headings are compatibility guidance for the service; the
service owns current execution and publication policy. Repository-specific
reorganisation is deferred.

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
