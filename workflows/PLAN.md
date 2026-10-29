# Plan for the experimental review workflow

Build a complete alternative to running the existing review skill. The user starts the experimental review once; the pi-subagents workflow schedules the required work, validates its outputs, maintains Telegram and GitHub progress, and publishes the accepted results. The calling agent returns the outcome without having to remember the remaining review steps.

Keep the existing review skill working unchanged while the experimental version is tried. Simplicity and readability are acceptance criteria alongside correct orchestration. Model judgement remains necessary: validation can enforce stages and consistent evidence accounting, but cannot prove that a model inspected code honestly or reached the right conclusion.

This plan supersedes the handoff’s caller-owned publication boundary. Keep the smaller in-session execution model. Do not restore the standalone runner or custom GitHub publisher.

## Starting point

The branch is `anthonyshort/review-workflow`, with draft PR [#4](https://github.com/anthonyshort/skills/pull/4). Commit `0995471` removed the standalone runner and duplicate publication implementation. Its retained coordinator already schedules setup, research, five assessments, a sequential rule pass, consolidation, drafting, editorial review, report acceptance, decision and validated saving.

The workflow currently reads the original skill by default, sends optional progress through an assumed host notification API, and leaves publication to the caller. It has deterministic runtime and saved-file tests. The reduced implementation has not completed a real model run. The older live run described in `HANDOFF.md` does not validate this version.

## The user experience

Keep the ordinary `review` skill available. Add an explicitly experimental `review-workflow` skill so the user can request either approach in the same Pi installation. Retain the existing named workflow `review`, documenting that skill names and workflow names are separate discovery mechanisms.

The experimental skill explains how to launch `SubagentWorkflow` with `name: "review"`. Its launch instructions resolve the target, pinned revisions, output location and caller restrictions into the workflow’s inputs. This is bounded invocation preparation; the calling agent does not coordinate assessments or delivery. Document a concrete invocation example and the tools required in the existing Pi session. Verify discovery and invocation in Pi before calling the experiment usable.

For a PR, the default behaviour follows the existing skill: one live GitHub progress comment, final report and supported new inline bugs, with approval submitted only when the policy and caller restrictions allow it. Telegram updates use the configured host notification tool and its host-bound channels, with a stable run key by default and an explicit option to disable updates. Do not invent a recipient or silently send to an unconfigured destination. A branch or diff review without a PR still produces a validated local report and can use configured Telegram updates.

Local-only, staged and other explicit restrictions remain authoritative. Define local-only as no external delivery unless the caller explicitly requests an exception, including Telegram. The existing helper has no pending-review staging command: a staged request must either use an existing supported staging tool or return saved output with a visible not-submitted outcome. Never translate it into a normal `finish` call. Preserve existing helper semantics and document unsupported modes.

## 1. Isolate the experimental skill

Copy `skills/review/` to `skills/review-workflow/`, including its templates, rules, publication helpers and helper tests. Change the copied skill’s frontmatter name and description so it is deliberately selected for the experiment. Read and apply the relevant directory instructions before copying or editing.

Adapt the copied instructions to the workflow’s responsibilities:

- Put launch instructions first and retain the substantive review criteria and assessment deliverables.
- Explain which tasks each workflow stage performs. Remove instructions that would make a worker recursively coordinate the whole review or delegate another set of agents.
- Assign progress and publication to workflow-owned delivery workers. Assessment workers remain read-only and cannot publish.
- Keep links to shared specialist skills where appropriate. Update internal links, rule indexes and template paths to the copied tree.
- Keep the copied helper implementation unchanged initially. Use it for GitHub operations rather than writing another publisher.

Point the workflow’s default `skillRoot` at the copy. Check worker prompts, rule enumeration, template loading, validator paths and fixtures for accidental references to the original. Existing wrapper skills remain unchanged; explicitly supplied wrapper guidance must still work. Do not silently reroute an existing wrapper’s ordinary review invocation into the experiment.

The duplicate tree is an intentional experimental snapshot. Do not add an automatic synchroniser or a shared abstraction to keep the two skills in step. Record the source revision and intentional differences in the workflow guide. Reconsider sharing only after trying the workflow. Test repository link discovery using a temporary home, keeping the real skill installation unchanged during automated checks.

## 2. Account for every required step

Add a concise coverage table to `workflows/README.md`. Map the copied skill’s requirements to the responsible worker, accepted output and code guard, and distinguish prompt instructions from executable validation. Cover these areas:

| Requirement | Workflow responsibility |
| --- | --- |
| Full comparison, revision pinning, initial risks and size policy | Setup, with a permitted-exception or split-only branch |
| Fresh research or justified reuse of a previous complete review | Research, including source coverage and gaps |
| Read and validate research before assessments | Explicit acceptance boundary before the assessment barrier |
| Product, system fit, simplicity, readability and correctness | Five required assessments, each with checks, evidence and exclusions |
| Complete rule inventory and one sequential pass | Rules worker and indexed coverage validation |
| Independent claim checking, disagreements and duplicate findings | Consolidation, with finding provenance and unresolved gaps |
| Complete report, editorial reduction and restoration of lost evidence | Draft, editorial and report acceptance |
| Seven approval checks and outcome policy | Decision worker and approval guards |
| Real saved files matching accepted data | Writer and Node validation gate |
| Progress, final publication and confirmed delivery outcome | Workflow-owned delivery operations |

Inspect the actual code behind each row. In particular, determine whether research acceptance and follow-up on weak worker evidence are adequately represented today. Add only the bounded operation needed for a demonstrated gap. Do not treat a schema-shaped answer as proof that all required guidance was followed, or turn this into a general task engine.

Preserve validated research reuse, wrapper rule coverage, the over-2,000-added-lines policy and the shorter split-only route. Keep gaps visible rather than forcing invented evidence to make a stage pass.

## 3. Make delivery ownership explicit

Inspect the actual notification tool contract in the configured Pi environment, including tool availability to subagents, create/update behaviour, message identity and returned receipts. The current `notify` event shape is an assumption. Verify it before wiring Telegram delivery. If that host API is still being implemented separately, document the dependency and continue with GitHub and local workflow work.

Use two concrete existing mechanisms:

- Telegram progress calls the host notification tool using one stable message identity per run.
- GitHub progress and final publication call the copied `github_progress.py` helper using one state file in the review artefact directory.

The workflow VM exposes scheduling capabilities rather than filesystem or transport access. Schedule narrowly assigned delivery workers to invoke those mechanisms. This still makes delivery a required workflow action; it does not rely on the calling agent remembering to send an update. Confirm the tool result or helper state before reporting success. Do not trust a worker’s unsupported claim that delivery happened.

Extend the Zod input and result contracts only for information needed by these operations: PR identity, publication restrictions, configured notification destination and confirmed delivery results. Keep review completion, publication status and approval submission distinguishable. A complete review with failed publication remains a complete local review with incomplete publication. An approval assessment is not confirmation of submitted approval.

Do not create a destination registry, transport adapter framework, second recovery store or custom GitHub client. Do not modify pi-subagents or the original skill and helpers.

## 4. Run delivery at defined points

The intended execution sequence is:

1. Parse the inputs and restrictions; complete setup and pin the reviewed comparison.
2. Start GitHub and Telegram progress where enabled, using the full or split-only checklist selected by setup.
3. Run research and accept its brief, then run all five assessments before the sequential rule pass. Alternatively, run the split plan without full implementation review.
4. Update progress at meaningful boundaries. Show actual work status and blocked stages without provisional findings.
5. Consolidate evidence, draft, edit and accept the canonical report; then complete the decision assessment.
6. Save the accepted bundle and derived files. Require the existing Node gate to pass before any final results are published.
7. Refresh the relevant head, discussion and CI as required by the publication policy. Never publish stale approval. If new facts affect the recommendation, report the restriction and require a refreshed assessment rather than silently changing the accepted report.
8. Invoke the copied helper’s `finish` command with the validated summary, report, decision and supported inline findings. Reuse the existing helper’s publication and recovery behaviour.
9. Finish Telegram progress with the actual review outcome, report location and confirmed GitHub links or delivery limitations. Return the same distinctions to the caller.

For exhausted review stages, preserve accepted partial evidence, save the incomplete output and update progress as interrupted where possible. Do not publish an incomplete review as a finished assessment. If the saved-file gate fails, stop final publication and attempt a blocked progress update without hiding the validation failure.

Before publication, revalidate the files being consumed. Keep publication receipts separate from the immutable accepted bundle, using the helper’s existing state and a returned delivery result. Document where to inspect them. Avoid rewriting and re-fingerprinting the entire bundle after every external update.

## 5. Bound failure and recovery behaviour

Keep one fresh retry for invalid review-stage output. Preserve successful assessment siblings when another assessment fails, and stop dependent stages after retry exhaustion. Do not reuse an invocation ID across fresh launches where Pi’s replay could bypass gates.

Delivery failure must not rerun review stages or change findings. Attempt each progress update once; record rejected or uncertain delivery and continue the review. A failed destination must not prevent an attempt to update the other destination. Serialize calls that share the GitHub helper’s state file. An uncertain send must not create another progress message through a blind retry. Recover using the existing message identity or helper state when supported.

For final publication, use the helper’s saved state and existing confirmation/recovery checks. Do not wrap publication in the assessment retry loop. If delivery remains uncertain, return the report path, state location and concrete recovery action. A later publication attempt must recheck current facts and use the same run state while that assessment remains valid. Do not add an autonomous polling loop or a process manager.

## 6. Simplify the implementation as it changes

Read from `workflows/README.md` through `src/review/workflow.ts` and the modules it calls. Assess the work required to follow the complete path, including the tests. Keep the top-level sequence visible and operations named for what they do.

Retain TypeScript and derive wire types from Zod. Use useful multiline JSDoc to explain responsibilities, acceptance boundaries and unexpected failure behaviour. Keep prompts beside their stage definitions and guards beside the data they validate. Remove redundant flags or pass-through helpers only when their removal makes the actual flow easier to follow.

Keep concrete GitHub operations in `github.ts` and progress timing in `workflow.ts`, with final publication called explicitly by the coordinator. Keep contracts, stage guards and saved-file validation separate where their existing responsibilities help understanding. Do not split files to meet line-count targets or introduce generic lifecycle hooks.

## 7. Test the behaviour that can regress

Use the existing generated-runtime and real-filesystem suites. Add focused cases for changed behaviour, explaining the boundary of each fixture and assertion:

- The experimental skill is discovered separately, and default prompts, rule indexes and templates resolve to its copy.
- All required stages, ordering, assessment barrier, bounded retries and accepted partial results remain intact.
- Progress starts after revisions and review depth are known, uses stable message identities and records failed delivery without repeating assessment work.
- Final publication consumes validated accepted files and runs only after a successful save gate. Failed saving prevents it.
- Local-only and staged restrictions, split output, incomplete review and missing delivery tools behave as documented.
- New head or CI evidence cannot produce stale approval, and unknown publication success cannot be labelled confirmed.
- The final return distinguishes review outcome, publication outcome and submitted approval, including URLs and recovery information where available.

Run copied helper tests as well as the original helper compatibility suite. Use a small regression only if helper behaviour must change in the experimental copy. Canned delivery answers establish orchestration, not successful GitHub or Telegram delivery.

After source changes, rebuild generated JavaScript and run `npm run typecheck`, the focused workflow and saved-file suites, relevant helper tests, `npm run build:check`, `npm run format:check` (oxfmt) and `git diff --check`. Run the full existing test command before updating the PR. Inspect the resulting diff for accidental original-skill changes and readability regressions.

## 8. Try it in a real Pi session

Launch the named workflow from the experimental skill inside an existing configured Pi session, using a small fixture change with a known defect. Confirm the worker receives the required tools, the defect survives consolidation and editorial reduction, the final decision withholds approval, and the saved-file gate checks the current files. Do not recreate a standalone runner to perform this test.

Real delivery trials are optional follow-up work, not an implementation requirement. The user chose to rely on existing helper tests and workflow integration checks rather than add code or infrastructure for live delivery testing. If useful later, exercise delivery against a designated test PR and configured Telegram destination. Confirm updates edit the same message, GitHub final publication uses the accepted report, supported new bugs receive valid inline anchors, and the returned URLs and submission status match actual remote state. Start with a defect case that cannot approve; test approval only on a separate eligible case within the existing policy. Exercise one failed delivery path and confirm review stages do not repeat. Also exercise local-only and split-only behaviour.

The plan itself authorises no test messages or PR reviews. Use explicitly designated destinations during implementation. Record exactly which current revision and paths were exercised, with links or artefact paths. Report unavailable integrations as outstanding checks. Keep the older live Pi run separate from this evidence.

## Orchestration simplification

Use Pi’s official `agent`, `parallel` and `args` globals directly, with narrow TypeScript declarations in `pi-workflow.d.ts`. Keep the full/split sequence visible in `workflow.ts`. Give each step a named function containing its direct Markdown prompt import and explicit schema. Use one small `reviewAgent` wrapper only for common rules, revision pins, validation and two attempts; do not select prompts or scheduling behaviour from stage names. Use object parameters for step, wrapper and delivery operations. Plain accepted results and delivery state replace the custom host interface and reporter/publisher factories. Progress follows the same typed steps used for failure reporting. The worker `phase` option is only a Pi display group; there is no separate milestone state or ambient phase tracking.

Keep all review and delivery schemas and types in `contracts.ts`. Put metadata and prompts beside the coordinator in `workflow.ts`, pure policy checks in `validation.ts`, GitHub operations in `github.ts`, and text/host-notification helpers in `utils.ts`. Keep Node-only file and Git validation in `scripts/review/validate-bundle.ts`. Keep the writer as a separate function in `workflow.ts`, with saving status owned by the coordinator. Publication and final notification are explicit operations after validated saving. Preserve the Node bridges, substantive stage/approval guards and shared pure text functions. The generated-runtime suite checks this refactor; the earlier model run is evidence for the review criteria and graph, not a new live run of the flattened implementation.

## Implementation order and completion criteria

Implement in reviewable steps:

1. Copy and adapt the experimental skill, change resource defaults and document the requirement coverage map.
2. Resolve concrete orchestration gaps and simplify the existing review path while preserving its guards.
3. Wire workflow-owned progress through the actual host tool and existing GitHub helper.
4. Add final publication after validation, explicit delivery results and focused failure coverage.
5. Rebuild, run checks and complete the current local-only live Pi trial. Keep real delivery explicitly unverified.
6. Update the workflow guide and draft PR #4 to describe the complete experimental flow and any remaining concrete checks.

The experiment is ready to try when the user can select `review-workflow`, launch the packaged workflow and receive a validated report plus an accurate delivery outcome without manually invoking the original skill afterwards. Readiness also requires a current live run, distinct skill discovery, preserved restrictions and readable code whose required sequence can be understood from the coordinator and guide.

Keep `HANDOFF.md` and `HANDOFF-PROMPT.md` as local transfer notes outside commits. Leave the original skills unchanged and do not modify pi-subagents. Preserve the PR’s baseline relationship; retargeting to `main` still requires the baseline work to be integrated.


## PR feedback plan, 29 October 2026

This section records the agreed changes from the nine comments on commit `67d477f`. It supersedes the earlier recommendations about linked prompt sections and grouped progress milestones. The implementation now uses one typed current step, direct embedded Markdown prompts and the clarified file-saving boundary.

### 1. Type the workflow state and simplify its names

Addresses [typed active state](https://github.com/anthonyshort/skills/pull/4#discussion_r4414980709), [typed progress stages](https://github.com/anthonyshort/skills/pull/4#discussion_r4415005183) and [splitPlan](https://github.com/anthonyshort/skills/pull/4#discussion_r4414987036).

- Type the current review step using the schema-derived stage names, plus the coordinator’s assessment barrier. Give progress steps and statuses explicit unions rather than accepting arbitrary strings. Derive status subsets from existing schemas where their meanings match; do not create duplicate wire formats.
- Use camelCase for compound stage identifiers: `splitPlan`, `researchCheck` and `systemFit`. Update schemas, accepted-result properties, diagnostics, saved-stage filenames, validation and fixtures together. This experimental format has no compatibility requirement, so avoid an alias or translation layer.
- Keep all shared types and schemas in `contracts.ts`, object parameters at call sites and braces on every conditional body.

### 2. Remove overlapping phase and progress tracking

Addresses [phase/stage/milestone overlap](https://github.com/anthonyshort/skills/pull/4#discussion_r4414997892) and [repeated updates](https://github.com/anthonyshort/skills/pull/4#discussion_r4415003854).

Pi’s ambient `phase()` sets a default group for later workers. Every current worker already supplies its own `phase` option, which overrides that default. Remove the redundant coordinator `phase()` calls and retain the explicit group beside each worker prompt and schema.

Use progress entries for actual review steps, with one entry for the five-assessment barrier. Remove the separate grouped `activeMilestone` state and retain one typed current step. Research-check, drafting and editing then report their own status instead of sharing an outer research/report milestone. This produces more detailed external progress updates; no new delivery mechanism is needed.

Use a small coordinator-local function to set the current step and mark it running together. Keep completion and acceptance visible in the coordinator. Do not add a stage registry, scheduling class or name-based prompt dispatch. A failed step marks that same progress entry blocked and retains its exact diagnostic.

### 3. Keep assessment failure handling small

Addresses [whether one failed assessment should fail the review](https://github.com/anthonyshort/skills/pull/4#discussion_r4415022504).

It already does: any missing required assessment prevents rules, reporting and the decision from running. Pi’s `parallel()` waits for all workers and returns `null` for ordinary failed tasks. Preserve successful sibling answers, then check for missing assessments and stop downstream work. The writer can save those accepted partial results for inspection.

Keep the existing bounded worker retries and this small barrier check. Add a short comment explaining Pi’s null results. Do not implement cancellation, retries of the whole assessment group or a custom parallel wrapper. Removing partial-result handling would discard useful work without simplifying Pi’s failure behaviour.

### 4. Make Markdown files the source of worker instructions

Addresses [editable stage Markdown](https://github.com/anthonyshort/skills/pull/4#discussion_r4415068056) and [embedded common rules](https://github.com/anthonyshort/skills/pull/4#discussion_r4415077369).

Split the copied experimental criteria into files under `skills/review-workflow/prompts/`: shared rules and one file per named review step. Move task-specific prose out of TypeScript into those files, including the independent research check, consolidation, editorial pass and decision instructions currently supplied by the coordinator. Each file should contain the instructions needed for its task without depending on another stage’s Markdown heading.

Import each Markdown file directly in its named step function’s module and pass its text to `reviewAgent`. Import shared rules once and prepend them in that wrapper. Use esbuild’s standard text loader and a narrow Markdown import declaration so the generated workflow embeds the text at build time. Do not add a runtime file loader, heading parser, template engine or prompt registry. Embed the fixed report template where reporting workers need it as well.

Keep dynamic pinned inputs, accepted results and caller context in the wrapper. Repository rules, caller-supplied files and specialist guidance remain runtime evidence for workers to inspect; those cannot all be embedded at package build time. Preserve their explicit selection and coverage requirements.

Replace the experimental `criteria.md` with an index if it still helps navigation, and update its entry skill to explain the new files. Avoid retaining a second editable copy of the same instructions. Leave the original review skill and pi-subagents unchanged. Editing Markdown requires rebuilding `workflows/review.js`; `build:check` must detect stale embedded text.

### 5. Explain the saved files and the writer boundary

Addresses [why an agent saves the bundle](https://github.com/anthonyshort/skills/pull/4#discussion_r4415088985).

The current Pi workflow VM has no Node/filesystem API or shell execution global. Direct `writeFile` calls from `workflow.ts` therefore are not available. A host-side tool call is required, although serialising accepted JSON does not inherently require model judgement.

Retain the existing writer worker for this iteration rather than introducing an extension, runner or new host API. Rename the operation to `saveReviewFiles` and explain its inputs and outputs in JSDoc, its prompt and the workflow guide:

- The accepted review data, currently called a bundle, contains pinned inputs, successful stage answers, failures, retry records and notification receipts.
- `bundle.json` saves that data; individual stage Markdown files make the evidence readable.
- `review-report.md` is the accepted report or split plan; an incomplete run also saves an explanation.
- `approval.json`, `summary.md` and `inline.json` are the accepted decision and publication payloads when available.
- `result.json` contains the outcome, validated file locations and integrity fingerprint returned to the caller.

The writer copies accepted values without performing another review. The existing command gate validates the actual saved files before publication. Keep that gate and avoid writer retries, because a failed response may follow completed filesystem work. Do not add a new persistence framework merely to remove this worker. A deterministic host-side writer is a separate option if Pi later exposes an appropriate tool boundary.

### Implementation order and checks

1. Type and rename state, then remove redundant ambient phases and grouped milestone tracking.
2. Extract and embed Markdown prompts, preserving all required criteria and the explicit named-step sequence.
3. Clarify the writer and saved-file contract without changing publication or delivery semantics.
4. Update focused tests for typed names, exact blocked-step progress, assessment partial results and embedded prompt content. Keep test boundaries explained. Verify that the generated VM executes without runtime Markdown access and that stale embedded instructions fail the build check.
5. Run oxfmt, the affected workflow/stage/saved-file suites, TypeScript checks, the full existing test command and the generated-output check. Rebuild the packaged JavaScript and inspect the final diff for accidental original-skill changes.
6. Update draft PR #4 and its guide with the resulting design and actual checks. Do not send real notifications, claim a new live model run or include either local handoff file in a commit.


### Implementation evidence

Implemented the feedback with one typed current step, no ambient phase calls or milestone state, direct Markdown imports, camelCase stage identifiers and an explained `saveReviewFiles` boundary. The original review skill and pi-subagents remain unchanged. Direct Zod namespace imports let esbuild remove unused exports, keeping the embedded workflow below Pi’s script-size limit without new dependencies.

`npm test` passed all 206 cases. After the final prompt and test refinements, the focused workflow/stage/publication suite passed all 75 cases again. TypeScript, oxfmt, generated-output, braced-conditional and whitespace checks passed. A temporary research Markdown edit correctly made `build:check` reject stale generated output, and restoring it restored a passing check. Both full and split-only prompt tests run without runtime prompt files. No new live model run or real delivery trial was performed.


## Reduce overlapping state

Keep the explicit named-step sequence. Derive completed progress from accepted stage answers, blocked progress from recorded failures, and successful saving from the returned validation command. The current update supplies only transient progress, such as a running step or a failed save. Build a temporary display snapshot for each send rather than storing a second mutable progress map.

Start external delivery only when setup exists in the accepted results. Remove the separate delivery-started flag. Keep delivery bookkeeping limited to notification receipts, whether host updates remain available and the GitHub request sequence.

GitHub operations return their own receipts. The final finish or interruption result is the publication outcome returned to the caller and passed explicitly to the final host notification. Later progress operations cannot overwrite it. A saved review and its delivery outcome remain separate; failed or uncertain delivery never repeats review work.

Preserve stage order, the assessment barrier, accepted partial evidence, bounded retries and the saved-file gate. Check partial-assessment progress after saving, and final rejection reporting after both successful and failed interruption updates. Keep the original skills and pi-subagents unchanged; add no state-machine dependency or second lifecycle engine.

The state-ownership change passed all 207 tests, including final refusal preservation after both successful and failed interruption updates. TypeScript, oxfmt, generated-output, braced-conditional and whitespace checks passed. Generated JavaScript was rebuilt. No new live model run or real delivery was performed.


## Awaited review lifecycle callbacks

This supersedes the earlier per-worker phase plumbing and manual progress calls. Keep the review’s execution sequence separate from external delivery. `reviewWorkflow({ input, onEvent })` owns accepted results, retry records and failures. A small `runStep({ step, run })` helper emits started/accepted/failed events around a direct named function call and records accepted evidence in one place. The full/split sequence contains those calls without manual progress updates or assignments into an accepted-results object.

Each event carries a stable read-only snapshot of accepted stages and failures. Await the callback before continuing. The assessment barrier emits one lifecycle around all five workers, retaining successful siblings before failure. Keep callbacks outside agent retries. Replace the report object when appending coverage so earlier event snapshots remain stable.

The outer `runReviewWorkflow` coordinator switches on those events, selects Pi’s ambient display group and sends progress notifications. Remove phase parameters from named review functions and the agent wrapper; retain worker labels for Pi and retry diagnostics. Pi creates display groups as steps start, without another metadata list of future steps. Explicit host/GitHub display groups do not change the ambient review group.

After reviewer work returns, the outer coordinator saves and validates its bundle, then publishes and reports final delivery. Preserve incomplete output, the split route, two-attempt retries, restrictions and the saved-file gate. Do not add an event bus, queue, generator, state-machine dependency, new runner or changes to original skills or pi-subagents. Check awaited event ordering, phase grouping across notification workers and all existing failure/partial-output regressions before rebuilding and updating PR #4.

The callback implementation passed all 208 tests. Added generated-runtime checks confirm that asynchronous completion notifications finish before the next review step and that review workers retain the correct ambient display group across delivery workers. TypeScript, oxfmt, generated-output, braced-conditional and whitespace checks passed. A source-only audit found no blocking issue in event ordering, snapshots, partial acceptance or the save/publication boundary. No new model run or real delivery was performed.
