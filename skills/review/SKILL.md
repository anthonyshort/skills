---
name: review
description: Request a GitHub pull request review through review-agent MCP and retrieve its complete saved report. Use when asked to review a PR; the review service owns assessment and publication policy.
---

# Request a review

Use the connected review-agent MCP service. Discover its available tools by their `github_reviews_` names; do not assume a particular harness namespace. Start with `github_reviews_status` to check availability without requesting work.

Resolve the repository and PR number from the user's target. The service currently reviews GitHub PRs, not arbitrary uncommitted worktrees or standalone files. Report an unsupported target or unavailable service clearly; do not silently substitute a different local review procedure.

## Submit once

Call `github_reviews_start` with `repository`, `number` and a caller-owned `requestId`. Keep the request ID with the returned job ID. Reuse the same request ID and identical arguments only when recovering a lost submission response; use a new ID for a separately requested review. Starting a job acknowledges acceptance, not completion.

Default to `delivery: "local-only"`. Use `delivery: "publish"` when the user has authorised publishing this review, including authorisation already given in the conversation. Do not infer publication permission from a request for private feedback. Changing delivery requires a new request ID.

If invoked through an existing repository wrapper, pass its name in the optional `skill` argument when supported by the service. The wrapper supplies repository guidance; do not execute its assessment or publication steps locally. Otherwise let the service use its configured/default skill.

## Retrieve the result

Use `github_reviews_details` and `github_reviews_report` with the saved job ID. Follow a completion notification when available, or check progress at reasonable intervals. Do not submit another job merely because the first remains queued or running.

Read the complete saved report, including its status, partial flag, findings, suggested fixes, decision recommendation and verification limits when present. The bounded final-response preview is not the canonical report. A failed attempt may have useful partial evidence; do not present it as a complete review.

Summarise the result and link any confirmed publication. Distinguish approval recommended from a confirmed GitHub approval. The service owns stage instructions, technical-skill checks, reconciliation, language editing and delivery; do not repeat that work or publish a second copy.

## Manage existing work

Use list/details/report tools to inspect accepted jobs. Cancel or retry only when requested or needed within the user's authorised task. Retry an unsuccessful job with its saved job ID; completed reviews need a new request. Do not reset history, enable automatic approvals, change polling or restart the service as part of an ordinary review request.

If connection, eligibility or execution is blocked, report the actual blocker and retain the job identity for follow-up. Do not invent a report or retry an uncertain GitHub write from the client.
