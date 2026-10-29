# Review workflow

This Pi package provides the experimental `review` workflow for pi-subagents 0.22.0. Select the separate `review-workflow` skill to launch it in your existing Pi session. The workflow schedules every required review stage, validates saved results and owns progress and publication. The calling agent returns the result without running the original review skill afterwards.

`skills/review-workflow/` is an editable snapshot of `skills/review/` at `0995471`. Its concise `SKILL.md` launches the workflow; `criteria.md` preserves the detailed review policy and assigns coordination to workflow stages. Rules, templates and GitHub helpers are copied alongside it. The ordinary `review` skill remains unchanged. There is no automatic synchronisation between the two versions.

## Install and run

From this checkout:

```sh
npm install
pi install npm:@tintinweb/pi-subagents@0.22.0
pi install /absolute/path/to/skills
```

Enable package workflow discovery in pi-subagents and reload Pi. Ask to use `review-workflow`, or invoke `SubagentWorkflow` with `name: "review"` directly:

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
    "github": { "repository": "owner/app", "pr": 42 },
    "publication": "publish",
    "notification": { "messageKey": "app-pr42-review" }
  }
}
```

Replace the comparison with full base and head commit IDs covering the whole PR. Use a clean checkout at that head, an output directory outside source directories and a fresh `invocationId` on every launch so cached workers cannot bypass file checks. Keep the `runId`, notification key and GitHub state for the same review run. For a branch or diff without a PR, omit `github` or set it to `null`. Host updates default to the message key `review:RUN_ID`; pass `notification: null` to disable them. The host chooses recipients, so an unavailable notification tool records a rejected attempt and disables later host sends.

Optional `contextFiles` supply absolute paths to requirements. `wrapperSkillRoots` adds wrapper guidance and rule indexes without changing ordinary wrapper skills. Resource paths default to the experimental skill, gate scripts and installed `tsx` loader.

| Publication mode | GitHub | Host notifications, including Telegram |
| --- | --- | --- |
| `publish` (default) | Progress and final results; approval only when eligible and confirmed | Enabled when configured |
| `comment-only` | Progress and final comments, including supported inline bugs; no approval submission | Enabled when configured |
| `local-only` | No external operations | Suppressed |
| `staged` | Local publication files only | Suppressed |

The unchanged GitHub helper has no staging command. `staged` saves payloads without creating a pending GitHub review. A request for pending-only output must retain that limitation rather than silently publishing.

## Required work and acceptance boundaries

The full route is setup → research → research check → five assessments → rules → consolidation → draft → editorial reduction → accepted report → decision → validated saving → publication. The split-only route is setup → split plan → decision → validated saving → publication.

| Required work | Responsible stage and accepted output | What code enforces |
| --- | --- | --- |
| Full comparison, initial risks and size policy | Setup records scope, revisions, rule inventory and full/split route | Pinned revisions, size-exception requirement and route selection |
| Fresh research or justified reuse | Research returns sourced context, checklist and gaps | Required structured result; source investigation remains instructed |
| Validate research before assessments | `researchCheck` checks claims and returns the corrected brief | Acceptance before the five assessments; corrected brief supplied to workers |
| Product, system fit, simplicity, readability and correctness | Five separate assessments with concrete checks, evidence and exclusions | All five required; barrier prevents downstream work when one is missing |
| One sequential pass over every indexed rule | Rules worker returns selected/skipped rows and evidence | Inventory coverage and distinct rule results; reading order remains instructed |
| Independent claims, duplicates and disagreements | Consolidation returns accepted findings and unresolved gaps | Finding identity and accounting; independent source checking remains instructed |
| Report, editorial reduction and restoration | Draft, editorial and report acceptance return the canonical report | Template sections, coverage and finding provenance; prose judgement remains instructed |
| Seven approval checks and outcome policy | Decision returns approval assessment and publication material | Outcome consistency, required findings and inline provenance |
| Real saved files matching accepted data | Writer saves files; Node gate validates them | Actual disk content, rule indexes, Git state and result identity |
| Progress and final publication | Delivery workers invoke host tools and the existing helper | Publication after saving; separate delivery and submission results |

Each invalid review stage gets one fresh retry. Exhaustion stops dependent stages and preserves accepted partial results, including successful parallel siblings. Missing evidence remains a gap. Structural validation does not prove model judgement or the truth of source claims.

## Progress and publication

Progress begins after setup accepts the pinned comparison and full/split route. GitHub uses one helper state file, `github.json`, in the artefact directory. Updates are serial, keep provisional findings private and distinguish completed work from passing checks. Interrupted reviews update progress where possible. A failed destination does not rerun review stages or stop the other destination from being attempted.

Host updates use the actual keyed broadcast API:

```js
notify({ action: "send", messageKey: "app-pr42-review", text: "…" });
```

The authenticated host selects channels such as Telegram. There is no caller-supplied destination or event key. Repeated sends edit the same message only within the same host scope and message key. The host bridge must preserve that scope; a new host session is not interchangeable. If receipts show a changed scope, the workflow disables further host updates to avoid creating more messages. A missing host tool also disables later attempts. A native Pi session without the bridge records unavailable delivery as rejected. The workflow does not emulate a missing tool with HTTP or shell commands. Receipts preserve the broadcast scope and per-channel delivery results.

Final GitHub publication runs only after the saved-file gate passes. A small Node bridge revalidates the accepted files immediately before invoking the copied `github_progress.py` helper. The helper owns GitHub calls, frozen publication inputs, recovery and confirmed submission. The workflow does not implement a second publisher. Its publication worker refreshes current discussion and CI and rejects stale assessments; the helper flags newer commits and withholds unsafe submission. Delivery is outside the review-stage retry loop. Inspect the existing helper state before recovering an uncertain publication.

The writer saves `bundle.json`, stage Markdown, `review-report.md`, `approval.json`, `summary.md`, `inline.json` and `result.json`. Incomplete reviews also save `incomplete.md`. Writer validation failure stops final publication. A saved complete review can still require fixes, withhold approval or have incomplete delivery.

The workflow return includes validated file paths, the approval assessment, publication result, confirmed URLs and notification diagnostics. The approval assessment describes the recommendation; `publication.approval` describes actual submission or withholding. Report approval as submitted only after confirmation. The immutable bundle captures notifications received before saving; later receipts are returned by the workflow. GitHub recovery state remains in `github.json`, without rewriting the accepted bundle after each update.

## Read the code

Start at `src/review/workflow.ts` to follow the sequence and its failure boundaries.

| File | Responsibility |
| --- | --- |
| `workflow.ts` | Metadata, explicit full/split sequence, named steps with direct prompt imports and schemas, the shared agent wrapper, saving and progress timing |
| `contracts.ts` | Shared schemas and types for inputs, answers, saved data and delivery results |
| `validation.ts` | Pure evidence, rule coverage, finding-accounting and approval-policy checks |
| `github.ts` | GitHub publication through the existing helper and confirmation receipts |
| `utils.ts` | Text formatting, checksums, quoting and host notification helpers |
| `pi-workflow.d.ts` | Declarations for Pi’s official script globals, without an implementation |

`agent()`, `parallel()` and the launch `args` are supplied by pi-subagents. Their used signatures are declared in `pi-workflow.d.ts`. The coordinator calls named functions such as `researchReview`, `assessReadability` and `acceptReport`. Each function shows its imported Markdown instructions, Pi display group and schema together. Stage names identify results and diagnostics; they do not select prompts or scheduling behaviour. Compound stage names use camelCase, including `researchCheck`, `systemFit` and `splitPlan`.

Our `reviewAgent` wrapper prepends shared Markdown rules and explicit review context, pins revisions in the supplied schema, validates the answer and makes at most two fresh attempts. It does not choose tasks, update progress or accept results. Step, wrapper and delivery calls use object parameters. A package-local `AGENTS.md` is authoring guidance, not an assumed automatic source of worker criteria.

There is one typed current review step for failure reporting. Progress is derived from accepted results and recorded failures, with the current update supplying running or blocked status. Successful saving comes from the returned validation command, and accepted setup determines when delivery may start. There is no stored progress map or delivery-started flag. The five parallel assessments share a progress entry; successful siblings are retained if another assessment fails, then downstream work stops. Other review steps report their own running, complete or blocked status. There is no separate milestone state or ambient `phase()` call. Workers’ `phase` options only group their cards in Pi’s UI, so several workers can appear under “Reporting” without adding another workflow state. Individual retry details appear in worker labels and the saved attempt records.

GitHub operations return their own receipts. The final publication outcome is a local return value passed explicitly to the caller and the final host notification; progress updates cannot replace it. Delivery state retains only notification receipts, host notification availability and the GitHub request sequence. Review completion and delivery success remain separate, so a validated saved review can report rejected or uncertain publication. If the final receipt is unknown, its URL may be absent even when an earlier progress comment exists; the returned reason points to the saved `github.json` state for inspection.

### Edit worker instructions

Edit the named Markdown file under `skills/review-workflow/prompts/`, such as `research.md`. `common.md` contains shared rules, `assessment.md` contains shared assessment guidance and `reporting.md` contains shared report guidance. Each named function imports its task directly, adding the shared guidance and fixed templates it needs. The experimental skill’s `criteria.md` is an index rather than a second copy of those instructions. The original review skill stays unchanged.

The build embeds these files using esbuild’s text loader. Run `npm run build` after editing prompts or templates; `npm run build:check` detects stale embedded text. Workers receive the instructions in their prompt and do not need to open Markdown heading links at runtime. Repository rules, specialist skills, wrapper guidance and caller-supplied context remain runtime evidence for workers to inspect.

### Why a worker saves review files

Pi’s workflow VM cannot call Node’s filesystem APIs or run shell commands directly. `saveReviewFiles` therefore asks a tool-equipped worker to copy the accepted data to disk. It does not ask for another review. Its command gate checks the actual files before publication, and the workflow does not retry this worker because a failed response can follow completed filesystem work.

The saved files are:

| File | Contents |
| --- | --- |
| `bundle.json` | Pinned inputs, accepted stage answers, failures, retry records and notification receipts collected before saving |
| `<stage>.md` | Each accepted stage’s readable Markdown, such as `researchCheck.md` |
| `review-report.md` | The accepted final report, or split plan for a split-only review |
| `incomplete.md` | The explanation when required reviewer work could not finish |
| `approval.json`, `summary.md`, `inline.json` | Accepted decision and publication payloads, when a decision exists |
| `result.json` | Review outcome, validated file locations and integrity fingerprint |

“Bundle” means the accepted review data, while “artefacts” means these saved files. The workflow returns the validated report path and decision, then separate publication and notification results. A deterministic writer would need a host tool or extension API; no new host integration is introduced here.

### What validation does

Pi supplies the structured-output and shell-gate mechanisms. The checks we put inside them are review-specific:

| Checks | Why they exist | Where they run |
| --- | --- | --- |
| Schemas | Require fields, known outcomes and bounded collections | Pi’s structured-output contract and `contracts.ts` parsing |
| Review policy | Reject missing rule coverage, lost findings or approval that contradicts required fixes | `validation.ts` before accepting a stage |
| Saved files | Confirm files match accepted answers, pinned Git state and actual rule indexes | `scripts/review/validate-bundle.ts`, after saving and before publication |
| Publication receipts | Confirm the helper’s state matches the operation and approval being reported | `scripts/review/github.ts` |

The saved-file gate reuses the same review-policy functions rather than maintaining a second set of rules. Shape checks do not establish that evidence is true, and policy checks do not prove the model followed every instruction. These checks go beyond merely requiring stages to run; they preserve the agreed report, finding and approval guarantees.

The restricted workflow VM cannot access Node or the filesystem. `scripts/review/validate-bundle.ts` owns the Node-only filesystem and Git checks; `scripts/review/github.ts` bridges helper operations. `workflow.ts` owns the literal `meta` declaration. `scripts/build/workflow.ts` copies it into the generated header and bundles authored TypeScript into `workflows/review.js`. Edit TypeScript and run `npm run format` (oxfmt), then `npm run build`; prompt and template changes also require a rebuild. `format:check` and `build:check` reject stale formatting or generated output. Authored `if` statements always use braces; use `switch` for branches over stages or outcomes.

## Verification limits

Run `npm test` for deterministic checks. The test boundaries are:

| Suite | Real behaviour | Simulated boundary |
| --- | --- | --- |
| `tests/review-workflow.test.ts` | Generated script in pi-subagents, stage ordering, saving, GitHub command bridge and command gates | Worker answers, host notifications and Python/gh subprocess responses |
| `tests/review-publication.test.ts` | Saved-file checks, publication restrictions and helper receipt validation | Python/gh subprocess responses |
| `tests/review-bundle.test.ts` | Temporary committed repositories, copied rule indexes and damaged disk files | Accepted worker evidence |
| `tests/review-stages.test.ts` | Pure stage and approval guards, resource defaults | Explicit assessment inputs |
| Original and copied `test_github_progress.py` | Existing helper publication and recovery mechanics | GitHub API responses |

These checks do not prove model judgement or actual remote delivery. Fixture JSDoc explains what each substitute can establish.

Before this orchestration refactor, a local-only Pi run on 28 October 2026 completed all 14 review stages and the writer without retries. The known addition defect survived consolidation, editorial reduction and report acceptance. Its decision was `changes_needed`, and its saved files passed the Node gate. Artefacts and transcripts remain under `/tmp/review-workflow-live-j7dsm3fi`.

The generated-runtime and saved-file suites check the refactored orchestration; there has been no new model run of the flattened code. Real notification and GitHub delivery remain deliberately unverified, as agreed. The older live run described in the handoff predates the reduced implementation and does not validate this version.

Source restrictions remain prompt-enforced, and the checksum detects accidental writer changes rather than malicious edits.
