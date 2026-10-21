# Galaxy review output

Use these layouts at synthesis. The saved document is the audit trail; the pending GitHub body is a concise conversation with the author. Both start with context and an assessment of the stated goal, assess all four review levels, then group findings by P0, P1 and P2, distinguishing confirmed defects from questions. Keep all three priority headings and a separate Design and direction opportunities section. Say “none found in the reviewed scope” only where the relevant review was completed; otherwise state the coverage limit. Do not invent findings to fill a section.

## Writing

Apply `writing-voice` to the whole output, including headings' content, summary, inline comments and checklist explanations. Write like a Slack message: short sentences, simple English and specific consequences. Natural questions and direct requests work well. Avoid bot introductions, stock praise, corporate phrasing and repeated “the implementation” wording. Keep uncertainty and severity accurate.

For example: “this removes duplicate state and matches the linked design. the main path looks covered, but I couldn't verify undo after an edit.” A finding could say: “can we register this field with history too? changing it here saves the value, but undo leaves it behind.” Use examples as voice guidance, not text to copy without evidence.

Every GitHub review body, inline comment and reply ends with one blank line and `<sub>Sent with Pi</sub>`, once at the bottom. Do not use “From AI” or another attribution prefix. The local document does not need a footer, except in exact GitHub drafts it contains.

## Four-level assessment and opportunities

Assess **Product** (should we build this or solve the user task differently?), **Direction** (does it align with intended direction and current adoption?), **Design** (is there a simpler structure and a pleasant consumer API?) and **Correctness** (does it behave as intended?). Give a concise, sourced assessment for each. Use **unknown** when evidence is missing and **N/A** only with a scope reason; neither means passed. Record no supported improvement when that is the actual result, rather than inventing a redesign.

Keep **Design and direction opportunities** separate from severity-ranked findings and their explicitly labelled questions. Distinguish PR-scoped improvements from broader opportunities; priority and scope are separate. For each proposal give current friction/evidence, the alternative, preserved semantics, removed complexity, consumer impact, migration cost, first step and why this PR is an opportunity. Link owners, callers or comparable implementations outside the diff when relevant; do not manufacture inline anchors. Future direction alone is not a blocker. The main agent verifies evidence, deduplicates findings, resolves disagreements and owns the final judgement across all four levels.

## Merge confidence and submission

Apply these personal defaults only within the caller's authorised publishing scope.
An explicitly supplied job or task policy takes precedence, including a COMMENT-only restriction.

- Include **Merge confidence: {score}/100** in both summaries, with a short evidence-based reason. Assess the reviewed change's correctness, design, product and direction, accounting for substantive findings and unresolved behavioural questions. This is a judgement, not a percentage of checklist items passed.
- Keep CI status separate from the score. Failing or pending checks, including typecheck, lint, format and visual diffs, do not themselves reduce merge confidence or block approval. Report their actual status and relevant links without marking failed checks as passed. A concrete behavioural defect demonstrated by a test or diff remains a review finding and affects confidence; distinguish that defect from the check's status.
- Local build, test and typecheck execution is not expected or required for approval. Missing dependencies, unavailable toolchains or review-environment restrictions must not reduce merge confidence, impose a score cap or independently block approval. Record unavailable commands separately as environment limits, not as defects or unresolved behavioural questions. A lower score must name a substantive finding or a specific evidence-backed behavioural question; a generic lack of local verification is insufficient. Genuine test-coverage concerns must identify the behaviour and concrete risk, not merely the inability to execute tests locally. Pass this constraint to every reviewer.
- For failing visual diffs, ask the author to review the diffs and confirm the visual changes are expected. Approval may proceed while that confirmation is outstanding if the change otherwise meets the confidence threshold. Flag any confirmed unintended visual behaviour as a finding.
- When the user asks to submit the review and merge confidence is **95/100 or higher**, submit it as **APPROVE** without asking for a separate status confirmation. This Galaxy policy overrides the generic instruction to ask about an unclear submission status. Honour any explicitly requested review status instead. Below 95, submit **COMMENT** unless the user specifies another status; explain the findings or questions that prevent approval.
- A review request or a request to stage comments alone does not authorise submission. Preserve pending reviews until submission is requested, then recheck the current head and findings before applying the score and status.

