# Review instructions

The experimental workflow embeds these Markdown files into its generated JavaScript. Workers receive their instructions directly; they do not need to find sections in this index. Edit the relevant file and run `npm run build` to update the installed workflow.

## Shared instructions

- [Shared review rules](prompts/common.md): constraints and review goals, prepended to every review worker.
- [Assessment guidance](prompts/assessment.md): checklist construction and evidence standards for all five assessments.
- [Report requirements](prompts/reporting.md): report style and coverage shared by drafting, editing and acceptance.

## Named steps

- [Setup](prompts/setup.md)
- [Research](prompts/research.md)
- [Check research](prompts/researchCheck.md)
- [Product assessment](prompts/product.md)
- [System fit assessment](prompts/systemFit.md)
- [Simplicity assessment](prompts/simplicity.md)
- [Readability assessment](prompts/readability.md)
- [Correctness assessment](prompts/correctness.md)
- [Review rules](prompts/rules.md)
- [Consolidate evidence](prompts/consolidation.md)
- [Draft the report](prompts/draft.md)
- [Edit the report](prompts/editorial.md)
- [Accept the report](prompts/report.md)
- [Plan a split-only review](prompts/splitPlan.md)
- [Assess the decision](prompts/decision.md)
- [Publish accepted results](prompts/publication.md)

The workflow also embeds the [report template](templates/review-report.md) and [GitHub summary template](templates/github-progress.md) where they are needed. The rule index and individual rules remain files selected and read during the review, as do specialist guidance and caller-supplied context.

The [entry skill](SKILL.md) describes launch arguments and delivery restrictions. The [workflow guide](../../workflows/README.md) explains execution order, saved files and test boundaries. The original review skill remains unchanged.
