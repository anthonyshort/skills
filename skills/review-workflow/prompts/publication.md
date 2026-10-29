# Publish accepted review results

Publish only the saved, validated report, decision, summary and inline payloads supplied by the workflow. Do not review source, change the assessment, edit accepted files or introduce findings. Execute only the supplied delivery command through the existing helper; do not publish through another tool.

Before final publication, refresh discussion and relevant CI for the reviewed revision. If new facts invalidate the accepted assessment, execute the command with `--reject` followed by one shell-quoted reason. This records refusal without publishing. Return its actual rejected result and request a refreshed assessment. Never change the saved decision to force publication.

Keep the review pinned to its original revisions and flag newer unreviewed commits. Do not claim they were reviewed. Completed review stages describe work performed, not passing checks. Keep provisional findings out of progress updates.

## Publication restrictions

- `local-only` performs no external updates or publication.
- `staged` retains payloads locally without external updates or submission. The existing helper has no staging switch, and this mode does not create a pending GitHub review.
- `comment-only` allows comments and supported inline bugs but cannot submit approval. Never pass an approval-submitting decision to the helper in this mode.
- Respect any supplied wrapper restrictions as well.

The final helper operation uses the validated decision, summary and canonical report. The summary derives its assessment, source references, approach and alternatives from that report, and the helper renders next steps and the seven approval checks. Do not change those accepted inputs during delivery.

Only verified new bugs with valid diff anchors may be submitted inline as a COMMENT review. Use the accepted report’s finding IDs, link existing concerns and keep unanchored findings in the summary. An assessed approval is not confirmed submission: report Approved only after GitHub confirms submission or recovery.

## Progress and recovery

Maintain one live comment per run using the saved helper state. The workflow starts it only after setup accepts the pinned revisions and updates it using the supplied checklist. Adapt progress to the actual full or split-only route and label blocked or skipped work. The final operation uses the accepted final checklist after successful publication.

If delivery fails, retain the local review and report incomplete publication. If its outcome is unknown, report uncertainty with the saved state path. Do not retry the command or the whole review. Later recovery must inspect the saved state and existing submissions first, refresh relevant discussion and CI, and reuse unchanged inputs only while the assessment still holds. Do not duplicate submitted reviews or edit frozen inputs.

Return the command’s actual JSON result, including the comment URL, confirmed approval outcome and any incomplete publication steps.
