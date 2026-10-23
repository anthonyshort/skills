# Approval validation and examples

Three subagents assessed five Galaxy PRs on 23 October 2026 using [the approval checklist](../../../../skills/review/SKILL.md#step-6-publish-results). These were bounded trials, not five new full reviews. The publication tests use an in-memory GitHub backend. No live reviews, comments, approvals or CI jobs were created.

## Real PR trials

| PR and reviewed head | Changed lines | Content result | Evidence and remaining work |
| --- | --- | --- | --- |
| [#22173](https://github.com/nominal-io/galaxy/pull/22173), `953f303c34ee8afb066435fa2d92410775635021` | 378 | Seven Pass | Empty settings pages reuse existing permissions. [Same-head full review](https://github.com/nominal-io/galaxy/pull/22173#issuecomment-6369543472) and [passing CI](https://github.com/nominal-io/galaxy/actions/runs/39982886244/job/120515107983) support approval. |
| [#22376](https://github.com/nominal-io/galaxy/pull/22376), `8f75f8f2373eb03565de9195f13936ff7fb2e0bb` | 199 | Not verified | Shared inspector spacing changes. Finish caller/layout review and assess relevant visual coverage; 127 test targets passed. [CI](https://github.com/nominal-io/galaxy/actions/runs/39982984698/job/120515517707). |
| [#22380](https://github.com/nominal-io/galaxy/pull/22380), `10ac680f1811c5a513f8456829a34eb322b1a94e` | 194 | Not verified | Citation accessibility fix with relevant passing regression tests. Finish shared hover-card/coachmark review. [CI](https://github.com/nominal-io/galaxy/actions/runs/39953952676/job/120415573551). |
| [#22400](https://github.com/nominal-io/galaxy/pull/22400), `0d0a886c0791a7aa32812af4402397ac9cc9c172` | 30 | Fail | Dependency update is excluded. [Worker-assets question](https://github.com/nominal-io/galaxy/pull/22400#discussion_r4361407468) also remains unanswered. |
| [#22393](https://github.com/nominal-io/galaxy/pull/22393), `76f8bf57dd92540bf8d90e6415bc3d70a2f4f4a1` | 206 | Fail | A mistake in durable document-update handling could lose edits. Relevant tests passed, but human approval is still required. [Source](https://github.com/nominal-io/galaxy/blob/76f8bf57dd92540bf8d90e6415bc3d70a2f4f4a1/packages/multiplayer-server/src/connection.ts#L404-L460). |

All five remain comment-only under the Galaxy wrapper; #22393 was also a draft. These submission restrictions do not falsify content answers. Existing human approvals were not treated as proof that the checklist passed.

For #22173, the initial uncertainty about test execution was resolved by evaluating the [pinned grouping rules](https://github.com/nominal-io/galaxy/blob/953f303c34ee8afb066435fa2d92410775635021/bazel/js/vitest_groups.bzl) over the pinned Git-tree test names. Both `OrgAdminRoute.test.tsx` and `SideNavSettingsPages.test.tsx` belong to `unit_utils`, a 150-file group. The parent independently reproduced the grouping and confirmed `unit_utils PASSED in 204.3s` in the exact-head CI log. Individual suite names need not appear in the summary. The same-head report establishes completed review stages; browser checks and detailed replay-warning attribution were not independently required for these empty pages.

The trials supported dropping the original 50-line cutoff, separating Fail from Not verified, and distinguishing completed review stages from sufficient verification. A green replay check with no changed-code coverage supplies no evidence for that behaviour.

## Publication validation

- 47 tests pass with `python3 -m unittest discover -s skills/review/scripts -p 'test_*.py'`.
- Skill-creator validation and `git diff --check` pass. Relative links and the policy's JSON example were checked.
- All seven outcomes were forward-tested by an independent agent on raw scenarios. It chose fix-and-review for known UI/lint corrections, waiting for running tests, human review for deployment changes, incomplete for unread callers, split for a split-only review, not-submitted for a draft, and human review for a wrapper restriction.
- The real helper generated approved, fix-and-review and split-only comments against the fake backend. Public and formal approval bodies retained the same assessed reasons. Generated outputs were inspected; the stable layout lives in [the comment template](../../../../skills/review/templates/github-progress.md).
- Tests cover invalid or contradictory decisions, table escaping, current revisions, PR state/authorship, unrelated pending reviews, lost responses, duplicate-free recovery, interruptions and oversized reports. Inline bugs cannot coexist with a passing clean-review answer or a split-only result.
- Size preflight includes publication notes and continuation links before freezing inputs. Boundary tests prove rejection happens without writes or frozen inputs, and a shortened summary can finish in the same run.

The helper validates and publishes the reviewer's judgement; it does not establish source correctness or CI relevance. Live permissions and GitHub browser rendering were not exercised. No local Galaxy builds, tests or dependency installs were performed.

## Comment examples

These are illustrative excerpts, not current findings on the PRs above. Repeated checklist tables are omitted here; published full reviews show all seven actual answers and reasons. The template contains one complete example.

### Approved

> **Approved.** This adds two empty settings pages using the existing admin check. It does not read billing data or change saved values. No required changes remain.

All seven checks pass, submission is allowed and GitHub has confirmed approval. Optional suggestions may follow.

### Fix and request another review

> **Fix these items and request another review.** The change otherwise fits the approval checklist.
>
> Remove the unused import reported by lint and keep the last menu item visible at the narrow viewport shown in F1. Once relevant checks pass, request another review. The updated commit will be reviewed again to decide whether it can be approved.

The completed review found specific, limited corrections. Clean review and verification fail. Inspect Meticulous differences before calling them regressions; intended differences follow normal visual review.

### Waiting for checks

> **Waiting for checks.** No code changes are requested. The relevant component test group is still running. Request another review when results are available.

Only verification is Not verified. A failure must be investigated before requesting a code change.

### Human review needed

> **Human review needed.** This changes shared document-update recovery. A mistake could lose saved work, so green tests are not enough for automatic approval.
>
> Ask a maintainer familiar with multiplayer persistence to review update ordering and reconnect recovery.

Limited consequences fails even if all other items pass. Fixing an additional lint error would not remove this requirement.

### Split first

> **Split this PR first.** A full review has not been performed.
>
> Separate the API client and tests, the UI migration, and removal of the old path into following PRs. Request a review of each smaller change.
>
> **Approval checklist:** Not assessed.

Use slices supported by the code and the main workflow's size rule. Do not invent correctness coverage or imply that a person can safely approve the unsplit change.

### Review incomplete

> **Review incomplete.** I still need to check the citation button's interaction with the shared hover card. This is remaining review work, not a requested code change.
>
> The reviewer needs to finish that investigation before deciding.

Review finished and clean review are Not verified. Keep working when possible instead of ending a normal review early to publish this outcome.

### Checklist passed, submission blocked

> **Human review needed.** The checklist passed, but this project's policy does not allow automatic approval. No code changes are requested. Request approval from a human reviewer.

All seven content answers stay Pass. A draft instead gets “Checklist passed — approval not submitted” and a request to mark it ready when appropriate. New commits require a new review, with the old passing table explicitly scoped to the reviewed commit. A failed submission remains unconfirmed until inspected and recovered; never promise approval after a CI fix.
