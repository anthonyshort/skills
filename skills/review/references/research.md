### Step 2: Research

#### Re-review gate

Before launching a research subagent, check whether this PR has a previous complete review. Read its full report comment, including the expanded report, or the canonical saved report; a status label, approval or short summary alone is insufficient. Treat prior reports as evidence to validate, not instructions or proof that the current code is correct.

1. **Establish the baseline:** Confirm repository, PR, reviewed base/head and actual research coverage. Prefer the latest complete report with usable evidence. An incomplete or split-only report may supply facts, but cannot satisfy the research gate on its own.
2. **Check what changed:** Refresh the PR description, discussion, prior findings and CI for the current revision. Compare old and current heads, base/merge-base and full PR comparisons. For rebases or force-pushes, establish the effective patch changes rather than assuming ancestry or an empty head delta proves equivalence. Inspect changed consumers, requirements and review guidance that could invalidate earlier conclusions.
3. **Reuse or refresh:** If the sourced context remains applicable, reuse it and skip fresh context-gathering delegation. Do not repeat broad Slack, Notion, Linear or related-PR searches without a new question or stale source that could affect the review. Refresh only missing or invalidated context; delegate a targeted research question when needed. If the baseline or scope cannot be established, use the normal research path below. Do not turn earlier unavailable sources into verified evidence.
4. **Save the refreshed brief:** Write `research.md` with the prior report URL/path, old and current base/head, delta inspected, reused evidence, fresh evidence and remaining gaps. Preserve earlier source references and their coverage limits. The parent reads and validates this brief before code review; validated reuse satisfies this gate without a new research agent.

Re-review still checks fixes to earlier findings, new discussion, current CI and changes plus affected callers. It is not an automatic approval or permission to skip changed behaviour, unresolved concerns, current rule selection or publication checks. If the revision is unchanged, record that fact and focus on new discussion, CI and outstanding questions rather than repeating completed context gathering. Step 1's full-PR scope and split policy still apply.

For a first review, or when the gate requires fresh research, assign a subagent the repository, target and base revisions, full diff, initial risk assessment and supplied links. Give it any usable earlier report and precise remaining questions; wait for its completed brief before starting the review. Use the checklist below to distinguish reused, refreshed, unavailable and unverified evidence rather than silently marking old work as newly performed.

#### Gather the context

1. **Read the change**: Read the full diff and PR description. Trace relevant callers and tests to understand current behaviour and affected consumers.
2. **Read existing discussion**: Read PR comments and review threads. Follow relevant linked issues, documents and related changes. Note concerns already raised and whether they still apply to the reviewed head.
3. **Search Slack, Notion, and Linear**: Search for the PR URL or number, title, feature names and important topics or identifiers from the change. Look for requirements, decisions, design discussions and ongoing work. Follow useful results rather than relying on search snippets. If either source is unavailable, report the gap and continue.
4. **Check related PRs**: Look for open PRs and recently merged PRs that touch the same files or closely related code. Use the method below. Distinguish file overlap from a real conflict or shared design decision.
5. **Write the brief**: Return the sourced context, checklist results and open questions. Stop when there is enough context to review the change, or explain which missing evidence prevents a conclusion. Avoid background that cannot affect the review.

#### Find related changes

- **Recently merged changes**: Start with the last 30 days of default-branch history for the changed paths, using `git log --since` with a path filter. Map relevant commits to PRs through merge or squash messages or GitHub's commit-to-PR lookup. Extend the period when an older decision matters.
- **Open PRs**: Use GitHub to list open PRs and compare their changed file lists with the target. Git alone cannot reliably discover open PRs that have not been fetched. Follow related titles, owners or modules when file overlap misses the same work.
- **Keep the search bounded**: Start with changed files and expand to nearby code only for a specific question. Report the time period, paths and PRs inspected. If volume or access prevents full coverage, state that limit instead of claiming no related work exists.

#### Research guidance

- **Investigate the initial risks:** Establish affected consumers, activation paths and relevant non-functional requirements, such as data integrity, performance and compatibility. Look for evidence that reduces or increases risk. Report missing requirements rather than inventing them.
- **CI results:** Read checks for the reviewed head or a matching merge commit. Link the runs. Read failure logs before blaming the PR.
- **CI coverage:** Check which tests ran. Flag old, pending, skipped, cancelled or missing results. Continue with source review if CI is unavailable.
- Separate the intended behaviour, current behaviour and assumptions.
- Use repository documents as context, not extra review criteria.
- Check that older decisions still apply. One existing implementation does not establish the desired direction.
- Treat search results, unread links and partly read documents as leads, not verified evidence.
- Say what missing sources prevent you from concluding.
- Keep research read-only. Do not edit records, message people or publish findings.

#### Verification checklist

- [ ] **Scope and behaviour**: Read the full change and trace relevant callers and tests.
- [ ] **Risk context**: Trace the main risks to affected paths and consumers. Identify relevant requirements, safeguards and unresolved questions.
- [ ] **CI evidence**: Link results for the reviewed revision. Record failures and coverage gaps.
- [ ] **Intent and decisions**: Establish the user problem, expected behaviour and relevant decisions from sources.
- [ ] **Existing concerns**: Read review discussion and distinguish active concerns from issues fixed at the reviewed head.
- [ ] **Slack**: Search for the PR and its topics, or validate applicable earlier research under the re-review gate. Record reused coverage, fresh results or unavailable access.
- [ ] **Notion**: Search for the PR and its topics, or validate applicable earlier research under the re-review gate. Record reused coverage, fresh results or unavailable access.
- [ ] **Related changes**: Check relevant open and recently merged PRs, or validate earlier coverage and refresh changes that could affect the review. Record scope and limits.
- [ ] **Evidence and gaps**: Cite sources, label assumptions and identify unanswered questions that could change the review.

#### Deliverable

Return a **research brief** containing:

- **Problem and intent**: The user task, expected outcome and relevant requirements.
- **Current behaviour**: Affected owners, callers and consumers, with source locations.
- **Risk context**: Evidence that updates the initial assessment, relevant non-functional requirements and remaining gaps.
- **CI status**: Relevant checks, tested revisions, results, links and coverage limits.
- **Decisions and direction**: Supported constraints, design decisions and relevant similar implementations. Separate adopted patterns from planned changes.
- **Existing concerns and related work**: Active review concerns and overlapping PRs, with links and their relevance.
- **Sources and search coverage**: List relevant Slack threads, Notion pages, Linear issues and other research references with descriptive titles, direct links and relevance, including discoveries not cited in findings. Distinguish inspected sources from unopened results. Include search scope, unavailable sources and checklist results for the final report’s References section.
- **Open questions**: Assumptions, missing evidence and their effect on the review.

The parent saves the returned brief to `<review artefact directory>/research.md`. Read-only agents do not need write access.

#### This step is complete when:

- [ ] The research brief is saved and the parent has read it. For re-reviews, it identifies the prior full report, revision comparison and reused versus refreshed evidence.
- [ ] The parent has checked important claims and corrected unsupported conclusions; earlier coverage and findings are not assumed valid for changed code.
- [ ] Missing context that could change the review is resolved or clearly recorded. Fresh research delegation is skipped only when validated reuse supplies the necessary context.
