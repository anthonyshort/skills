# Review workflow

This Pi package provides the experimental named `review` workflow for pi-subagents 0.22.0. Invoke it through `SubagentWorkflow` in an existing Pi session. It runs the required review steps and returns the accepted report, approval assessment and partial evidence in memory. Event subscribers handle GitHub comments and host notifications.

Workflow instructions live in `src/review/prompts/`. The workflow reuses the original review skill’s rules and report templates. The original skills stay unchanged; there is no copied skill or separate launcher.

## Install and run

```sh
npm install
pi install npm:@tintinweb/pi-subagents@0.22.0
pi install /absolute/path/to/skills
```

Enable package workflow discovery in pi-subagents and reload Pi. Invoke `SubagentWorkflow` with:

```json
{
  "name": "review",
  "args": {
    "packageRoot": "/home/me/dev/skills",
    "repository": "/home/me/dev/app",
    "target": "owner/app PR #42",
    "base": "BASE_SHA",
    "head": "HEAD_SHA",
    "runId": "app-pr42-review",
    "github": { "repository": "owner/app", "pr": 42 },
    "publication": "publish",
    "notification": { "messageKey": "app-pr42-review" }
  }
}
```

Use full base and head commit IDs covering the whole PR and a clean checkout at that head. Use a fresh Pi workflow execution for each review. `runId` identifies the review and supplies the default notification key, `review:RUN_ID`; it does not control Pi’s worker caching or resume behaviour.

For a branch or diff without a PR, omit `github` or set it to `null`. Pass `notification: null` to disable host updates. If omitted, notifications use the default key. Optional `contextFiles` supply absolute paths to requirements. `wrapperSkillRoots` adds wrapper guidance and rule indexes. `skillRoot` defaults to `PACKAGE_ROOT/skills/review`.

`publication: "local-only"` suppresses both GitHub and host notifications and returns the review to the caller. `comment-only` allows comments and notifications but forbids automatic approval. `publish` allows publication, subject to the approval policy and the configured tool capabilities.

Currently the GitHub subscriber integrates only `github_comment`. Inline comments and actual review submission await the separate Picco plugin’s tool contracts. An `approve` assessment is a recommendation, not confirmation that approval was submitted.

## Required work and validation

The full route is setup → research → research check → five parallel assessments → sequential rules → consolidation → draft → editorial reduction → report acceptance → approval assessment. Oversized changes take the shorter setup → split plan → approval assessment route.

Each named step shows its prompt, result schema and any specific validation beside the agent call. `reviewAgent` adds common rules and pinned context, parses the result and runs the selected checks. An invalid result gets one fresh retry, at most two attempts total. Exhaustion stops dependent work and preserves accepted partial results, including successful parallel siblings.

Code enforces:

- Structured answers pinned to the requested base and head, evidence for verified checks and unique finding IDs.
- A documented exception for oversized full reviews and unique setup rule paths.
- All five required assessments before rules or reporting.
- Exactly one accounted result for each rule in setup’s inventory, including explicitly skipped rules.
- Explicit accounting for earlier findings in the accepted report.
- Consistent approval outcomes and inline-comment provenance from accepted bug findings.

Workers inspect the actual checkout, diff, rule indexes, sources and CI under their instructions. Code checks the consistency of their answers; it does not independently inspect Git or the filesystem, prove their evidence true or establish that every instructed source investigation occurred. Missing evidence remains a recorded gap. Template headings are not validated.

## Events and delivery

The outer coordinator creates one awaited `ReviewEvents` instance and passes it to notifications, the GitHub comment and review execution. Destinations subscribe themselves. The review sequence calls named steps through the step coordinator, which owns accepted evidence, attempts and failures.

```ts
await steps.runStep({ step: "consolidation", run: consolidateReview });
await steps.runStep({ step: "draft", run: draftReport });
await steps.runStep({ step: "editorial", run: editReport });
await steps.runStep({ step: "report", run: acceptReport });
```

`runStep` emits `stepStarted`, runs and accepts the validated result, then emits `stepAccepted`. A task failure is recorded before `stepFailed`, and dependent work stops. The five assessments share one lifecycle around their parallel barrier. Events carry snapshots of accepted evidence rather than another mutable progress state.

