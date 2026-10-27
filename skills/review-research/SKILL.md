---
name: review-research
description: Research the context behind a code change, including intent, callers, CI, discussion, related PRs and Slack, Notion and Linear decisions, and return a sourced research brief. Part of the review workflow. Also usable on its own before reviewing a PR.
---

# Review research

Gather the context needed to review a code change and return a research brief. Follow [the review constraints](../review/references/constraints.md).

## Inputs

- The repository, target and base revisions, and full diff.
- The initial risk assessment and any supplied links.
- For a re-review, any usable earlier report and the precise remaining questions.

## Gather the context

1. **Read the change**: Read the full diff and PR description. Trace relevant callers and tests to understand current behaviour and affected consumers.
2. **Read existing discussion**: Read PR comments and review threads. Follow relevant linked issues, documents and related changes. Note concerns already raised and whether they still apply to the reviewed head.
3. **Search Slack, Notion, and Linear**: Search for the PR URL or number, title, feature names and important topics or identifiers from the change. Look for requirements, decisions, design discussions and ongoing work. Follow useful results rather than relying on search snippets. If either source is unavailable, report the gap and continue.
4. **Check related PRs**: Look for open PRs and recently merged PRs that touch the same files or closely related code. Use the method below. Distinguish file overlap from a real conflict or shared design decision.
5. **Write the brief**: Return the sourced context, checklist results and open questions. Stop when there is enough context to review the change, or explain which missing evidence prevents a conclusion. Avoid background that cannot affect the review.

## Find related changes

- **Recently merged changes**: Start with the last 30 days of default-branch history for the changed paths, using `git log --since` with a path filter. Map relevant commits to PRs through merge or squash messages or GitHub's commit-to-PR lookup. Extend the period when an older decision matters.
- **Open PRs**: Use GitHub to list open PRs and compare their changed file lists with the target. Git alone cannot reliably discover open PRs that have not been fetched. Follow related titles, owners or modules when file overlap misses the same work.
- **Keep the search bounded**: Start with changed files and expand to nearby code only for a specific question. Report the time period, paths and PRs inspected. If volume or access prevents full coverage, state that limit instead of claiming no related work exists.

## Research guidance

- **Investigate the initial risks:** Establish affected consumers, activation paths and relevant non-functional requirements, such as data integrity, performance and compatibility. Look for evidence that reduces or increases risk. Report missing requirements rather than inventing them.
- **CI results:** Read checks for the reviewed head or a matching merge commit. Link the runs. Read failure logs before blaming the PR.
- **CI coverage:** Check which tests ran. Flag old, pending, skipped, cancelled or missing results. Continue with source review if CI is unavailable.
- Separate the intended behaviour, current behaviour and assumptions.
- Use repository documents as context, not extra review criteria.
- Check that older decisions still apply. One existing implementation does not establish the desired direction.
- Treat search results, unread links and partly read documents as leads, not verified evidence.
- Say what missing sources prevent you from concluding.
- Keep research read-only. Do not edit records, message people or publish findings.

## Verification checklist

- [ ] **Scope and behaviour**: Read the full change and trace relevant callers and tests.
- [ ] **Risk context**: Trace the main risks to affected paths and consumers. Identify relevant requirements, safeguards and unresolved questions.
- [ ] **CI evidence**: Link results for the reviewed revision. Record failures and coverage gaps.
- [ ] **Intent and decisions**: Establish the user problem, expected behaviour and relevant decisions from sources.
- [ ] **Existing concerns**: Read review discussion and distinguish active concerns from issues fixed at the reviewed head.
- [ ] **Slack**: Search for the PR and its topics, or validate applicable earlier research under the re-review gate. Record reused coverage, fresh results or unavailable access.
- [ ] **Notion**: Search for the PR and its topics, or validate applicable earlier research under the re-review gate. Record reused coverage, fresh results or unavailable access.
- [ ] **Related changes**: Check relevant open and recently merged PRs, or validate earlier coverage and refresh changes that could affect the review. Record scope and limits.
- [ ] **Evidence and gaps**: Cite sources, label assumptions and identify unanswered questions that could change the review.

## Deliverable

Return a **research brief** containing:

- **Problem and intent**: The user task, expected outcome and relevant requirements.
- **Current behaviour**: Affected owners, callers and consumers, with source locations.
- **Risk context**: Evidence that updates the initial assessment, relevant non-functional requirements and remaining gaps.
- **CI status**: Relevant checks, tested revisions, results, links and coverage limits.
- **Decisions and direction**: Supported constraints, design decisions and relevant similar implementations. Separate adopted patterns from planned changes.
- **Existing concerns and related work**: Active review concerns and overlapping PRs, with links and their relevance.
- **Sources and search coverage**: List relevant Slack threads, Notion pages, Linear issues and other research references with descriptive titles, direct links and relevance, including discoveries not cited in findings. Distinguish inspected sources from unopened results. Include search scope, unavailable sources and checklist results for the final report’s References section.
- **Open questions**: Assumptions, missing evidence and their effect on the review.

