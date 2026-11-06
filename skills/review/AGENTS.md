# Review client and retained resources

The `review` skill is an MCP client. Keep its instructions about submitting a job, inspecting status, retrieving the complete report and respecting delivery choices. The review service owns stage assignments, technical-skill checklists, evidence contracts, reporting, approval policy and publication.

Do not restore the standalone review procedure, fallback local reviewers or a duplicate approval checklist here. Keep client instructions independent of harness-specific tool namespaces and live server configuration. Preserve existing user authorisation rather than asking again for an already-authorised delivery choice.

## Retained compatibility resources

The existing rules, templates and Python publication scripts remain in place while other references and consumers migrate. Do not delete or treat them as the active service policy merely because the client skill no longer loads them. Historical benchmarks describe the resources used at the time; preserve their links and hashes.

New general service rules belong to review-agent under `src/workflows/review/stages/rules/checks/`, with its own authoring and validation instructions. Repository-specific material remains in its current collection; its location is outside this change.

For compatibility-only edits here, inspect actual consumers, keep local links working and run the relevant existing script tests if executable behaviour changes. Runtime clients do not load this authoring file as review criteria.
