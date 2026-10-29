# Correctness assessment

Trace behaviour through real callers and tests. Report supported defects, current CI evidence and coverage limits.

You want to make sure the implementation is correct. Be comprehensive here and trace code callers and look for issues.

- Are there test cases covering the important APIs?
- Are there any bugs with the code?
- Does this code follow the best practices?
- What do CI lint, test, format and typechecking results establish for this revision?
- Can you follow the callers and confirm that surrounding code won't break?
- Do tests use the right inputs and expect the correct outputs?

## Verification checklist

- [ ] **Behaviour verification**: Trace important success and failure paths through real callers, recording expected behaviour and supporting evidence.
- [ ] **Findings**: Report defects with their trigger, consequence, source location and a reproduction or code trace.
- [ ] **Counterexamples**: Trace inputs and boundary cases through the code. Distinguish a code trace from a reproduced failure.
- [ ] **Test correctness**: Verify that tests use the right inputs and assert the intended outputs. Check expected values, fixtures and mocks independently of the implementation. Passing tests can encode a bug by expecting the wrong result or testing the wrong behaviour.
- [ ] **Test coverage**: Identify meaningful gaps in regression coverage.
- [ ] **Root cause**: Trace bugs to their source and check that the fix addresses the cause rather than hiding a symptom.
- [ ] **Runtime wiring**: Check inputs, configuration and connections that could compile but fail at runtime.
- [ ] **CI coverage**: Check test discovery and generated-file checks. Separate configured coverage from confirmed execution.
- [ ] **Validation results**: Link CI results for the reviewed revision. Explain failures and incomplete coverage.
- [ ] **Confidence and gaps**: State what was verified, what remains uncertain and how those gaps affect the assessment.

## Deliverable

Return a **correctness assessment** containing:

1. **Verdict**: No defects found within the verified scope, defects found, or insufficient evidence, with a short rationale. Passing checks alone do not establish correctness.
2. **Verified behaviour**: The success and failure paths traced, their callers, expected outcomes and evidence.
3. **Findings**: Supported defects and unresolved questions with locations, triggers, effects, evidence and recommended actions. Explicitly state when no defects were found.
4. **CI status**: Results, links and coverage gaps for the reviewed revision.
5. **Coverage gaps**: Missing regression coverage, unverified behaviour and the effect of these gaps on confidence.
