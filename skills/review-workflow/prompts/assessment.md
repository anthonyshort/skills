# Assessment guidance

The workflow assigns one worker to each review question below after accepting the corrected `researchCheck` brief. Use both supplied research results as evidence, with `researchCheck` taking precedence when conclusions conflict. Return only the named assessment, including checklist results, evidence and reasons for any N/A or blocked checks. The workflow waits for all five assessments before scheduling the rule pass and consolidation.

Use this guidance to plan the assigned assessment. Adapt it to the change and investigate other relevant risks. These are not exhaustive checklists.

## Assessment boundaries

- Use the pinned scope, research, CI evidence and exact guidance paths supplied in your assignment.
- Inspect available descriptions in [best-practices](../best-practices/) and select guidance relevant to your question. Build the checklist below rather than using a fixed list of skills.
- Keep readability separate from correctness, system fit and simplicity. For changes without readable source, record why readability is not applicable.
- Reach your own conclusions. Record weak evidence, unanswered questions and remaining risks for consolidation.
- Do not create more agents. Return gaps when the assigned investigation cannot resolve a question.

## Review best practices

- **Look beyond the diff**: Check real callers, code ownership and similar implementations when they affect the conclusion.
- **Show API changes through caller code**: When proposing an API change, show before-and-after caller code. Explain what becomes clearer or what bookkeeping disappears, including error handling and cleanup where relevant.
- **Understand what must stay the same**: Establish the behaviour that alternatives must preserve before recommending a simpler design.
- **Ask only when the answer matters**: Ask about missing requirements or direction when they could change the assessment. Explain the alternatives, their effects and your recommendation when a choice needs input. Continue other review work while waiting.
- **Follow the risk**: Spend more time on behaviour with a high cost of failure, complex dependencies or weak test coverage. Give simpler changes a lighter review.

## Build and verify the checklist

Each assessment worker builds its checklist before checking the code:

1. **Read the guidance**: Read relevant skills and the supporting sections needed for the assigned question.
2. **Make the checks concrete**: Turn each applicable instruction into a check naming the affected code or behaviour. Cite the skill section or rule it comes from. Do not copy examples as universal requirements.
3. **Combine overlaps**: Merge checks that test the same behaviour, including overlaps with the review question's checklist. Keep all source references.
4. **Account for exclusions**: Note guidance sections that do not apply and why. Leave checks blocked when context or access is missing. Do not remove a check just because it is difficult to verify.
5. **Verify and return results**: Record the method, outcome and evidence. Separate source inspection from CI results. Missing evidence does not mean a check passed.

Return the checklist with the assessment. If new risks appear, add checks and record their results. The consolidation worker checks coverage against the selected guidance, investigates missing checks or weak evidence, and records unresolved gaps.
