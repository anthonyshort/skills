# Review skill evals

The review is split into unit skills, and each one has its own evals. A unit eval gives the skill fixed inputs and checks only that unit's output. When a case fails, you know which step to fix.

| Folder | Skill tested | What the cases check |
| --- | --- | --- |
| [review](review/cases/) | [review](../skills/review/SKILL.md) coordinator, with every unit stubbed | Steps run in order, each with its unit skill, delegated where required, and none skipped. Includes the split-only path. |
| [review-risk](review-risk/cases/) | [review-risk](../skills/review-risk/SKILL.md) | Risk levels that size alone gets wrong, inactive code and PRs mixing unrelated changes. |
| [review-research](review-research/cases/) | [review-research](../skills/review-research/SKILL.md) | Finding decisions and conflicts in Slack, Notion, Linear and GitHub exports, preferring newer decisions, and reporting unavailable or unread sources honestly. |
| [review-guidance](review-guidance/cases/) | [review-guidance](../skills/review-guidance/SKILL.md) | Choosing the right best-practice skills, and not the irrelevant ones. |
| [review-assess](review-assess/cases/) | [review-assess](../skills/review-assess/SKILL.md) | One file per review question: product, system fit, simplicity, readability and correctness. |
| [review-rules](review-rules/cases/) | [review-rules](../skills/review-rules/SKILL.md) | A violation case for every rule, plus cases where a rule's exception applies. |
| [review-report](review-report/cases/) | [review-report](../skills/review-report/SKILL.md) | Merging duplicates, keeping severities, settling disagreements and keeping gaps visible, from fixed assessments. |
| [end-to-end](end-to-end/cases/) | The whole review with real units | A few full reviews to check the units work together. |

## Running

Requires Python 3 and the `claude` CLI.

```sh
# Check every case parses and list them.
python3 evals/run.py list

# Run one unit, one question file or one case.
python3 evals/run.py run review-rules --out /tmp/evals/rules-1
python3 evals/run.py run review-assess/correctness --out /tmp/evals/correctness-1
python3 evals/run.py run review-risk/risk/small-destructive-change --out /tmp/evals/risk-1

# Re-grade saved outputs, for example after editing criteria.
python3 evals/run.py grade review-rules --out /tmp/evals/rules-1

# Unit tests for the runner itself. These don't call an agent.
python3 evals/test_run.py
```

Use a new `--out` directory for each run. `--jobs` sets how many cases run in parallel (default 4). `--skills` tests another skills directory, such as a copy with an experimental change. `--agent` and `--grader` take any command that reads a prompt on stdin.

Each case directory in the run holds the case repository, its inputs, the prompt, the agent's transcript, the saved artefacts and `result.json`. The run directory has `summary.md` and `results.json`.

## How a case works

A unit folder has a `prompt.md` and a `cases/` folder of Markdown files. `prompt.md` starts with the file the unit saves (`output: rules.md`) and then the prompt, with placeholders such as `{repo}`, `{inputs}` and `{output}`. In review-assess the file name is the question, so `cases/correctness.md` asks the correctness question.

A case looks like this:

````markdown
## stale-snapshot-in-timer: Autosave the draft after typing stops

A note for humans about why this case exists. The runner ignores it.

### Requirements

What the change is meant to do. The agent sees this as the PR description.

### Before

```ts file=src/draftStore.ts
// Files in the base commit.
```

### After

```tsx file=src/DraftEditor.tsx
// Files added or replaced in the head commit.
```

### Inputs

```md file=slack/frontend.md
Fixed inputs for the unit, such as exports or earlier assessments.
```

### Guidance

- `best-practices/valtio/SKILL.md`

### Must find

- One problem the output must identify, with its consequence.

### Must not flag

- Something the output must not raise as a required fix.

### Must read

- `best-practices/valtio/SKILL.md`

### Steps

- risk.md
- product.md, system-fit.md, simplicity.md, readability.md, correctness.md
````

Every section except Requirements and After is optional, but a case needs Must find, Must not flag or Steps. A case with only Must not flag is a control.

- **Inputs** are written to the case's `inputs/` folder and listed in the prompt.
- **Guidance** lists skills, relative to `skills/`, given to review-assess as the selected guidance.
- **Must read** lists files the agent must open. The transcript shows whether it did.
- **Steps** lists the coordinator's output files in order. Files on one line can be written in any order. `(no unit)` marks a file the coordinator writes itself, such as a split-only report.
- A code block marked `repeat=N` is repeated N times, with `{n}` replaced by 1 to N, to build large diffs.

## How cases are graded

A case passes when a grader agent finds the output meets every criterion and every code check passes. Code checks use the agent's stream-json transcript and saved files, never what the output claims:

| Check | Applies to | Passes when |
| --- | --- | --- |
| No code changes | All | The case repository is unchanged. |
| Output saved | Cases with criteria | The unit's output file exists. |
| No local checks | All | No builds, tests, linters or package managers were run. |
| Required guidance read | Cases with Must read | Every listed file was opened. |
| Permissions | All | No tool call was denied, since a denial can hide skipped work. |
| Every rule accounted for, rule index read | review-rules, end-to-end | `rules.md` names every rule, and the rule index was read. |
| Report sections, editorial pass | review-report, end-to-end | The report has every template section, and a subagent ran after it was first saved. |
| Steps run, step order, no unexpected steps | review, end-to-end | Each listed file was written, in order, and no other step's file was. |
| Unit skills used, units delegated | review, end-to-end | Each step read its unit skill before saving its output, and research, guidance, assessments and rules ran in subagents. |

## Adding a case

1. Pick the unit and file. Add a new `cases/<name>.md` when none fits.
2. Keep the change small and realistic. Include the surrounding code or documents the unit needs, such as callers or an `ARCHITECTURE.md` stating a boundary.
3. Write criteria that name the specific problem and its consequence. "Flags the import cycle between users and teams" is gradable. "Finds architecture issues" is not.
4. Add a Must not flag bullet when there's an obvious wrong answer, and a control case for every kind of problem you add.
5. Run `list` to check it parses, then run just that case.

When you add a review rule, add a violation case to [review-rules](review-rules/cases/violations.md). A unit test fails until every rule has one.

## Checking the evals are valid

A case is only useful if a worse skill fails it. Run the unit's cases against a copy of `skills/` with a deliberate regression in that unit, using `--skills`:

- Cases with problems to find should fail when the unit is told to ignore that kind of problem.
- Controls should fail when the unit gains a bad standard that condemns good code. Telling it to invent findings doesn't work, because it refuses.
- Code checks should fail when the unit skips the step they check.

Results are recorded in [results](results/).
