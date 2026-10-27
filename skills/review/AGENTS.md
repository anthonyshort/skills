# Review workflow and rules

## Main skill

- Keep setup, research, broad code review, focused rule checks, consolidation and GitHub publishing as distinct steps.
- Select best-practice guidance by inspecting available skill descriptions. Do not maintain a fixed list of technology skills in the workflow.
- Ask review agents to generate concrete checks from selected guidance, cite source sections and return methods, results and evidence.
- Merge overlapping checks and explain excluded guidance. Keep source inspection distinct from executed tests or browser checks.
- The parent verifies claims, checks coverage and resolves disagreements. It must not just concatenate worker reports.
- Use repository documents for context, not additional review-policy checklists. Preserve required operational instructions.
- Use CI for automated results. No dependency installs or local project checks.
- Keep detailed CI evidence in the canonical report and its fold. Explain concise actionable CI blockers in the summary or Next steps when they affect the recommendation. No general CI rollup in the short summary and no CI status in inline comments.
- Check size before delegating. Over 2,000 added lines normally gets a split plan, not a full implementation/rule review.

## Add a rule

Put each focused rule in its own Markdown file under `rules/`. Use a clear, plain-English title and descriptive kebab-case filename.

Include:

- **When to check**: The changes that make the rule relevant.
- **What to check**: Concrete questions and the code relationships to trace.
- **Why it matters**: The problem or unnecessary complexity it addresses.
- **Exceptions**: Valid reasons to keep the current design.
- **Good and bad examples**: Comparable TypeScript examples with assumptions and limits made explicit.

Update `rules/README.md` with the rule link and selection criteria. One subagent receives the parent's research and context and checks the rules one at a time across all supplied collections. All rules must be accounted for as selected or skipped, with reasons.

Add a case to [the review evals](../../evals/review/README.md) when a rule or guidance change should catch a new kind of problem.

A pattern match is not automatically a defect. Require a supported consequence or useful simplification. Do not hide missing implementations behind helper names that merely promise safety.

## Templates

- Store report formats in `templates/`, not `assets/`.
- Let templates define report sections. Avoid repeating their full field lists in the main skill.
- The saved report leads with an assessment and findings table. GitHub results start with a compact overall verdict, risk and rule summary, then research and approach folds, Next steps and Findings grouped by P0/P1/P2. Keep shared finding IDs and distinguish existing concerns from new findings. The seven approval checks and detailed coverage belong inside Full report, without duplicate tables or reviewed-commit headers.
- Use short inline code examples when they clarify findings or design alternatives. Pin current excerpts to the reviewed revision and label proposed code.
- Prefer inline comments for new bugs with valid current diff anchors. Summarise them in the body with the same finding number. Link existing threads instead of duplicating them.
- Identify new findings versus existing PR concerns. Keep required fixes, suggestions, design opportunities and nits distinct.
- Preserve every generated check with guidance references, method, result and evidence or a reason it was not verified.
- Keep the final report self-contained. Source links supplement the explanation.
- PR progress and results publish by default, with a local-only override. Keep lifecycle mechanics in the publication helper and presentation in the comment template. Do not require copying published comments back into the saved report.
