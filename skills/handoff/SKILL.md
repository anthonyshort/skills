---
name: handoff
description: Create or update a handoff document when transferring a conversation or task to another agent or session.
---

# Create a handoff

Give an agent with no conversation history enough context to continue.

## Workflow

1. Review the conversation and relevant artefacts. Follow the latest user instructions.
2. Save Markdown to the requested location, otherwise `HANDOFF.md`. Update an existing handoff for this task. Preserve unrelated documents.
3. Check that the next action is clear and return the file path.

## Document sections

Use short lists. Combine or omit sections as needed:

- **Goal:** Desired outcome, constraints and completion criteria.
- **Current state:** Where work stopped. For code, include repository, branch, commit and uncommitted changes.
- **Decisions:** Choices and reasons. Include rejected approaches worth remembering.
- **Completed:** Changes, findings and artefacts. Distinguish partial work.
- **Remaining:** Ordered steps, starting with the immediate next action.
- **Problems:** Failures, blockers, open questions and unsuccessful attempts.
- **Out of scope:** Excluded or deferred work, including research and project ideas, with reasons.
- **Session research:** Sources investigated during this conversation. Link each, summarise its findings and explain what was adopted, rejected or deferred.
- **Related PRs:** Links, purpose, last known status and dependencies or overlap.
- **Files and references:** Relevant paths, links and why they matter.
- **Verification:** Commands run, results and gaps. Flag changes made after checks.

## Quality checks

Keep the document concise and self-contained:

- Record current facts once. Omit transcript dumps and stale plans.
- Distinguish verified facts, reported results, assumptions and proposals.
- Preserve exact commands, errors and identifiers needed to resume.
- Identify local-only files or temporary state that must be transferred or recreated.
- Preserve scope and approval boundaries. Exclude secrets.
- Describe the underlying task without continuing it.
