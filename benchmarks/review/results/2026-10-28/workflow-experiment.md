# Review workflow experiment

Implementation and verification: 28 October 2026. The experiment is inactive.

## Saved changes

- The existing skills changes were validated and committed as `4e7a442` before creating the `anthonyshort/review-workflow` worktree.
- The main review skill coordinates six independently discoverable skills: review-research, review-product, review-system-fit, review-simplicity, review-readability and review-correctness. Shared assessment method and coordination details remain references. The main skill has no execution-mode or pi-subagents instructions. The experiment’s execution contract lives beside its local workflow code.
- The workflow, artefact validator, stub-runtime tests and usage notes are saved under the isolated agent's ignored `config/pi/` directory. No workflow discovery, resource links, installed skills, review routes, polling, notification destinations or scheduled jobs were changed.

## Checks and evidence

| Check | Result | What it establishes |
| --- | --- | --- |
| Skill-creator validator | Passed | Valid review skill frontmatter and scaffold checks |
| Assessment guidance comparison | Passed | Research and assessment checklists and deliverables are preserved in their owning skills; shared assessment method has one reference |
| Review links | Passed | Local links resolve across the coordinator, stage skills and supporting references |
| Temporary discovery | Passed | 29 valid links in each temporary agent and Claude skill directory, including all six focused review skills |
| Existing publication-helper tests | 50 passed | Existing helper behaviour survives the guidance extraction |
| Real pi-subagents runtime with stub agents | 34 passed | Explicit worker skill loading, stage barriers, schema rejection, one retry, missing assessments, rules and wrappers, report coverage, partial results, notifications and persistence failures |
| Real filesystem/Git gates | Passed within runtime scenarios | Saved content matches the accepted result, checkout is clean at the pinned head, complete diff counts match, and indexed rules are covered |
| Journal replay scenarios | Passed | A fresh invocation identity prevents cached writer reuse, and mandatory parent revalidation rejects missing files after cached replay |
| Agent runtime `npm run validate` | Passed | Formatting, lint, typechecking and all 20 existing runtime tests |

The stub scenarios run the installed plugin runtime and actual Python gate. They do not ask a model to execute the full workflow. The notification and publication boundaries are mocked and no external writes occur.

## Independent readability-stage exercise

A separate agent exercised the extracted assessment guidance and then used the focused `review-readability` skill directly on a local before/after TypeScript fixture. The contract was to return active-row labels in input order. The change replaced a direct selection/projection with an indexed accumulator and three nested guards. The agent received no expected finding.

It selected the readability guidance, read the functional-style example and extraction rule, inspected both complete function bodies and returned a concrete readability improvement. Its recommendation preserved the supplied behaviour and did not claim a runtime defect or assign bug severity. It reported names, control flow, expression choice, cohesion, exclusions and evidence limits in a checklist. It did not restart the full review, delegate, run project checks or publish.

The focused skill followed its shared-rule link and worker assessment method without starting unrelated coordinator steps. Its relative links and heading anchors resolved. Coordinator delegation instructions now live separately from the worker method and assessment skills.

## Important boundaries

- Review agents are constrained through prompts. This experiment adds no tool-permission sandbox and cannot prove source inspection or evidence truth.
- The future notification update API is assumed, confined to the reporting function and unverified against live Picco integrations.
- The workflow stops with validated artefacts. The parent must independently rerun the returned validation command, verify the conclusions and editorial edit, refresh GitHub facts and confirm required publication before recording review completion.
- Supply a fresh invocation identity for every launch. Cached review resumption and restart-safe recovery are not supported.
- The compact writer fingerprint detects accidental changes. It is not a cryptographic defence against malicious output.
- No live model-backed end-to-end review, Telegram delivery, GitHub comment update or formal approval was exercised.
