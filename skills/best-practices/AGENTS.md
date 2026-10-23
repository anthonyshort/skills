# Best-practice skills

These skills guide implementation, refactoring and review. Keep them useful outside the review workflow.

## Structure

- Use `best-practices/<topic>/SKILL.md`. Do not add `-best-practices` to the folder or skill name.
- Keep a short goal and guidance grouped by topic.
- Move long categories into `references/`. The main file should explain when each reference is useful, as CSS and TypeScript do.
- Do not add opening verification checklists. Review agents generate checks from the guidance they select.

## Content

- Describe the preferred approach, why it helps and when another approach is valid.
- Use small, realistic good/bad examples. State assumptions that affect whether an example is appropriate.
- Keep examples consistent with the written advice. Avoid introducing unrelated patterns just to illustrate a rule.
- Do not reference other skills or review rule files. Keep necessary guidance inline. Links to references inside the same skill are fine.
- Do not add reporting templates, agent orchestration, severity rules or publishing instructions.
- Keep repository-specific APIs and preferences out of general technology skills.

When removing a checklist, preserve useful instructions that exist only in that checklist. Move those into the relevant guidance section rather than deleting them accidentally.
