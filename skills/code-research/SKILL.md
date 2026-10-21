---
name: code-research
description: Gather source-backed context for a PR, branch, diff, or implementation task from code, issues, related changes, and available documents or conversations.
---

# Code research

## Goal

Use sources to establish intent, current behaviour, and design context for implementation or review.

## Checklist

Track checks in task notes, not here. Mark done only after verifying; explain N/A and report blocked or unverified checks. Run independent checks in parallel where useful.

**Scope**

- [ ] **Research question** - Identify the target and decisions needing context.
- [ ] **Project instructions** - Read the applicable rules.
- [ ] **Target code** - Read the full diff or target code and supplied description.
- [ ] **Current behaviour** - Trace callers, consumers, and tests.

**Sources**

- [ ] **Existing discussion** - Read comments and unresolved review threads.
- [ ] **Linked context** - Follow relevant issues, RFCs, architecture documents, and changes.
- [ ] **Connected sources** - Search documents and conversations using changed concepts and identifiers.
- [ ] **Search period** - Start with two weeks of conversations; extend for older decisions.
- [ ] **Current policy** - Check historical guidance still applies; one example does not establish policy.
- [ ] **Missing sources** - Report unavailable sources and continue with accessible evidence.

**Conclusions and boundaries**

- [ ] **Facts and assumptions** - Separate behaviour, intent, historical decisions, and assumptions.
- [ ] **Stopping point** - Stop when decisions are supported or a missing source blocks progress.
- [ ] **Context brief** - Return a sourced brief with decisions and open questions.
- [ ] **Read evidence** - Claim a source was checked only after reading it.
- [ ] **Read-only research** - Leave records unchanged; do not message people or publish.

## Guidance

### Scope

- Focus the question on a decision the work needs; leave out context that cannot affect it.
- Use project instructions to establish limits, applying any supplied review-policy scope override while retaining operational constraints and relevant API mechanics. Read the complete diff or target code before following external links.
- Trace entry points to callers, consumers, and tests. Use current code to establish behaviour; use descriptions and discussions to establish intent.

### Sources

- Read existing comments for unresolved concerns and findings already raised.
- Follow linked issues, RFCs, architecture documents, and related PRs before broad searches.
- Search connected sources with changed identifiers, product concepts, and links. Search older conversations when a relevant decision falls outside the initial period.
- Compare historical guidance with current code and later decisions before treating it as policy.
- For unavailable sources, identify the blocked conclusion and continue with evidence that can answer the question.

### Conclusions and boundaries

- Attach sources to decisions and label unsupported explanations as assumptions. A search result or unread link is not checked evidence.
- Return scope/base/head, intended outcome, affected consumers, sourced decisions, existing findings, and open questions. Separate the user's product task, current behaviour and patterns, accepted preferences, future direction and actual migration/API adoption. Include directly comparable implementations and sources that a design reviewer can inspect; do not infer desired direction from current code alone. Identify conclusions that depend on missing sources.
- In a coordinated review, gather facts rather than findings. Return the completed brief to the parent for saving and integration before review begins. Do not create documents when the agent role is read-only; report inaccessible connected sources rather than claiming they were checked.
- Keep research read-only. Source access permits reading, not editing records, messaging people, or publishing findings.
