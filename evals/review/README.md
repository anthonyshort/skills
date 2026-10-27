# Review skill evals

These evals check that the [review skill](../../skills/review/SKILL.md) catches specific kinds of problems, and doesn't invent them in good code.

Each file in [`cases/`](cases/) covers one category:

| File | What it checks |
| --- | --- |
| [architecture.md](cases/architecture.md) | Dependency direction, import cycles, domain code coupled to UI, duplicated business rules and order placement coupled to its side effects. |
| [valtio.md](cases/valtio.md) | Mutating snapshots, leaked subscriptions, stale snapshots in callbacks, native collections and stored derived state. |
| [readability.md](cases/readability.md) | Deep nesting, vague names and long functions with mixed responsibilities. |
| [rules.md](cases/rules.md) | One case for each [review rule](../../skills/review/rules/README.md) that the other files don't cover. |

Every category includes a control case: good code that the review should leave alone.

## How a case works

A case is a small change to a small repository, written as Markdown:

````markdown
## stale-snapshot-in-timer: Autosave the draft after typing stops

A note for humans about why this case exists. The runner ignores it.

### Requirements

What the change is meant to do. The reviewer sees this as the PR description.

### Before

```ts file=src/draftStore.ts
// Files in the base commit.
```

### After

```tsx file=src/DraftEditor.tsx
// Files added or replaced in the head commit.
```

### Must find

- One problem the report must identify, with its consequence.

### Must not flag

- Something the report must not raise as a required fix.

### Must read

- `best-practices/valtio/SKILL.md`
````

The heading is `## <id>: <PR title>`. The id is kebab-case and unique within its file. Code blocks need a `file=` path. Files in **After** replace files with the same path from **Before**.

A case needs at least one **Must find** or **Must not flag** bullet. A case with only **Must not flag** bullets is a control case.

**Must read** is optional. It lists guidance files, relative to `skills/`, that the review must open for this case. The transcript shows whether it did. Every rule in the rule index must appear in some case's **Must read**, which a unit test enforces.

## Process checks

A case passes only when the report meets its criteria and the review followed the skill. The process checks use the reviewer's stream-json transcript and the files it saved, not what the report claims:

| Check | Passes when |
| --- | --- |
| Saved assessments | `risk.md`, `research.md`, the five question assessments and `rules.md` are in the artefact directory. |
| Report sections | The report has every required section of the template. |
| Every rule accounted for | `rules.md` names every rule in the rule index. |
| No code changes | The case repository is unchanged. |
| Subagents | The review launched at least eight: research, five questions, the rule pass and the editorial pass. |
| Research delegated | A subagent ran before `research.md` was saved. |
| Best-practice skills | At least one best-practice skill was read. |
| Rule index | `rules/README.md` was read. |
| Editorial pass | A subagent ran after the report was first saved. |
| No local checks | No builds, tests, linters or package managers were run. |
| Required guidance read | Every **Must read** file was opened. |

The summary also reports how many rule files were read and any permission denials. A reviewer command that doesn't produce a stream-json transcript fails the transcript checks.

## Running

Requires Python 3 and the `claude` CLI.

```sh
# Check every case parses and list them.
python3 evals/review/evals.py list

# Review and grade everything, or pass categories or case names.
python3 evals/review/evals.py run --out /tmp/review-evals/$(date +%F)
python3 evals/review/evals.py run valtio architecture/import-cycle --out /tmp/review-evals/try-1

# Re-grade reports already in a run directory, for example after editing criteria.
python3 evals/review/evals.py grade --out /tmp/review-evals/try-1
```

`run` builds one Git repository per case with a base and head commit. A reviewer agent then reviews each case with the review skill and saves a report. A grader agent checks that report against the case's criteria.

The run directory ends up with:

```text
summary.md           Findings and process results for each case, with what was missed, wrongly flagged or skipped.
results.json         The same results with the grader's evidence.
skills/              The copy of the skills the reviewer used.
<category>/<id>/
  repo/              The case repository.
  prompt.md          What the reviewer was asked.
  review-report.md   The review report.
  grade.json         Each criterion and process check, whether it passed and the evidence.
  transcript.jsonl   Reviewer transcript, including subagents' tool calls.
  artefacts/         The review's saved assessments.
  grader.log         Grader output.
```

The reviewer gets a copy of `skills/` inside the run directory and runs from there, so it can't read the expected answers in this folder. Use a new `--out` directory for each run.

Full reviews are slow because the skill delegates to several subagents. Use `--jobs` to review cases in parallel (default 4) and filter to the category you're changing.

### Other skill versions

`--skills` reviews with a different skills directory, such as a copy with an experimental change. The default is this checkout's `skills/`.

```sh
python3 evals/review/evals.py run architecture --skills /tmp/skills-experiment --out /tmp/review-evals/experiment
```

### Other agents

`--reviewer` and `--grader` take any command that reads a prompt on stdin, so you can compare agents or models. The reviewer runs from the run directory.

```sh
python3 evals/review/evals.py run valtio --out /tmp/review-evals/sonnet --reviewer 'claude -p --model sonnet --output-format stream-json --verbose --permission-mode acceptEdits --allowedTools "Bash(git:*)"'
```

The default reviewer auto-accepts file edits and only allows `git` in Bash. The review skill doesn't run builds or tests, so that's all it needs.

## Adding a case

1. Pick the category file, or add a new `cases/<category>.md` starting with a `# Title` and a sentence on what it covers.
2. Keep the change small and realistic. Include the surrounding code the reviewer needs to see the problem, such as callers or an `ARCHITECTURE.md` stating a boundary.
3. Write criteria that name the specific problem and its consequence. "Flags the import cycle between users and teams" is gradable. "Finds architecture issues" is not.
4. Add a **Must not flag** bullet when there's an obvious wrong answer, such as reporting a behaviour bug in correct but messy code.
5. Run `list` to check it parses, then `run` just that case.

When a case fails, read `review-report.md` before changing the skill. The criterion may be too strict, or the problem may be too subtle for the change as written.

## Checking the evals are valid

A case is only useful if a worse skill fails it. To check, run the cases against a copy of `skills/` with a deliberate regression using `--skills`. Cases with problems to find should fail when the skill is told to ignore that category. Control cases should fail when the skill gains a bad standard that condemns good code. Telling the reviewer to invent findings doesn't work, because it refuses.

- [27 October 2026](results/2026-10-27/README.md): 16/16 passed with the current skill. 10/13 failed with a blind skill and 3/3 controls failed with bad standards.

## Relation to the benchmark

[`benchmarks/review`](../../benchmarks/review/README.md) is a separate blind benchmark of eight bug and false-positive cases with runtime oracles. These evals are about catching categories of design and quality problems, which can't be checked by running code, so an LLM grades them instead.
