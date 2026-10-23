# CI-only validation guidance check — 23 October 2026

A separate read-only agent exercised the updated review workflow, Galaxy wrapper and report templates. This was a hypothetical instruction check, not an actual CI verification or PR review.

| Scenario | Expected behaviour |
| --- | --- |
| Current head has failed tests and skipped lint | Read relevant logs and scope. Record CI failed and CI skipped with revision and links. Do not infer PR causation. Continue source review. |
| Green CI belongs to an older head | Treat it as historical. Do not claim current-head validation. Record missing, pending or inaccessible current results accurately. |
| Local branch has no accessible CI | Continue source and test-code inspection. Report CI unavailable and dependent checks blocked or not verified. Do not install dependencies or run local substitutes. |
| Specialist testing guidance says to run tests | Apply the main review boundary. Inspect tests and matching CI execution instead. Local checks are not run by design, not blocked by missing setup. |

No remaining local project-validation requirement was found in the workflow or templates. The parent also explicitly excluded custom runtime harnesses and local services, added CI refresh before publishing, and made CI status visible in the assessment table.

The global worktree guidance describes installing dependencies after creating a worktree. The user's explicit no-install requirement takes precedence for this review workflow. That boundary is passed to workers.

Skill metadata validation, local Markdown link checks and `git diff --check` passed. No project dependency installation, build, tests, linter, formatter, typecheck or CI trigger was performed for this guidance check. No actual CI results are claimed.
