# Maintaining skills

Read and follow the shared instructions in `/home/anthonyshort/.pi/agent/AGENTS.md`.
Read the scoped `AGENTS.md` in the area you are editing.

## What belongs where

| Content | Location |
| --- | --- |
| General implementation guidance for a technology | `best-practices/<topic>/` |
| Review entry point, shared policy and stage guidance | `review/SKILL.md` and `review/references/` |
| General checks assigned to focused rule agents | `review/rules/` |
| Saved report and GitHub review formats | `review/templates/` |
| Galaxy additions to the main workflow | `review-nominal-galaxy/SKILL.md` |
| Galaxy APIs, patterns and implementation guidance | `review-nominal-galaxy/best-practices/` |
| Galaxy-specific review rules | `review-nominal-galaxy/rules/` |

Best-practice skills help with writing, refactoring and reviewing code. Review rules give a focused agent one concrete question to investigate. Keep orchestration in the review workflow.

## Write concise guidance

- Use plain English, short sentences and short labelled bullets.
- Do not join clauses with semicolons. Use separate sentences or lists.
- Give instructions that affect decisions. Remove generic advice and repeated explanations.
- Explain trade-offs and exceptions. Do not turn examples into universal requirements.
- Show good and bad code when the distinction is hard to judge from prose.
- Keep implementation guidance separate from review reporting requirements.

## Add or edit a skill

1. Read the existing skill and relevant references before editing.
2. Look for an existing home for the guidance. Avoid adding another skill for overlapping content.
3. Give each skill a `SKILL.md` with `name` and `description` frontmatter. Use a unique name matching its folder. Describe when to use it.
4. Keep the entry file short. Put substantial category guidance in `references/` and explain when each file should be read.
5. Keep one source of truth. Put output fields in templates, workflow in the coordinator and technical guidance in the relevant skill or rule.
6. When moving or deleting files, update incoming links and discovery documentation. Do not leave compatibility claims that are no longer true.

## Check the edit

- Run `git diff --check`.
- Validate changed skills with the skill-creator validator when available.
- Check local links, including section anchors after moving headings.
- Check that skill names are unique. The linking script discovers nested skills recursively and uses folder names as installed names.
- For layout or discovery changes, run `scripts/link.py --home <temporary-directory>` from the repository root. Check both generated skill directories. Do not change live installation links unless requested.
- Use a realistic skill test when workflow behaviour changes substantially. Save evidence and report limits. Do not invent successful verification.

Authoring instructions belong in `AGENTS.md`. Do not make runtime skills load these files as extra review criteria.
