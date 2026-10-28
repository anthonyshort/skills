# Review workflow

This Pi package provides the opt-in `review` workflow for pi-subagents 0.22.0. It runs inside your existing Pi session and uses that session’s model and tools. The review skill supplies the criteria; the workflow requires the stages and checks their outputs.

## Install and run

From this checkout:

```sh
npm install
pi install npm:@tintinweb/pi-subagents@0.22.0
pi install /absolute/path/to/skills
```

Enable package workflow discovery in pi-subagents and reload Pi. Invoke `SubagentWorkflow` with `name: "review"`. Resolve the comparison to full commit IDs first, then supply these arguments:

```json
{
  "name": "review",
  "args": {
    "packageRoot": "/home/me/dev/skills",
    "repository": "/home/me/dev/app",
    "target": "app: main..HEAD",
    "base": "BASE_SHA",
    "head": "HEAD_SHA",
    "artifacts": "/tmp/app-review",
    "runId": "app-review",
    "invocationId": "app-review-attempt-1"
  }
}
```

Replace `BASE_SHA` and `HEAD_SHA` with the output of `git rev-parse main` and `git rev-parse HEAD` in the reviewed checkout. The checkout must be clean at the selected head. Use an output directory outside the repository and a fresh `invocationId` for each launch so cached worker results cannot bypass file checks.

Optional `contextFiles` supply absolute paths to requirements. `wrapperSkillRoots` adds wrapper skill directories and their rule indexes. Resource paths default to this package’s review skill, gate script and installed `tsx` loader.

## Read the code in execution order

Start at `src/review/workflow.ts`. Its entry point shows the graph and the save operation; the remaining functions implement stage retries, the assessment barrier and result construction.

| File | Why it exists |
| --- | --- |
| `workflow.ts` | Coordinate setup → research → five assessments → rules → consolidation → draft → edit → accepted report → decision |
| `stages.ts` | Give each worker its section of `SKILL.md`; reject answers that lose evidence, rules or findings |
| `contracts.ts` | Define the Zod wire formats shared by workers, workflow and saved-file gate |
| `approval.ts` | Reject decisions that contradict required findings or inline comment provenance |
| `artifacts.ts` | Ask a writer to save accepted data, then require the real file gate to pass |
| `validate.ts` | Check disk files, pinned Git revisions, rule indexes and canonical report against accepted data |
| `progress.ts` | Ask a reporting agent to update one host notification message at stage boundaries |
| `text.ts` | Format complete coverage and compute the writer-integrity checksum |

`scripts/build/workflow.ts` bundles the entry point into `workflows/review.js`, because pi-subagents executes JavaScript. Edit the TypeScript source and run `npm run build`. `build:check` rejects stale generated output.

`scripts/review/validate-bundle.ts` is the command-line entry point called by the writer’s gate. The workflow VM cannot access the filesystem, so an agent writes the files and this Node command independently checks them. Both execution paths use the same stage guards.

## Outputs and failure behaviour

Every required assessment gets one fresh retry. Exhausted attempts stop downstream work and preserve accepted partial results. The five parallel assessments form a barrier: none may disappear before consolidation. Oversized changes use the skill’s split-only route unless an explicit exception applies.

The writer saves `bundle.json`, each stage’s Markdown, `review-report.md`, `approval.json`, `summary.md`, `inline.json` and `result.json`. An incomplete review also has `incomplete.md`. A failed writer gate fails the workflow. Report completion means the required outputs exist and agree; required findings can still withhold approval.

The workflow returns the report and decision to its caller. Publishing or submitting approval remains a separate action using the review skill’s existing helper. There is no additional GitHub publisher or standalone Pi process manager in this package.

For progress updates, optionally supply `notification: { destination, messageKey }`. A reporting agent calls the assumed host `notify` update API once per status change. Configure Telegram or a GitHub comment adapter in that notification system. Failed or uncertain delivery is recorded without retrying the notification or repeating review work. The adapter API is implemented separately. The saved bundle contains delivery receipts collected before writing; the final save notification receipt appears only in the successful workflow return.

## What the tests prove

Run `npm test` for deterministic checks. No model or live transport is called.

| Suite | What is real | What it proves |
| --- | --- | --- |
| `tests/review-workflow.test.ts` | Generated script in the pi-subagents VM and saved-file gates; workers return canned answers | Stage order, the five-assessment barrier, retries, partial output, notification failure and writer rejection |
| `tests/review-stages.test.ts` | Pure stage and approval validation with explicit inputs | Required findings cannot approve; inline IDs refer to accepted new bugs; template source is preserved |
| `tests/review-bundle.test.ts` | Temporary committed repositories, copied rules and disk artefacts | Changed or missing files, wrong revisions, lost coverage and inconsistent decisions are rejected |

`tests/fixtures/workflow.ts` supplies the fake worker host. `tests/fixtures/bundle.ts` supplies canned accepted data for file-corruption cases. Their JSDoc distinguishes simulated answers from real Git and disk checks. The existing Python helper suite is also run for compatibility; it does not establish workflow behaviour.

To exercise model judgement, invoke the named workflow in Pi on a small change with a known defect and confirm it survives into the accepted report. Current automated checks prove the workflow’s contracts, not the truth of model evidence or successful delivery to GitHub or Telegram. Source restrictions remain prompt-enforced, and the checksum detects accidental writer changes rather than malicious edits.
