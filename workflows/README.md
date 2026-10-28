# Review workflow

`review.js` is a pi-subagents 0.22.0 workflow shipped by this Pi package. The existing review skill owns the review criteria, rules and report formats. TypeScript owns the stage order, output contracts, retry limits and completion checks. No pi-subagents modifications or separate host application are required.

The authored workflow lives in `src/review/`. Stage instructions and validation are in `stages.ts`, canonical Zod contracts in `contracts.ts`, and saving, publication and progress reporting have separate modules. `npm run build` bundles these into `review.js` because pi-subagents executes JavaScript. Commit the generated file when changing its source; `npm run build:check` detects stale output. The launcher and saved-file helpers run TypeScript directly through `tsx`.

## Install or use this branch

Install both the workflow engine and this checkout:

```sh
pi install npm:@tintinweb/pi-subagents@0.22.0
pi install /absolute/path/to/skills
```

The package manifest exports `./workflows` through `pi.subagents.workflows`. Pi-subagents discovers the workflow by the name `review`. Package workflow discovery must be enabled in its settings. Named lookup rejects symlinked workflow files and directories; install the local package instead. An explicit `scriptPath` can point through a symlink, but the supplied `packageRoot` must identify the complete source package.

The launcher provides a repeatable way to run from an uninstalled branch:

```sh
npm install
npm run review -- \
  --repository /absolute/path/to/clean-checkout \
  --base BASE_REF \
  --head HEAD \
  --output /tmp/review-output
```

It resolves refs to full commit IDs and requires the checkout to be clean at the selected head. The output directory must be empty and outside the repository and workflow package. `--profile` selects the source Pi profile; otherwise the launcher uses `PI_CODING_AGENT_DIR` or `~/.pi/agent`. The configured provider, model and thinking level are inherited. No model override is selected by the workflow.

The launcher creates a private temporary profile, copies only model configuration and credentials, and registers this package and the pinned plugin there. It does not install into or change the selected profile. Credentials are removed on exit. Review output, session diagnostics and logs remain in the output directory.

## Review stages

1. **Setup:** Pin the full comparison, count the change and establish initial risks. Over 2,000 added lines takes the existing split-only route unless a documented exception applies.
2. **Research:** Gather context or validate earlier complete review evidence. Unavailable sources remain explicit gaps.
3. **Assessments:** Run product, system fit, simplicity, readability and correctness in parallel. Every assessment is required before continuing.
4. **Rules:** One worker checks indexed rules sequentially across the main and supplied wrapper collections. Missing or duplicate rule rows fail coverage validation.
5. **Consolidation and reporting:** Independently check claims, reconcile findings, draft the report, obtain an editorial reduction and accept a canonical report without losing check outcomes or uncertainty.
6. **Decision:** Produce the seven-check approval assessment, publication summary and valid new inline findings. This is an assessment, not confirmation of a GitHub write.
7. **Persistence and publication:** Save accepted and partial results, validate the saved bundle against the accepted output, then perform the selected publication operation.

Each required review stage gets one fresh retry after failed or invalid output. Decision validation checks approval semantics against accepted finding dispositions before the retry limit is exhausted. Inline IDs must map exactly to retained new bugs; required or unresolved findings cannot pass the clean-review check. A failed parallel worker cannot silently disappear. Exhausted attempts stop downstream review work and save available evidence as incomplete. Writer or publication failures stop without a successful completion claim. Uncertain external writes are not retried automatically.

## Publication and notifications

Local reports are the default. To render the existing GitHub helper's payload without remote calls:

```sh
npm run review -- --repository /path/to/checkout --base BASE_REF \
  --output /tmp/review-preview --publication dry-run --github owner/repo#123
```

Actual GitHub publication requires explicit selection:

```sh
npm run review -- --repository /path/to/checkout --base BASE_REF \
  --output /tmp/review-publish --publication github --github owner/repo#123
```

The publication wrapper reuses the skill's recoverable progress helper. It checks the live PR head, preserves one comment, freezes final inputs and verifies the resulting comment and review receipts. It does not treat successful subprocess exit as confirmation. Inspect `progress.json`, `result.json` and GitHub before recovering an uncertain attempt; do not rerun the whole review to repeat publication. Each output directory belongs to one invocation. Do not run concurrent publication commands against the same saved state.

Direct callers may supply `notification: { destination, messageKey }`. A reporting agent then calls the host `notify` update tool at stage boundaries. That optional tool API is implemented separately; normal standalone Pi runs leave notifications disabled. Delivery failures are recorded without repeating review work. The final publisher owns the completed GitHub comment, so progress must not overwrite it afterwards.

## Inputs and saved output

Direct `SubagentWorkflow` calls accept `name: "review"` or the explicit script path, with these arguments:

| Argument | Meaning |
| --- | --- |
| `packageRoot` | Absolute path to this complete package |
| `repository`, `base`, `head` | Clean checkout and exact full comparison revisions |
| `target` | Human-readable target or PR URL |
| `artifacts` | Absolute writable output directory outside source directories |
| `runId`, `invocationId` | Review identity and a fresh identity for each launch |
| `publication` | `{ mode: "local" }`, or `dry-run`/`github` with `repository` and `prNumber` |
| `contextFiles` | Optional absolute paths to caller-supplied requirements and scope restrictions |
| `wrapperSkillRoots` | Optional complete wrapper skill directories with additional rule indexes |
| `tsxLoader` | Optional absolute `tsx` loader path; defaults to the package’s installed loader |
| `notification` | Optional host notification destination and stable message identity |

The launcher supplies these paths and identities. Direct callers can also override `skillRoot` and `supportRoot` when testing a complete alternate resource tree. All resources must be readable in the execution environment; host paths are not automatically mounted into a sandbox.

The output includes `bundle.json`, each assessment's Markdown, `review-report.md`, `approval.json`, `summary.md`, `inline.json` and `result.json`. Failed reviews save accepted partial assessments and `incomplete.md`. `result.json` distinguishes review completion from publication delivery. A review can complete with defects or evidence gaps; neither completion nor a candidate approval means GitHub approved the change.

Run the saved validation command again before using results from a replayed session. Pi-subagents can replay successful agents without rerunning their gates. The launcher supplies a fresh invocation identity and independently validates saved files after Pi finishes. Cached review reuse and restart-safe resumption are not implemented.

Schemas and file checks enforce structure and consistency, not the truth of model evidence. Worker source access and side effects are constrained by prompts, not a new security sandbox. The compact bundle fingerprint detects accidental writer changes and is not a cryptographic defence against a malicious writer.

## Testing with Pi

```sh
npm test
npm run test:pi -- --profile /path/to/your/pi/profile
```

Unit tests run the actual workflow runtime with stub agents, temporary Git repositories, the existing approval validator and real saved-file gates. Launcher tests use a fake Pi process to exercise lifecycle, isolation, timeout, cancellation and completion receipts.

The explicit Pi test runs the configured model through every review stage on a local arithmetic fixture. It checks that the known defect survives consolidation into the saved report and that the source checkout stays clean. It never publishes, sends notifications or contacts organisational sources. Model-backed runs may incur provider charges.

The launcher uses RPC mode and keeps stdin open until Pi saves its terminal workflow entry. A temporary bootstrap invokes the packaged workflow by name with literal arguments. This avoids relying on an initial model turn to choose the tool. `pi -p --subagents-workflow-file=...` alone is unsuitable: the startup workflow is detached, takes no CLI arguments and can be aborted when print mode exits.
