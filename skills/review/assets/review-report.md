# Review: {{ target }}

**Scope:** {{ files, base revision, and reviewed changes }}

## Review checklist coverage

{{ First section after the title and scope, grouped by PR and selected skill. Record checklist versions. Account for every selected checklist item. }}

- [x] {{ Skill name — fully satisfactory category; identify any excluded N/A items. }}

### {{ Skill name — mixed category }}

- [x] **{{ Item label }}** — {{ supporting evidence }}
- [ ] **{{ Item label }}** — {{ failure, blocked check or unverified behaviour; link existing evidence }}
- **N/A:** {{ Item label or wholly inapplicable category }} — {{ scope reason }}

## Assessment

{{ Concise overall assessment, intent, and material limits. }}

| Level | Assessment and evidence |
| --- | --- |
| Product | {{ Does this solve the right user task? Supported alternative, missing intent or N/A reason. }} |
| Direction | {{ Alignment with supplied direction and actual adoption; unknown where unsupported. }} |
| Design | {{ Simplicity, consistency and API usability; no supported redesign is a valid result. }} |
| Correctness | {{ Expected behaviour, defects and verification limits. }} |

## Required fixes

{{ P0 and P1 findings needing correction, ranked by severity: path:line, consequence, triggering conditions, and recommendation. }}

## Suggestions

{{ Non-blocking recommendations and P2 findings, ranked by severity. Distinguish confirmed defects, preferences, and established conventions. }}

## Design and direction opportunities

{{ Supported product/design alternatives, including opportunities beyond the diff. State current friction, alternative, consumer usage where useful, preserved behaviour, complexity removed, migration cost and a feasible first step. Label PR-scoped improvement or broader opportunity separately from severity. Do not invent an inline anchor or make future direction a blocker without a current consequence. Omit when there are no supported proposals. }}

## Nits

{{ Purely aesthetic, non-blocking suggestions. }}

## Decisions and questions

{{ Agreed design decisions and unresolved questions. }}

## Verification

{{ Checks performed, reproduction steps, screenshots where useful, and unverified behaviour. }}

## Inline comment drafts

{{ Group by PR and file. Include only proposed new inline comments; state when none are proposed. Record pending review links when authorised staging has occurred. }}

### {{ draft ID }} — {{ repository-relative file path }}

- **PR:** {{ PR link }}
- **Reviewed head:** {{ full commit SHA }}
- **Diff base:** {{ full diff-base commit SHA; required for LEFT anchors }}
- **Anchor:** {{ LEFT or RIGHT, one-based line or line range }}
- **Assessment:** {{ severity and confirmed finding, preference, or unresolved question }}

```{{ language }}
{{ Short exact-revision code excerpt; identify target lines outside the code fence. }}
```

**Comment:**

> {{ Exact GitHub comment body in the selected writing voice, preserving impact and certainty. Do not force a priority prefix; use nit only for an optional aesthetic suggestion. End with the GitHub attribution footer. }}

Omit empty finding sections. Keep Review checklist coverage at the top, collapsing only fully satisfactory categories. State when no new inline comments are proposed. Do not invent findings or strengths to fill the template. Drafting does not authorise staging or submission.
