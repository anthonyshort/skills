---
name: galaxy-review
description: Apply Anthony's personal review priorities to a requested Galaxy PR or branch. Use the generic review workflow and gather work-specific context from the authorised checkout rather than relying on embedded project details.
---

# Galaxy review

## Scope

This is the shareable version of a personal work-review profile. It contains review
preferences, not a description of the work repository. Confirm the target checkout,
repository and base/head revisions with the caller's task. Do not infer a repository
owner, service endpoint or local filesystem path from the skill name.

Focus on correctness, simplicity, ownership, reuse, consumer APIs and fit with
supplied product and architectural direction. Keep personal preferences separate
from defects and accepted project requirements. Do not expand the task into a
blanket repository-policy audit. Retain applicable instructions and operational
constraints; resolve any conflicting review-policy scope through instruction priority.

A caller may supply an exact private profile or local reference path. That explicit
source takes precedence over this shareable profile. Record the source used, and do
not silently substitute a same-named skill discovered elsewhere.

## Run the generic coordinator once

Invoke [review](../review/SKILL.md) once with this profile. The generic coordinator
owns context research, the completed-context gate, guidance selection, delegation,
verification and synthesis. Do not launch a second orchestration workflow here.

Pass the following to the coordinator:

- The caller's repository, revisions, requested scope and any explicit profile overrides.
- [Context questions](references/context.md), selecting only affected categories.
- [Review output](references/review-output.md), which replaces the generic report layout.
- [Writing voice](../writing-voice/SKILL.md), for the main reviewer at synthesis only.
- The generic review's environment constraints: no dependency installation or implicit
  tool downloads for reviews; use existing tools, source, tests and CI. Keep scratch
  work in its prescribed directory or the caller's workspace.
- Preview testing is disabled for this profile. Do not discover preview URLs or
  attempt browser authentication. Record relevant browser behaviour as unverified.

Complete and integrate the context brief before correctness or design review. A
completed brief supplied by a parent satisfies that gate. Use available equivalent
agents or the generic review's documented fallback when named agents are unavailable.

Select the generic technology skills for the changed code. Assign exact paths and
specific check categories to their owners; avoid loading unrelated guidance or
copying reporting templates into worker briefs. Preserve coverage and evidence
requirements from the generic coordinator.

## Work context and disclosure

Obtain project-specific facts from the authorised checkout, relevant tests and
caller-supplied documents. Verify available APIs in the reviewed revision. Separate
current behaviour from future direction; ask when missing intent materially changes
an assessment. Do not invent conventions to replace missing private context.

Do not copy private code, internal API inventories, architecture descriptions,
roadmaps, employee/customer details, internal URLs or credentials into this skill
repository. Keep those facts in the authorised review workspace or report. Use
available connected sources only within the caller's authorised scope; do not send
internal search terms or source excerpts to public search engines.

## Completion

At synthesis, load the output reference and writing voice. Assess product, direction,
design and correctness, then reconcile every selected generic and profile check.
Embed the factual research and its sources in the saved report. Record exact source
versions, actual agent/skill execution, selected/excluded categories and verification
gaps; loading a skill is not evidence that its checks passed.

Keep CI status separate from merge confidence under the output policy. Staging or
submission requires the caller's authorisation. A supplied job's stricter status or
publication constraints take precedence over this profile's defaults.
