# Galaxy review additions

This skill wraps `review`. Keep it short and describe only Galaxy additions under the corresponding main workflow steps.

## Boundaries

- Do not duplicate research, checklist generation, delegation, verification or report formats from the main review skill.
- Add Galaxy guidance and rules to the main selection processes. Use the same generated-checklist process and single rule-checking subagent.
- Do not introduce separate orchestration or Galaxy output templates.
- Do not add merge-confidence scores or automatic approval. Requested submissions are COMMENT only, never APPROVE or REQUEST_CHANGES.
- Do not restore blanket bans on dependency installation, missing tools, temporary directories or preview testing. Follow the main workflow and actual execution permissions.

## Galaxy best practices

- Put skills under `best-practices/nominal-galaxy-<topic>/SKILL.md`. Match the frontmatter name to the folder.
- Keep current API mechanics, ownership and migration guidance here. State when branch-specific availability must be verified.
- Follow the same authoring conventions as the general best-practice skills: concise guidance, no opening checklists and no cross-skill or review-rule references.
- Link only to references within the same skill. Repository paths may identify context to inspect, but do not import repository review policies.
- Remove general guidance already covered by the shared skills unless a short reminder is needed to explain a Galaxy-specific API.

## Galaxy rules

- Put focused Galaxy design checks in `rules/`, with selection criteria in `rules/README.md`.
- Use the same format as general review rules: when, what, why, exceptions and good/bad examples.
- Explain why the check is specific to Galaxy. If it applies generally, consider the main review rules instead.
- Treat illustrative API names as proposals, not proof that an API exists. Verify actual contracts and ownership.

When renaming this wrapper, update repository links and documentation. External agent installations and automation paths may also need changes, but do not claim those were updated without checking them.
