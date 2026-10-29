---
name: review-workflow
description: Run the experimental Pi subagents review workflow when requested, with required review stages, validated saved output and workflow-owned progress and publication. Keep the ordinary review skill available separately.
---

# Review workflow

Use this experimental alternative to the ordinary review skill. Invoke the named `review` workflow through `SubagentWorkflow` in the current Pi session. The workflow owns assessment ordering, retries, saving, Telegram updates and GitHub publication. Return its confirmed results. Do not run the ordinary review skill or publish afterwards.

## Prepare the launch

1. Resolve the installed package root containing this skill, `workflows/review.js` and its support scripts. Use that absolute directory as `packageRoot`.
2. Identify the repository and requested PR or comparison. Resolve the full comparison to pinned base and head commit IDs and use an existing clean checkout at that head. Use existing Git objects and tools. Do not install dependencies, run project checks or trigger CI. Report an unavailable checkout or unresolved scope as blocked.
3. Choose an artefact directory outside the reviewed repository and skill/support directories. Use a stable `runId` for this review and a fresh `invocationId` for every launch, because Pi can replay accepted workers without rerunning their file gates.
4. Pass caller requirements as absolute `contextFiles` and wrapper guidance through `wrapperSkillRoots`. Respect the caller’s publication restrictions before launching.

## Invoke the workflow

Call `SubagentWorkflow` with `name: "review"` and the arguments below, replacing the example paths, repository, PR and full commit IDs with the actual target:

```json
{
  "name": "review",
  "args": {
    "packageRoot": "/home/me/dev/skills",
    "repository": "/home/me/dev/app",
    "target": "owner/app PR #42",
    "base": "BASE_SHA",
    "head": "HEAD_SHA",
    "artifacts": "/tmp/app-review",
    "runId": "app-pr42-review",
    "invocationId": "app-pr42-review-attempt-1",
    "publication": "publish",
    "github": { "repository": "owner/app", "pr": 42 },
    "notification": { "messageKey": "app-pr42-review" }
  }
}
```

The package discovers the named workflow through pi-subagents. If it is unavailable, report the missing workflow rather than falling back to a manually coordinated review.

Publication modes:

- `publish` is the default for a PR review. The workflow maintains GitHub progress and publishes accepted results, including approval only when permitted and confirmed.
- `local-only` suppresses all external updates and publication, including Telegram.
- `staged` saves publication payloads locally without external updates or submission. It does not create a pending GitHub review. Report that limitation when the caller requests pending-only output.
- `comment-only` allows progress and final comments, including supported inline bugs, without submitting approval.

Set `github` to `null` for a branch or diff review without a PR. Host notifications default to `notification: { "messageKey": "review:RUN_ID" }`. Supply a custom message key if needed, or `notification: null` to disable host updates. The reporting worker calls `notify({ "action": "send", "messageKey": "RUN_MESSAGE_KEY", "text": "…" })`; the host selects configured channels, including Telegram. Reuse the message key and host session scope for the run so updates edit the same message. Native Pi currently has no `notify` tool: report unavailable delivery when no host bridge exposes it, without inventing a transport. Do not put tokens in launch arguments.

## Worker criteria and results

Workers receive embedded Markdown instructions from the [prompt files](criteria.md): shared review rules followed by the named step’s instructions. Edit those files and run `npm run build` to update the generated workflow. The report and summary templates are embedded where needed. Workers still read selected rules, specialist guidance and caller context at runtime. These resources and the publication helpers belong to this experimental copy, so the original review skill stays unchanged. Workers do not recursively launch this skill or coordinate other workers.

Return the validated report path, review outcome, confirmed GitHub URLs and publication or notification gaps from the workflow result. Distinguish a proposed approval from confirmed submission. A complete saved review can have incomplete publication. Do not retry the entire review to repair notification delivery or resubmit an uncertain publication.
