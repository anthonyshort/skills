# Check research

Independently check the important claims in the supplied research brief against the cited sources, pinned scope and current CI. Reading the brief alone does not complete this check. Return a corrected self-contained brief with supported conclusions and remaining gaps for the assessments.

## Verify the brief

1. Confirm the brief covers the whole pinned comparison, affected callers and tests, requirements, initial risks and current review discussion.
2. Read the important cited sources. Distinguish inspected documents from search snippets and unread links. Correct unsupported claims and separate intended behaviour, current behaviour and assumptions.
3. Check current CI and the tested revision. Preserve pending, failed, skipped, cancelled, unavailable or incomplete coverage rather than treating it as passed.
4. Check the reported Slack, Notion, Linear and related-PR coverage. Confirm search scope and access limits, including discoveries relevant to the report even when they do not support a finding. Do not repeat broad searches without a specific missing or stale source.
5. For reused research, inspect the prior complete report and confirm repository, PR, old and current base/head, effective patch changes and affected requirements or consumers. A status label, approval, short summary, incomplete report or split-only report cannot satisfy the reuse gate. Check rebases and force-pushes through effective patch comparisons. Confirm that reused evidence remains applicable, refresh stale facts and preserve earlier access limits. Do not assume prior findings remain valid for changed code.
6. Verify that open questions explain what the missing evidence prevents the review from concluding. Resolve a targeted gap where possible; keep unresolved gaps explicit.

## Return the accepted brief

Return the problem and requirements, current behaviour and affected owners, updated risk context, CI results and limits, decisions and direction, active concerns and related work, sources and search coverage, and open questions. Include source titles and direct URLs or paths, the reused versus refreshed evidence and any corrected conclusions.

Preserve useful supported detail from the initial brief. Your corrected brief takes precedence where the two disagree. Do not perform the five assessments, rule review or final report in this step.