## Evidence and provenance

- Embed the completed pre-review research in the saved document, with its sources, intent, affected consumers, existing APIs and ownership, relevant stack/rollout direction, prior discussion, assumptions and missing sources. A link to a scratch brief alone is insufficient. Keep factual research separate from later review conclusions; label later corrections or new evidence.
- Record the context gate: who gathered the brief, when it finished and when the main agent integrated it before review began. If delegation was unavailable, record the self-gathered fallback. Do not infer completion from an agent launch or an intermediate message.
- List every skill actually used, including `galaxy-review`, `review`, `code-research`, `writing-voice` and applicable technology skills. Record the agent/task, exact skill source path, version (commit plus dirty state, or content hash), assigned scope, execution status and evidence/checklist references. A CSS subagent's use of the CSS skill must be visible. Include separate rows when agents used different versions or scopes.
- Distinguish execution statuses: **completed**, **partial**, **blocked**, **loaded only**, **selected but not run**. A completed skill pass can find defects; it does not mean its checks passed. Account for selected but unavailable skills and incomplete delegates instead of claiming they ran. Do not list repository skills as executed merely because they appeared in the skill catalogue or instructions.
- Account for every generic checklist item, Galaxy operational check, item within selected Galaxy references and selected skill checklist item in the document. Record each Galaxy reference/category as selected or excluded, with its scope reason; exclusion is not a passed check. Do not bulk-read irrelevant references merely to enumerate N/A items. For the generic project-policy check, record the applicable instructions and operational/behavioural context actually gathered. Keep any additional compliance audit within the requested scope.
- Record selected reference sources and versions, assigned owners/checks and actual execution status alongside skills. A selected or loaded reference is not a completed pass. Retain excluded-category reasons and selected-but-unavailable reference gaps.
- Use checklist outcomes **passed**, **finding**, **partial**, **blocked**, **not checked**, or **N/A**, with evidence or a concise reason. `[x]` means criteria were verified satisfactory, not simply investigated. An unclassified item stays **not checked**. N/A needs a scope reason; passing tests alone do not verify history, concurrent editing, architecture or every branch.
- Fully satisfactory categories can be collapsed into one passed row, with evidence and any excluded N/A items named. Expand mixed categories item by item. In the pending body, show category summaries and expand every finding or gap; the saved document retains the complete coverage record.

## Pending GitHub review body

Use this as the pending review's top-level body alongside any inline comments. Replace placeholders with actual evidence and omit placeholder instructions. Keep the summary short, use the severity meanings from `review`, and link related inline findings or existing threads where available rather than duplicating them as new comments.

```markdown
## Summary

{What the PR is trying to do, relevant context from the research, and the affected behaviour. Does it achieve the stated goal: yes, partly, no, or uncertain? Give the concrete reason and any important verification limit.}

**Merge confidence: {score}/100** — {Evidence-based reason, excluding CI status.}

{CI status and links, separately from the score. For failing visual diffs, ask the author to review them and confirm the visual changes are expected.}

## Four-level assessment

| Level | Assessment and evidence / limit |
| --- | --- |
| Product | {Assessment; unknown or N/A with reason where applicable} |
| Direction | {Assessment; distinguish available adoption from future intent} |
| Design | {Assessment; supported improvement, no supported improvement, or evidence gap} |
| Correctness | {Assessment; confirmed defects and verification limits} |

## P0

{Findings with location, trigger, consequence and a direct request; or an honest no-findings/coverage-limit statement.}

## P1

{Findings or an honest no-findings/coverage-limit statement.}

## P2

{Findings or an honest no-findings/coverage-limit statement.}

## Design and direction opportunities

{Concise evidence-backed alternatives with scope, trade-offs and next step; link the complete proposal when needed. Or state no supported improvement / the evidence gap. Keep these separate from confirmed defects.}

<details>
<summary>Skills and checklist coverage</summary>

| Skill / agent | Scope | Run status |
| --- | --- | --- |
| {Skill actually used / agent} | {Assigned scope} | {completed / partial / blocked / loaded only / selected but not run} |

| Galaxy reference / categories | Selection | Scope reason / coverage gap |
| --- | --- | --- |
| {Each conditional reference/category} | {selected / excluded} | {Reason; selected reference execution status and owner, or link to saved coverage} |

| Checklist / category or item | Outcome | Evidence or gap |
| --- | --- | --- |
| {Skill — category; expand mixed outcomes} | {passed / finding / partial / blocked / not checked / N/A} | {Source, check result or reason} |

</details>

<sub>Sent with Pi</sub>
```

