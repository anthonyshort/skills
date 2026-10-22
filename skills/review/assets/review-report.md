# Review: {{ target }}

**Scope:** {{ repository/PR/branch, reviewed files and changes, full base and head revisions, and any exclusions }}

## Review checklist coverage

{{ First section after the title and scope. Account for every Step 3 verification item, every Step 4 rule result and every other selected checklist item, grouped by PR and skill/assessment. Record guidance paths and versions (commit or content hash where unversioned). Link supporting evidence within this report or to exact source revisions. Reading guidance or completing an investigation does not establish that behaviour is correct. }}

{{ Use [x] only for verified satisfactory checks, [ ] for failed/blocked/unverified checks with a reason, and N/A separately with a scope reason. Collapse only categories where every applicable item is satisfactory; identify excluded N/A items. Do not load unrelated guidance just to mark it N/A. If guidance changed after the review, identify retrospective evidence and leave unsupported new checks unverified. }}

- [x] {{ Skill name — fully satisfactory category; supporting evidence and any excluded N/A items. }}

### {{ Skill name — mixed category }}

- [x] **{{ Item label }}** — {{ supporting evidence }}
- [ ] **{{ Item label }}** — {{ failure, blocked check or unverified behaviour; link existing evidence }}
- **N/A:** {{ Item label or wholly inapplicable category }} — {{ scope reason }}

## Research context

{{ Summarise the original problem, intended behaviour, relevant requirements and constraints, affected consumers, and relevant ongoing work. Cite sources. Separate established requirements from assumptions and unknown direction. Include enough context to evaluate the findings without reading the research report. }}

## Assessment

{{ Parent assessment: proceed, proceed with changes, reconsider the approach, or insufficient evidence, with the reason and material limits. State whether supported defects or redesign opportunities were found. Include whether the PR should remain together or be split, with independently reviewable changes and dependencies if a split is recommended. }}

| Level | Assessment and evidence |
| --- | --- |
| Product | {{ Does this solve the right user task? Supported alternative, missing intent or N/A reason. }} |
| Direction | {{ Alignment with supplied direction and actual adoption; unknown where unsupported. }} |
| Design | {{ Simplicity, consistency, ownership and API usability; justified complexity and supported simplifications; no supported redesign is a valid result. }} |
| Readability | {{ Names, file placement, clear ownership, readable code, comments and formatting. Separate project conventions from preferences. }} |
| Correctness | {{ Expected behaviour, defects and verification limits. }} |

{{ Use the caller's severity definitions if supplied. Otherwise use P0 for show-stopping failures such as crashes, leaks or blocking performance problems. Use P1 for wrong success-path behaviour or an approach that needs substantial revision. Use P2 for potential issues and rare edge cases. Base severity on evidence of impact and likelihood. Keep questions distinct from confirmed defects. Preferences and future opportunities are not blockers on their own. }}

## Required fixes

{{ Confirmed P0 and P1 findings needing correction, ranked by severity. For each use the finding structure below. }}

### {{ stable finding ID }} — {{ concise title }}

- **Classification:** {{ defect/convention/preference/question; severity where applicable; PR-scoped improvement or broader opportunity }}
- **Location:** {{ repository-relative path:line and exact revision; locations outside the diff are valid }}
- **Trigger and consequence:** {{ concrete conditions and observable impact }}
- **Evidence:** {{ source-backed code trace, reproduction or validation result; relevant requirements and callers }}
- **Recommendation:** {{ concrete corrective action }}
- **Limits:** {{ uncertainty, affected consumers or unverified conditions; state none if fully established }}

## Suggestions

{{ Non-blocking recommendations and P2 findings, ranked by severity, using the finding structure above. Distinguish confirmed defects, questions, preferences and established conventions. Do not repeat findings from Required fixes. }}

## Design and direction opportunities

{{ Supported product/design alternatives, including opportunities beyond the diff. State current friction, alternative, consumer usage where useful, preserved behaviour, complexity removed, affected consumers, why this change presents the opportunity, migration cost and a feasible first step. Reference related finding IDs rather than repeating findings. Label PR-scoped improvement or broader opportunity separately from severity. Do not invent an inline anchor or make future direction a blocker without a current consequence. Omit when there are no supported proposals. }}

## Nits

{{ Purely aesthetic, non-blocking suggestions. }}

## Decisions and questions

{{ Established decisions with sources, and unresolved questions with the missing evidence, effect on the assessment and next action. Do not present reviewer proposals as agreed decisions. }}

## Verification

{{ Summarise verified success/failure paths and callers, reproduction steps and results, and screenshots where useful. Include the relevant evidence here; supporting artefacts are supplementary. }}

| Command or check | Revision/environment | Result and evidence |
| --- | --- | --- |
| {{ exact command or manual steps }} | {{ reviewed revision and relevant environment }} | {{ passed/failed/blocked/not run, outcome and reason }} |

{{ Identify missing regression coverage and unverified behaviour, why they remain unverified, and their effect on confidence. Do not equate passing tests with correct behaviour. }}

## Consolidation record

{{ List the research report and each Step 3 assessment and Step 4 rule assessment, their source paths and completion status. Identify failed, cancelled or missing inputs and the resulting coverage gaps. Record guidance actually used with its version and result if not already captured in checklist coverage. }}

{{ Briefly record material overlaps merged, contradictions resolved and conclusions excluded, with reasons and evidence. Link concerns already raised in PR comments and explain their disposition. If a contradiction remains unresolved, link the corresponding question or verification gap. Do not copy worker reports here. }}

The completed report must stand alone: include essential research, evidence and conclusions here rather than requiring readers to open worker reports. Replace all placeholders and remove these template instructions. Omit empty finding sections. Keep Review checklist coverage at the top, collapsing only fully satisfactory categories. Do not invent findings or strengths to fill the template.
