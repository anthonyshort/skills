---
name: split-pr
description: Plan how to break a large or mixed PR into smaller, reviewable PRs or a stack. Use when asked to split a change or develop a concrete slicing plan.
---

# Split a PR

Create a plan that makes each change easier to understand, verify and recover from.

Default to planning. Change code, commits or branches only when requested.

## Find useful boundaries

1. **Understand the outcome:** Establish the intended behaviour and what must remain unchanged.
2. **Separate the changes:** Identify new implementations, mechanical changes, test preparation, package changes and behavioural changes.
3. **Map dependencies:** Establish which changes actually need to land together or in a particular order.
4. **Choose useful slices:** Give each PR an explainable purpose and meaningful verification. Use the slicing options below.
5. **Check intermediate states:** Each PR should build, pass relevant checks and leave the system in a supported state.
6. **Plan activation and rollback:** Keep the behavioural cut-over small where practical. Explain how to restore the previous path.

Prefer boundaries that reduce what a reviewer must understand at once. Do not split by file count or line count alone.

## Choose a slicing approach

- **Vertical slice:** Deliver one small outcome end to end. Keep the required layers together so the reviewer can understand and verify the complete behaviour.
- **Horizontal slice:** Group low-risk preparation across several areas. Changes may support different outcomes, but each should be small, safe and easy to verify. Explain why they belong together and why they are safe.

Choose vertical slices when seeing the complete behaviour makes review easier. Choose horizontal slices when separating safe preparation makes later behaviour changes smaller and clearer. A stack can use both approaches.

For example, a small filter change might keep its loader, state, UI and tests together. A replacement loader might land tested but inactive, followed by a small consumer switch. Neither example requires dividing every change by technical layer.

## Useful early slices

Consider these options when they can stand independently:

- **New utilities or replacement code:** Add focused tests before introducing callers.
- **Renames and mechanical refactors:** Separate review noise from later behaviour changes. Check consumer compatibility and runtime behaviour as well as types.
- **Test refactors:** Prepare reliable coverage without changing production behaviour or weakening assertions.
- **Package changes:** Limit the owners and dependency boundaries involved in each PR. Preserve compatibility between packages at each step.

These are options, not a required sequence. Avoid preparation that creates unnecessary abstractions or leaves unused code indefinitely.

## Keep activation easy to review

Where practical, land preparation and the replacement implementation before switching consumers.

- **Verify inactivity:** Check imports, registration, initialisation and side effects. New code can affect production without an obvious direct caller.
- **Delay the cut-over:** Put activation or the consumer switch in a small later PR. Keep risky behaviour changes concentrated where they are easy to inspect.
- **Preserve rollback:** Reverting the cut-over should restore the previous path without requiring all preparation to be reverted.
- **Check compatibility:** Data writes, migrations and removed contracts can make rollback unsafe. State these limits explicitly.
- **Finish the transition:** Identify when the old implementation can be removed and who still depends on it. Keep it available while rollback requires it.

Do not add a flag or parallel implementation solely to create a stack. Explain when that machinery is worth its cost.

## Deliverable

Return a short rationale and a proposed stack:

| PR | Purpose and affected code | Depends on | Verification | Production effect and rollback |
| --- | --- | --- | --- | --- |
| 1 | ... | ... | ... | ... |

For each slice, explain what stays unchanged. Distinguish proposed checks from checks actually run. Mark missing evidence and unresolved dependencies.

Explain:

- Why these boundaries reduce review difficulty or risk.
- Where behaviour first changes.
- How intermediate states remain valid.
- How the cut-over can be reverted.
- Any changes that should remain together.
- Open questions that could change the plan.

A stack is not always better. Recommend keeping the PR together when splitting would make the change harder to understand or verify.
