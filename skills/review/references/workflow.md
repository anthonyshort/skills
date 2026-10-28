# External workflow contract

Read this reference only when the caller explicitly requests a saved workflow and supplies its script. The external workflow owns stage order, result contracts, retries and artefact persistence. This skill owns the review criteria, stage guidance, rules and report formats. A workflow is not required for standalone review.

## Inputs and scope

Pass explicit `skillRoot`, `base`, `head`, `repository`, `target`, `artifacts` and `runId` inputs using the supplied workflow’s documented contract. `skillRoot` identifies the review skill directory whose entry, references, rules, templates and helpers all belong to the same version. `repository` identifies the local checkout. Use exact full base and head revisions, the complete target comparison, a named writable artefact directory and a unique run identity.

Pass wrapper additions and publication restrictions explicitly. They must apply to research, specialist skill selection, rule indexes, report generation and publication. Do not infer access to a host path inside a sandbox. Check that the chosen skill files and repository are readable and the artefact directory is writable before starting review work.

## Worker responsibilities

- Give every review worker this entry’s shared goals and rules, the assigned stage reference, pinned scope, relevant previous results and applicable wrapper additions.
- Preserve the no-install and no-local-project-check rules. Gates may validate review artefacts, not run the reviewed project’s tests, builds, linters or typechecks. Use CI for automated project evidence and existing deployments for manual checks.
- Run setup before research, and completed research before the five assessments. Retain a dedicated readability assessment and one sequential rule worker.
- Preserve the setup size gate and its exceptions. Split-only reviews skip research, implementation assessments and rule coverage claims.
- Preserve the research re-review gate. Validated reuse does not require repeating broad context searches.
- Workers return their named results without publishing or modifying reviewed source. A dedicated writer may save accepted review artefacts under the supplied directory. This replaces the standalone parent-save instructions only for artefact persistence.

## Completion and failure

Require every expected assessment and a result or skip reason for every rule in every supplied index. Missing, failed or manually skipped workers are not passing results. Allow at most one fresh retry of a failed required stage, then stop the review and save the available results and failure evidence. Keep check outcomes and evidence gaps visible even when the stage returned valid structured data.

Validate pinned revisions, stage coverage, rule coverage, finding references, saved artefact contents and the report before returning completion. The caller supplies a fresh invocation identity on every launch. Journal replay may reuse writer results without rerunning gates. The parent must independently rerun the returned validation command before consuming or publishing saved artefacts, even after a workflow reports completion. A complete review may find defects. An incomplete review must not be treated as a successful review or approval. Schemas and file gates check structure and consistency, not whether evidence is true or conclusions are sound.

The result must identify its completion status, reviewed revisions, saved report and artefact paths, missing stages and remaining coverage gaps. Preserve available partial evidence when completion fails. Never replace a failed stage with an empty assessment or silently omit it during consolidation.

## Notifications and publication

The caller may configure a reporting agent to use the host `notify` tool at stage boundaries. Use the supplied notification contract and run identity. Keep notification delivery separate from review-stage retries, and do not repeat successful review work because a notification failed. Record delivery gaps without claiming confirmation. Do not fall back to direct Telegram or GitHub network calls if the host tool is unavailable.

The parent reads accepted outputs, verifies important claims and checks that editorial changes preserved findings, evidence, priorities and uncertainty. A workflow may delegate consolidation, but the parent remains responsible for the final judgement. Structural completion alone never authorises approval.

Follow [publication](publication.md) for the existing final-report, inline-finding and approval helper. When notification adapters manage live progress, explicitly transfer ownership of that comment before the helper publishes the final report. Prevent delayed status updates from replacing the published report. Keep publication restrictions, refreshed discussion and CI, live-head checks and confirmed submission requirements intact. Do not call a host review-completion tool until required publication is confirmed.

## Keep experiments unused

Refactoring this skill does not install or activate an external workflow. Do not change live skill links, installed packages, agent profile settings, review routes, polling or scheduled jobs to make a supplied experimental script available. Test orchestration with stub agents and mocked notification and publication boundaries unless the caller separately requests live integration.