After execution returns, `reviewCompleted` passes the review directly to the GitHub subscriber. That subscriber publishes the final comment and emits `publicationFinished`. Notifications send their final update on that event, after the GitHub outcome is known. Subscribers run sequentially, and nested emissions finish before their parent emission continues. Delivery failures do not retry review steps.

Progress starts only after setup accepts the comparison and full/split route. Pi’s optional `phase()` groups workers for display; it is not workflow state. There is no separate milestone model.

### GitHub comments

The separately installed Picco plugin supplies:

```ts
github_comment({
  repository: "owner/repo",
  pullRequest: 42,
  body: "Review starting",
});
// Returns { commentId: "123" }

github_comment({
  repository: "owner/repo",
  pullRequest: 42,
  commentId: "123",
  body: "Updated progress or final report",
});
```

`github.ts` keeps the returned string ID in memory. It gives a tool-equipped agent the exact body and arguments for each update. The plugin owns authentication and HTTP. The workflow has no HTTP client, Python bridge, saved payloads or persistent GitHub state file.

The final comment contains the summary, accepted report and approval assessment. Incomplete reviews withhold final publication and retain the interruption update. If comment creation has an uncertain outcome, later writes are disabled to avoid creating duplicates. Comment identity lasts for this workflow execution; a fresh execution can create a new comment. There is no cross-run recovery subsystem or continuation-comment splitting. Oversized bodies depend on the plugin’s handling and may fail delivery without losing the returned report.

### Host notifications

A tool-equipped worker calls the host’s keyed broadcast API:

```ts
notify({ action: "send", messageKey: "app-pr42-review", text: "…" });
```

The authenticated host chooses channels, including Telegram when configured. Repeated sends edit the same message within the same host scope and message key. An unavailable tool or changed scope disables further host sends. The workflow records actual broadcast receipts and does not emulate missing tools through shell or HTTP calls.

## Returned output

The caller receives `input`, review `status`, accepted `stages`, failed `attempts`, `failures`, the final `report` Markdown or `null`, the `approval` assessment or `null`, the GitHub `publication` outcome and notification receipts. An incomplete review can still contain useful accepted evidence. Review completion and delivery success are separate outcomes.

The workflow writes no report files. A caller that needs a saved report can save the returned Markdown. There is no file-writing agent, bundle, fingerprint, filesystem gate or generated publication payload directory.

## Read and edit the code

| File | Responsibility |
| --- | --- |
| `src/review/workflow.ts` | Official metadata, outer coordinator, visible review order, step coordinator, named prompts and retry wrapper |
| `src/review/contracts.ts` | Zod schemas and inferred types for inputs, answers, events and returned results |
| `src/review/validation.ts` | Evidence, rule coverage, finding accounting and approval checks selected by named steps |
| `src/review/github.ts` | Self-subscribing GitHub comment and private final publication through Picco tools |
| `src/review/utils.ts` | Awaited events, notifications, shared progress rendering and report coverage text |
| `src/review/pi-workflow.d.ts` | Declarations of the official Pi globals used here |
| `scripts/build/workflow.ts` | Compile TypeScript and embed Markdown into the JavaScript Pi loads |

`agent()`, `parallel()`, `phase()` and launch `args` come from pi-subagents. All other functions are our review code. No changes to pi-subagents are required.

Edit the named Markdown prompt imported by each step. `common.md` contains shared rules, `assessment.md` shared assessment guidance and `reporting.md` shared report guidance. Original report templates are embedded directly. Rule files, specialist skills, wrapper guidance and caller context remain runtime evidence for workers to inspect.

Run `npm run build` after source or prompt changes. `workflows/review.js` is generated JavaScript required by Pi’s restricted workflow VM; it is separate from the removed saved review bundle.

## Checks and limits

`npm test` runs TypeScript checking, oxfmt, generated-output freshness and three colocated unit tests. `validation.test.ts` covers an omitted rule and an explicitly skipped rule. `utils.test.ts` checks that nested awaited events finish before execution continues. These are small unit boundaries without a simulated Pi runtime or delivery fixtures.

The current implementation has no new live Pi or real delivery validation. An older live model run predates these refactors and does not validate this implementation. GitHub tool availability, inline/review submission integration and end-to-end model behaviour remain unverified.
