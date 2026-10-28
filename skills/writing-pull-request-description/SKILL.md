---
name: writing-pull-request-description
description: Write or revise a pull request description from the diff and task context. Use when drafting a PR body or updating it after scope changes.
---

# Write a pull request description

Help a reviewer understand what changes, why it matters and where to focus.

## Prepare

- Inspect the diff against the target branch, relevant code and task context.
- Describe the final change. Replace stale descriptions when scope changes.
- Follow the repository’s required template, fitting the structure below into it.

## Structure

Use this order by default:

1. **Summary:** One or two sentences explaining what changes and why. Lead with the outcome or problem solved.
2. **Usage:** A small, realistic example showing the new API or behaviour. Use before-and-after snippets when the comparison helps. For UI changes, a screenshot or interaction example may work better. Omit when an example adds nothing.
3. **Changes:** Short bullets grouped by meaningful change. Use `- **Short title:** Brief description.` Explain effects and important implementation choices without listing every file.
4. **Risks:** The author’s assessment of the largest concrete risks. Explain what could go wrong and any mitigation or verification gaps. State when no specific risks are identified rather than inventing concerns.

## Keep it useful

- Write for someone who has not read the conversation. Link relevant issues or related PRs when they explain context or dependencies.
- Keep examples consistent with the code. Include migration details for breaking changes.
- Report relevant checks actually run and their results briefly. Distinguish planned checks and unverified behaviour.
- Scale detail to the change. Omit repeated points, development history and generic checklists.
- Return the description as Markdown. Publish or update a PR only when requested.