Do not submit the review unless the user asks for submission. When staging is authorised, preserve existing pending content, check the current head and anchors, and avoid duplicate findings. Updating this skill does not authorise changes to an existing PR review.

## Saved review document

Use this structure instead of the generic coverage-first report. Keep substantive research and provenance in the document even when the GitHub body is shorter. Use foldable details for lengthy checklist coverage, not for the summary or research.

```markdown
# Review: {PR title and link}

Scope: {repository, full diff base and reviewed head SHAs, included commits/areas}

## Summary

{Goal, important context and judgement of whether the change achieves it, with evidence and limits.}

**Merge confidence: {score}/100** — {Evidence-based reason, excluding CI status. Record the intended submission status under the Galaxy policy.}

## Four-level assessment

| Level | Assessment | Evidence / limit |
| --- | --- | --- |
| Product | {Should we build this or solve the task differently?} | {Evidence; unknown or N/A with reason where applicable} |
| Direction | {Fit with intended direction and current adoption} | {Current versus future; unresolved intent} |
| Design | {Simpler structure and consumer API; or no supported improvement} | {Owners/callers/comparable systems; evidence gap} |
| Correctness | {Behaviour against the intended contract} | {Confirmed defects and verification limits} |

## Pre-review research

Context gate: {research agent and brief location; completion and integration before review, or documented fallback}

{Embed the sourced brief: intent, current behaviour, consumers, APIs/ownership, product/RFC and stack context, prior review concerns, facts versus assumptions, open questions and missing sources.}

## Skills run

| Skill | Source and version | Agent / task | Scope | Execution status | Evidence / checklist |
| --- | --- | --- | --- | --- | --- |
| {Name} | {Exact path; commit + dirty state or hash} | {Main or subagent} | {Scope} | {Status} | {Links or references} |

## Galaxy guidance selection

| Reference / categories | Selection and scope reason | Source and version | Owner / assigned checks | Execution status / evidence |
| --- | --- | --- | --- | --- |
| {Each conditional reference/category} | {selected / excluded; reason} | {Exact selected path and version; not loaded for excluded references} | {Primary owner and checks, or not assigned} | {Actual status and evidence; exclusions are not passes} |

## P0

{Findings or reviewed-scope/coverage-limit statement.}

## P1

{Findings or reviewed-scope/coverage-limit statement.}

## P2

{Findings or reviewed-scope/coverage-limit statement.}

## Design and direction opportunities

{For each supported proposal: friction/evidence, alternative, preserved semantics, removed complexity, consumer impact, migration cost, first step and why this PR is an opportunity. Identify PR-scoped versus broader scope; include relevant sources beyond the diff. Or state no supported improvement / the precise evidence gap.}

## Checklist coverage

<details>
<summary>Reviewed checklists and outcomes</summary>

| Skill / checklist item or fully passed category | Outcome | Evidence or reason |
| --- | --- | --- |
| {Each selected skill/reference checklist and operational check accounted for} | {Outcome} | {Specific evidence or gap} |

</details>

## Verification and limits

{Actual commands/results, revision tested, local versus CI evidence, omitted checks and how they limit conclusions. Note browser behaviour as unverified when relevant; preview testing is disabled in this profile.}

## Pending review body

{Exact GitHub body using the template above. Record whether it is only drafted or actually staged, and link it when available.}

## Inline comment drafts

{For each new draft: stable ID, PR link, full head SHA, repository-relative file, diff side and one-based lines; full base SHA for LEFT. Include the exact source excerpt and exact casual comment text with its footer. Link existing concerns separately. If none, say no new inline comments are proposed.}
```

Each finding needs evidence, location, trigger, consequence and a recommendation. Keep preferences, open questions and already reported concerns distinct from confirmed defects. Record later evidence separately from the pre-review research, and do not turn missing coverage into a finding against the author without a supported consequence.
