# Review rules

## Add a rule

Put each focused rule in its own Markdown file under `rules/`. Use a clear, plain-English title and descriptive kebab-case filename.

Include:

- **When to check**: The changes that make the rule relevant.
- **What to check**: Concrete questions and the code relationships to trace.
- **Why it matters**: The problem or unnecessary complexity it addresses.
- **Exceptions**: Valid reasons to keep the current design.
- **Good and bad examples**: Comparable TypeScript examples with assumptions and limits made explicit.

Update `rules/README.md` with the rule link and selection criteria. One subagent receives the parent's research and context and checks the rules one at a time across all supplied collections. All rules must be accounted for as selected or skipped, with reasons.

Add a case to [the rule evals](../../evals/README.md) when a rule or guidance change should catch a new kind of problem.

A pattern match is not automatically a defect. Require a supported consequence or useful simplification. Do not hide missing implementations behind helper names that merely promise safety.
