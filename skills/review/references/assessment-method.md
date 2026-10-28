# Assessment method

- **Look beyond the diff**: Check real callers, code ownership and similar implementations when they affect the conclusion.
- **Show API changes through caller code**: When proposing an API change, show before-and-after caller code. Explain what becomes clearer or what bookkeeping disappears, including error handling and cleanup where relevant.
- **Understand what must stay the same**: Establish the behaviour that alternatives must preserve before recommending a simpler design.
- **Ask only when the answer matters**: Ask about missing requirements or direction when they could change the assessment. Explain the alternatives, their effects and your recommendation when a choice needs input. Continue other review work while waiting.
- **Follow the risk**: Spend more time on behaviour with a high cost of failure, complex dependencies or weak test coverage. Give simpler changes a lighter review.

## Build and verify the checklist

Build the checklist before checking the code:

1. **Read the guidance**: Read relevant skills and the supporting sections needed for the assigned question.
2. **Make the checks concrete**: Turn each applicable instruction into a check naming the affected code or behaviour. Cite the skill section or rule it comes from. Do not copy examples as universal requirements.
3. **Combine overlaps**: Merge checks that test the same behaviour, including overlaps with the review question's checklist. Keep all source references.
4. **Account for exclusions**: Note guidance sections that do not apply and why. Leave checks blocked when context or access is missing. Do not remove a check just because it is difficult to verify.
5. **Verify and return results**: Record the method, outcome and evidence. Separate source inspection from CI results. Missing evidence does not mean a check passed.

Return the checklist with the assessment. If new risks appear, add checks and record their results. The caller checks coverage against the selected guidance during consolidation and follows up on missing checks or weak evidence.

