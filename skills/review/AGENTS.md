# Review workflow and rules

## Main skill

- Keep setup, research, broad code review, focused rule checks, consolidation and GitHub publishing as distinct steps.
- The coordinator owns order, delegation, inputs and outputs. Each unit skill (`review-risk`, `review-research`, `review-guidance`, `review-assess`, `review-rules`, `review-report`) owns how its work is done. Keep each instruction in one place.
- Each unit names its saved file. The evals check these names, so update [the evals](../../evals/README.md) when one changes.
- Select best-practice guidance by inspecting available skill descriptions. Do not maintain a fixed list of technology skills in the workflow.
- Ask review agents to generate concrete checks from selected guidance, cite source sections and return methods, results and evidence.
- Merge overlapping checks and explain excluded guidance. Keep source inspection distinct from executed tests or browser checks.
- The parent verifies claims, checks coverage and resolves disagreements. It must not just concatenate worker reports.
- Use repository documents for context, not additional review-policy checklists. Preserve required operational instructions.
- Use CI for automated results. No dependency installs or local project checks.
- Keep detailed CI evidence in the canonical report and its fold. Explain concise actionable CI blockers in the summary or Next steps when they affect the recommendation. No general CI rollup in the short summary and no CI status in inline comments.
- Check size before delegating. Over 2,000 added lines normally gets a split plan, not a full implementation/rule review.

## Templates

- Store report formats in `templates/`, not `assets/`. The saved report template lives in `review-report/templates/`.
- Let templates define report sections. Avoid repeating their full field lists in the main skill.
- The saved report leads with an assessment and findings table. GitHub results start with a compact overall verdict, risk and rule summary, then research and approach folds, Next steps and Findings grouped by P0/P1/P2. Keep shared finding IDs and distinguish existing concerns from new findings. The seven approval checks and detailed coverage belong inside Full report, without duplicate tables or reviewed-commit headers.
- Use short inline code examples when they clarify findings or design alternatives. Pin current excerpts to the reviewed revision and label proposed code.
- Prefer inline comments for new bugs with valid current diff anchors. Summarise them in the body with the same finding number. Link existing threads instead of duplicating them.
- Identify new findings versus existing PR concerns. Keep required fixes, suggestions, design opportunities and nits distinct.
- Preserve every generated check with guidance references, method, result and evidence or a reason it was not verified.
- Keep the final report self-contained. Source links supplement the explanation.
- PR progress and results publish by default, with a local-only override. Keep lifecycle mechanics in the publication helper and presentation in the comment template. Do not require copying published comments back into the saved report.
