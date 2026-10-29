# Assess the decision

Perform the final approval assessment without publishing. Return `approval` in the seven-check schema below, `summaryMarkdown` following the embedded GitHub progress template, and `inlineComments` for verified new bugs with valid diff anchors only.

Read the sibling `writing-voice/SKILL.md` under the parent of `input.skillRoot` when preparing `summaryMarkdown`. Use that guidance with the embedded GitHub summary template.

Each inline ID must exactly match a retained report ID whose source is a new bug. Required retained findings and unresolved findings cannot pass `clean_review`. Do not introduce new findings. For split-only output use outcome `split`, `checks: null` and no inline comments. Count additions plus deletions across the whole diff.

A later workflow delivery worker owns publication and approval submission. Honour `input.publication`: `local-only`, `staged` and `comment-only` never allow automatic approval. If all checks pass, use `not_submitted` with the restriction as its reason and an actionable next step. A staged run saves payloads locally; it does not create a pending GitHub review.

1. **Complete the approval checklist.** Refresh the diff, discussion and relevant CI. Record Pass, Fail or Not verified with evidence for each check. Approval requires all seven to pass.
   - **Clear and focused:** The whole change and affected callers are understood and serve one task.
   - **Limited consequences:** A mistake would not lose saved work, expose private data, charge incorrectly or disrupt a shared service.
   - **Avoids sensitive behaviour:** No changed protected access, destructive data operations, migrations, dependencies or deployment settings. Existing permission checks for empty pages can qualify without exposing protected data or actions.
   - **No required fixes:** No bugs, required corrections or unanswered questions that could change the recommendation.
   - **Review finished:** Research, source review, rule checks and the report are complete.
   - **Checks support the change:** Relevant CI passed for this head or its matching merge commit and covers the important behaviour. Verified test-group inclusion suffices. Prose-only changes may use source inspection. Explain any remaining gaps.
   - **Earlier concerns resolved:** Substantive concerns and requests for changes have been addressed.

2. **Choose an outcome and explain the next step.** Use the first applicable case:
   - `split`: The review stopped at a split plan. Propose smaller PRs. Use `checks: null`, with no approval table or inline implementation findings.
   - `human_review`: Risk, sensitive changes, project policy or an unresolved product/ownership decision requires a person. Explain what they should review, even if CI passes.
   - `incomplete`: Reviewer work remains. Finish it or explain what blocks it.
   - `changes_needed`: The review is complete and otherwise eligible, with specific fixes or evidence the author can provide. List those actions and request another review without promising approval.
   - `waiting_checks`: Only relevant CI is still pending. Request another review when results arrive.
   - `not_submitted`: All checks pass, but submission is blocked. Name the blocker and its owner without changing the content answers.
   - `approve`: All checks pass and submission is allowed. Report Approved only after GitHub confirms submission or recovery.

3. **Return the approval assessment.** The writer saves it as `approval.json`. Use the review's actual answers and reasons. Example:

   ```json
   {
     "outcome": "approve",
     "changed_lines": 24,
     "checks": {
       "focused": {"result": "Pass", "reason": "One label correction."},
       "low_risk": {"result": "Pass", "reason": "Display text only; saved values are unaffected."},
       "no_sensitive_changes": {"result": "Pass", "reason": "No protected data, actions or configuration change."},
       "clean_review": {"result": "Pass", "reason": "No required corrections remain."},
       "complete_review": {"result": "Pass", "reason": "All review stages and the report are complete."},
       "verification": {"result": "Pass", "reason": "Source inspection verifies the prose correction."},
       "concerns_resolved": {"result": "Pass", "reason": "No earlier substantive concerns remain."}
     },
     "reason": "Corrects a label without changing behaviour.",
     "next_steps": []
   }
   ```

   - Count additions plus deletions across the whole PR. Use single-line reasons and actions. `next_steps` must contain an action unless the outcome is `approve`.
