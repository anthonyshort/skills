# Review: {{ target }}

**Scope:** {{ repository/PR/branch, reviewed changes, full base and head revisions, and exclusions }}

Use short sentences, lists and tables. Do not join clauses with semicolons. Keep the recommendation, findings and important limits visible. Put longer evidence and coverage in foldable sections. Replace placeholders and remove template instructions. Omit empty finding sections. The report must make sense without opening worker reports.

## Assessment

{{ Give a short recommendation and explain why. State the number of new bugs and already reported concerns. Highlight blocked or missing execution checks. Say whether the PR should stay together, be simplified or be split. }}

| Area | Conclusion and key evidence |
| --- | --- |
| Product | {{ Does this solve the intended user task? }} |
| Direction | {{ Does it fit established ownership and supported direction? State unknowns. }} |
| Design | {{ Is it reasonably simple and are its APIs clear? }} |
| Readability | {{ Are names, placement, comments and code clear? }} |
| Correctness | {{ What works, what fails and what remains unverified? }} |

### Risk and scope

{{ Briefly explain the main risks and whether the PR should stay together, be simplified or be split. Distinguish review effort from production impact. }}

- **Size and scope:** {{ Additions and deletions across the reviewed diff, distinct changes and mechanical or generated portions. }}
- **Exposure:** {{ Active paths, affected consumers and blast radius. Explain when code is not yet used. }}
- **Verification:** {{ Evidence that reduces risk, important gaps and relevant non-functional requirements. }}
- **Recommendation:** {{ Keep together, simplify or split, with a concrete reason. If splitting helps, describe useful boundaries and dependencies. }}

{{ Keep this short for straightforward changes. Do not repeat findings or assign a numerical risk score. }}

## Findings

{{ Lead with this table. Distinguish new findings from concerns already raised in the PR. Link existing threads. State explicitly if no supported findings were found. }}

| ID | Type / severity | Finding and impact | New or already reported | Recommended action |
| --- | --- | --- | --- | --- |
| {{ ID }} | {{ bug/question/convention/preference and priority if applicable }} | {{ short description and effect }} | {{ New or Already reported with thread link }} | {{ required fix or optional action }} |

{{ Use caller-supplied priorities when available. Otherwise P0 means a show-stopping failure, P1 means wrong success-path behaviour or substantial revision, and P2 means a potential issue or rare edge case. Base priority on impact and likelihood. Preferences and future opportunities alone are not blockers. }}

{{ For each finding, show its location, trigger, effect and recommendation in short bullets. Keep confirmed bugs distinct from questions. Include exact revisions and valid source locations even outside the diff. Link related evidence instead of repeating it. Do not draft duplicate comments for existing concerns. }}

### {{ finding ID }} — {{ short title }}

- **Location:** {{ path:line and exact revision }}
- **Trigger:** {{ conditions that expose the issue }}
- **Effect:** {{ observable consequence }}
- **Action:** {{ concrete recommendation and whether required or optional }}
- **Limits:** {{ uncertainty and what was not verified }}

<details>
<summary>Evidence for {{ finding ID }}</summary>

{{ Short source trace, reproduction, expected/actual results, screenshots or test output. Explain how the evidence supports the finding. }}

</details>

## Design and direction opportunities

{{ Use short bullets or a table for supported alternatives. Include current friction, the proposed change, preserved behaviour, complexity removed, affected consumers, migration cost and a practical first step. Show before-and-after caller code for API changes. Label each PR-scoped improvement or broader opportunity. Mark New or Already reported and link existing discussion. Do not make future direction a blocker without a current consequence. }}

## Nits

{{ Short bullets for optional aesthetic suggestions. Label previously reported concerns and link their threads. }}

## Verification summary

{{ State what was actually executed, what was only checked in source and what could not be verified. Keep important failures and gaps visible. Do not equate successful execution or passing tests with correctness. }}

| Check | Method | Result | Important limit |
| --- | --- | --- | --- |
| {{ check }} | {{ source inspection/test/manual/browser }} | {{ Source checked/Test passed/Test failed/Blocked/Not run }} | {{ concise limit }} |

## Supporting details

<details>
<summary>Research context and open questions</summary>

{{ Explain the problem, requirements, affected consumers and sources. Separate facts from assumptions. Include decisions with sources and unresolved questions with their effect on the assessment. Do not present proposals as agreed decisions. }}

</details>

<details>
<summary>Review checklist coverage — {{ short result summary }}</summary>

{{ Group by PR and skill or assessment. List every generated check with its guidance section references, evidence, method and result. Include excluded sections and their scope reasons. Check that relevant guidance was not silently omitted. Record guidance paths and versions. Use explicit results: Source checked, Test passed, Test failed, Concern found, Blocked, Not run or N/A with a reason. Source checked means inspected, not runtime verified. Do not collapse away individual outcomes. Do not load unrelated skills just to mark them N/A. If guidance changed after the review, identify retrospective evidence and leave unsupported new checks unverified. }}

| Skill / checklist and version | Item | Method | Result | Evidence or reason |
| --- | --- | --- | --- | --- |
| {{ guidance }} | {{ item }} | {{ source/test/manual/browser }} | {{ explicit result }} | {{ evidence or gap }} |

</details>

<details>
<summary>Rule coverage — {{ selected count }} checked, {{ skipped count }} skipped</summary>

{{ List every rule in the index, including skipped rules. Selected means assigned for checking, not passed. Use Concern found, Satisfied, Not applicable or Not verified for selected rule results and state the verification method. Explain each skipped rule. }}

| Rule | Selected or skipped | Selection reason | Method | Result and evidence |
| --- | --- | --- | --- | --- |
| {{ rule and version }} | {{ Selected/Skipped }} | {{ why }} | {{ source/test/manual/browser or N/A }} | {{ outcome and evidence, or skip reason }} |

</details>

<details>
<summary>Commands and manual checks</summary>

| Exact command or manual steps | Revision / environment | Result | Evidence or limit |
| --- | --- | --- | --- |
| {{ command or steps }} | {{ revision/environment }} | {{ passed/failed/blocked/not run }} | {{ actual output, reproduction result or reason }} |

{{ Identify missing regression coverage and explain its effect on confidence. }}

</details>

<details>
<summary>Review inputs and consolidation</summary>

{{ List the research report and all Step 3 and Step 4 assessments with paths and completion status. Record missing inputs and coverage gaps. Briefly explain merged overlaps, resolved disagreements and excluded conclusions with reasons. Include essential evidence here rather than requiring readers to open worker files. }}

</details>
