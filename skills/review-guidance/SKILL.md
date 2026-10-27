---
name: review-guidance
description: Choose the best-practice skills that apply to a code change for each review question. Part of the review workflow.
---

# Review guidance selection

Choose which best-practice skills each review question should use. Follow [the review constraints](../review/references/constraints.md).

## Inputs

- The repository, base and head revisions, and full diff.
- The research brief.
- The skill directories to choose from: [best-practices](../best-practices/) and any supplied by a wrapper.

## Choose the guidance

1. **Read the descriptions:** Read the `name` and `description` of every skill in the supplied directories. Do not rely on a fixed list of skill names.
2. **Match the change:** Select a skill when the change uses its technology or does the kind of work it describes. Trace the changed files, imports and dependencies rather than matching file extensions alone.
3. **Assign to questions:** For each review question (product, system fit, simplicity, readability and correctness), list the selected skills it should use. Note the sections or references that matter most when a skill is large.
4. **Account for every skill:** Give a short reason for each skill you did not select.

## Deliverable

Save `guidance.md` in the review artefact directory with:

- **Selected skills:** Path, reason and the review questions that use it.
- **Skipped skills:** Path and reason.
