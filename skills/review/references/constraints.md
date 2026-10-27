# Review constraints

These apply to the review coordinator and every review unit, including subagents.

- Use this skill, its rules and relevant specialist skills as the review criteria. Do not add checks from repository review guides or style documents.
- Use repository documents to understand intent, behaviour and architecture. Treat them as context, not additional review checklists.
- Follow operational instructions needed to access the code and CI evidence, along with any instructions required by the agent environment.

- Do not perform code changes.
- Only mark checklist items done after verifying.
- Explain any N/A or blocked checks.
- Separate current behaviour, accepted conventions, personal preferences and future direction.
- Reading guidance or checklists alone does not complete checks.
- Do not invent product requirements or require speculative future migrations.
- Provide evidence for each claim of correctness and completion.
- Use existing checkouts, Git objects and installed tools.
- Do not install dependencies or tools. Do not run local builds, tests, linters, formatters or typechecks.
- Use CI for automated results. This applies to workers and specialist guidance too. Do not trigger jobs.
- Do not create runtime test harnesses or start local services. Use an existing deployment for manual checks.
