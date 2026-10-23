"""Exercise publication with an in-memory GitHub backend. No network writes."""

import contextlib
import copy
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from urllib.parse import urlsplit


SPEC = importlib.util.spec_from_file_location(
    "github_progress", Path(__file__).with_name("github_progress.py")
)
progress = importlib.util.module_from_spec(SPEC)


class GitHub:
    """Model server-side writes even when the client loses their responses."""

    def __init__(self):
        self.head = "b" * 40
        self.pull = {"base": {"sha": "a" * 40}, "state": "open", "draft": False,
                     "merged": False, "user": {"login": "author"}, "additions": 30, "deletions": 19}
        self.viewer = "reviewer"
        self.pull_reads = 0
        self.before_pull = None
        self.comments = []
        self.reviews = []
        self.writes = []
        self.approval_snapshots = []
        self.fail_after = None
        self.fail_before = None
        self.fail_before_occurrence = 1

    def run(self, command, **kwargs):
        assert command[:2] == ["gh", "api"], command
        args = command[2:]
        method = "GET"
        for flag in ("--method", "-X"):
            if flag in args:
                method = args[args.index(flag) + 1]
        endpoint = next(arg for arg in args if arg.startswith("repos/") or arg == "user")
        path = urlsplit(endpoint).path
        body = json.loads(kwargs.get("input") or "{}")
        operation = (method, path)
        if self.fail_before == operation:
            self.fail_before_occurrence -= 1
            if self.fail_before_occurrence == 0:
                self.fail_before = None
                return subprocess.CompletedProcess(command, 1, "", "simulated permission failure")

        if method == "GET" and path == "user":
            result = {"login": self.viewer}
        elif method == "GET" and path.endswith("/pulls/7"):
            self.pull_reads += 1
            if self.before_pull:
                self.before_pull(self)
            result = {**copy.deepcopy(self.pull), "head": {"sha": self.head}}
        elif method == "GET" and path.endswith("/issues/7/comments"):
            result = copy.deepcopy(self.comments)
        elif method == "GET" and "/issues/comments/" in path:
            identifier = int(path.rsplit("/", 1)[1])
            result = copy.deepcopy(next(comment for comment in self.comments if comment["id"] == identifier))
        elif method == "GET" and path.endswith("/pulls/7/reviews"):
            result = copy.deepcopy(self.reviews)
        elif method == "POST" and path.endswith("/issues/7/comments"):
            identifier = len(self.comments) + 1
            result = {"id": identifier, "html_url": f"https://github.com/o/r/pull/7#issuecomment-{identifier}", **body}
            self.comments.append(result)
        elif method == "PATCH" and "/issues/comments/" in path:
            identifier = int(path.rsplit("/", 1)[1])
            result = next(comment for comment in self.comments if comment["id"] == identifier)
            result.update(body)
        elif method == "POST" and path.endswith("/pulls/7/reviews"):
            if body["event"] == "APPROVE":
                self.approval_snapshots.append(self.comments[0]["body"])
            identifier = len(self.reviews) + 1
            result = {"id": identifier, "html_url": f"https://github.com/o/r/pull/7#pullrequestreview-{identifier}",
                      "state": "APPROVED" if body["event"] == "APPROVE" else "COMMENTED",
                      "user": {"login": self.viewer}, **body}
            self.reviews.append(result)
        else:
            raise AssertionError(f"Unexpected GitHub request: {method} {path}")

        if method != "GET":
            self.writes.append(operation)
        if self.fail_after == operation:
            self.fail_after = None
            return subprocess.CompletedProcess(command, 1, "", "response lost after server saved write")
        if "--slurp" in args:
            result = [result]
        return subprocess.CompletedProcess(command, 0, json.dumps(result), "")


class PublicationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        SPEC.loader.exec_module(progress)

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        self.state = self.directory / "run.json"
        self.backend = GitHub()
        self.transport = patch.object(progress.subprocess, "run", side_effect=self.backend.run)
        self.transport.start()
        self.addCleanup(self.transport.stop)
        self.checklist = self.file("checklist.md", "- [x] Set up\n- [ ] Review — in progress\n- [ ] Publish\n")
        self.summary = self.file("summary.md", "## Findings\n\n### P1\n\n- **F1. Preserve saved values:** current code clears them.\n")
        self.report_text = "# Review\n\nTwo checks, one concern.\n\n| Check | Result |\n| --- | --- |\n| Saved values | Concern F1 |\n| Read path | Source checked |\n\n<details>\n<summary>Evidence</summary>\n\nExact trace and uncertainty.\n\n</details>\n"
        self.report = self.file("report.md", self.report_text)
        self.inline = self.file("inline.json", json.dumps([{"id": "F1", "path": "src/save.ts", "line": 12, "side": "RIGHT", "body": "F1. Preserve the saved value."}]))

    def file(self, name, content):
        target = self.directory / name
        target.write_text(content)
        return target

    def invoke(self, *arguments):
        output = io.StringIO()
        with contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
            try:
                result = progress.main(["--state", str(self.state), *map(str, arguments)])
            except SystemExit as error:
                result = error.code
        return result, output.getvalue()

    def start(self, *extra):
        return self.invoke(*extra, "start", "--repo", "o/r", "--pr", "7", "--base", "a" * 40, "--head", "b" * 40, "--checklist", self.checklist)

    def finish(self, *extra):
        return self.invoke(*extra, "finish", "--summary", self.summary, "--report", self.report, "--inline", self.inline)

    def assert_success(self, result):
        self.assertIn(result[0], (None, 0), result[1])

    def checks(self, **results):
        return {key: {"result": results.get(key, "Pass"),
                      "reason": f"Reviewed evidence for {key} at this commit."}
                for key in progress.APPROVAL_GATES}

    def decision(self, **changes):
        value = {"outcome": "approve", "changed_lines": 49,
                 "checks": self.checks(),
                 "reason": "An isolated fix with traced callers and limited impact.",
                 "next_steps": []}
        value.update(changes)
        return self.file("approval.json", json.dumps(value))

    def approve(self, decision=None, *extra):
        return self.invoke(*extra, "finish", "--summary", self.summary, "--report", self.report,
                           "--approval", decision or self.decision())

    def test_approval_without_inline_findings_is_pinned_and_retry_safe(self):
        self.summary.write_text("Two empty settings pages use the existing admin check. No required changes remain.\n")
        self.report_text = "# Review\n\nNo bugs or required changes found. Existing permission rules are unchanged.\n"
        self.report.write_text(self.report_text)
        self.assert_success(self.start())
        self.assert_success(self.approve())
        self.assert_success(self.approve())
        self.assertEqual(len(self.backend.reviews), 1)
        review = self.backend.reviews[0]
        self.assertEqual(review["event"], "APPROVE")
        self.assertEqual(review["commit_id"], "b" * 40)
        self.assertIn(self.backend.comments[0]["html_url"], review["body"])
        self.assertIn("**Approved.**", self.backend.comments[0]["body"])
        self.assertEqual(json.loads(self.state.read_text())["approval"]["status"], "approved")

    def visible_and_report(self, body):
        marker = "<details>\n<summary>Full report</summary>"
        self.assertIn(marker, body)
        return body.split(marker, 1)

    def assert_no_visible_approval_assessment(self, visible):
        self.assertNotIn("#### Approval", visible)
        self.assertNotIn("| Check |", visible)
        self.assertNotIn("| Clear and focused |", visible)
        self.assertNotIn("Reviewed commit:", visible)

    def test_public_and_formal_approval_preserve_parent_checks_only_in_full_report(self):
        self.assert_success(self.start())
        checks = self.checks()
        checks["verification"]["reason"] = "Component test group passed at this commit."
        self.assert_success(self.approve(self.decision(checks=checks)))
        for body in (self.backend.comments[0]["body"], self.backend.reviews[0]["body"]):
            visible, report = self.visible_and_report(body)
            self.assert_no_visible_approval_assessment(visible)
            for check in checks.values():
                self.assertNotIn(check["reason"], visible)
                self.assertIn(check["reason"], report)
            self.assertEqual(report.count("| Pass |"), 7)
        self.assertIn(self.backend.comments[0]["html_url"], self.backend.reviews[0]["body"])

    def test_approval_is_not_claimed_before_github_confirms_submission(self):
        self.assert_success(self.start())
        self.assert_success(self.approve())
        pending, report = self.visible_and_report(self.backend.approval_snapshots[0])
        self.assert_no_visible_approval_assessment(pending)
        self.assertNotIn("Checklist passed", pending)
        self.assertNotIn("approval not submitted", pending)
        self.assertNotIn("**Approved.**", pending)
        self.assertIn("approval not submitted", report)
        self.assertEqual(report.count("| Pass |"), 7)
        visible, _ = self.visible_and_report(self.backend.comments[0]["body"])
        self.assertIn("**Approved.**", visible)

    def test_all_nonapproval_outcomes_hide_assessment_and_show_next_steps(self):
        cases = {
            "human_review": self.checks(low_risk="Fail"),
            "changes_needed": self.checks(clean_review="Fail"),
            "waiting_checks": self.checks(verification="Not verified"),
            "incomplete": self.checks(complete_review="Not verified", clean_review="Not verified"),
            "split": None,
            "not_submitted": self.checks(),
        }
        for outcome, checks in cases.items():
            with self.subTest(outcome=outcome):
                self.state = self.directory / f"outcome-{outcome}.json"
                self.backend.comments.clear()
                self.backend.reviews.clear()
                self.assert_success(self.start())
                decision = self.decision(outcome=outcome, checks=checks,
                                         reason=f"The recorded reason for {outcome}.",
                                         next_steps=[f"The assigned next step for {outcome}."])
                self.assert_success(self.approve(decision))
                public = self.backend.comments[0]["body"]
                visible, report = self.visible_and_report(public)
                self.assert_no_visible_approval_assessment(visible)
                self.assertNotIn(f"The recorded reason for {outcome}.", visible)
                self.assertIn(f"The recorded reason for {outcome}.", report)
                self.assertIn("#### Next steps", visible)
                self.assertIn(f"The assigned next step for {outcome}.", visible)
                self.assertNotIn("**Approved.**", visible)
                self.assertEqual(self.backend.reviews, [])
                if checks is None:
                    self.assertRegex(report.lower(), r"not assessed")
                    self.assertNotIn("| Clear and focused |", report)
                else:
                    for check in checks.values():
                        self.assertNotIn(check["reason"], visible)
                        self.assertIn(check["reason"], report)

    def test_result_orders_summary_next_steps_findings_then_full_report(self):
        lead = "No new confirmed bugs were found. One earlier issue still needs a fix."
        self.summary.write_text(lead + "\n\n#### Findings\n\n##### P2\n\n"
                                "- **F1 — Preserve saved colours:** Already reported.\n")
        self.assert_success(self.start())
        self.assert_success(self.approve(self.decision(
            outcome="changes_needed", checks=self.checks(clean_review="Fail"),
            reason="The earlier colour-loss bug remains at this commit.",
            next_steps=["The author needs to preserve saved colours in F1 and request another review."])))
        public = self.backend.comments[0]["body"]
        visible, report = self.visible_and_report(public)
        self.assert_no_visible_approval_assessment(visible)
        self.assertLess(public.index(lead), public.index("#### Next steps"))
        self.assertLess(public.index("#### Next steps"), public.index("#### Findings"))
        self.assertLess(public.index("#### Findings"), public.index("<summary>Full report</summary>"))
        self.assertIn("##### P2", visible)
        self.assertEqual(visible.count("Already reported."), 1)
        self.assertIn("The earlier colour-loss bug remains at this commit.", report)

    def test_result_without_findings_appends_next_steps_after_the_summary(self):
        lead = "No new confirmed bugs were found. No code changes are requested."
        self.summary.write_text(lead + "\n")
        self.assert_success(self.start())
        self.assert_success(self.approve(self.decision(
            outcome="waiting_checks", checks=self.checks(verification="Not verified"),
            reason="The relevant component tests are still running.",
            next_steps=["Request another review when the component tests finish."])))
        public = self.backend.comments[0]["body"]
        visible, report = self.visible_and_report(public)
        self.assert_no_visible_approval_assessment(visible)
        self.assertLess(visible.index(lead), visible.index("#### Next steps"))
        self.assertNotIn("#### Findings", visible)
        self.assertNotIn("The relevant component tests are still running.", visible)
        self.assertIn("The relevant component tests are still running.", report)

    def test_table_reasons_escape_pipes_without_losing_parent_evidence(self):
        self.assert_success(self.start())
        checks = self.checks()
        checks["focused"]["reason"] = "Paths A | B serve the same task."
        self.assert_success(self.approve(self.decision(checks=checks)))
        for body in (self.backend.comments[0]["body"], self.backend.reviews[0]["body"]):
            self.assertIn("Paths A \\| B serve the same task.", body)

    def test_missing_or_malformed_check_results_are_rejected_before_writes(self):
        self.assert_success(self.start())
        missing = self.checks()
        missing.pop("focused")
        blank = self.checks()
        blank["focused"]["reason"] = " "
        multiline = self.checks()
        multiline["focused"]["reason"] = "One reason.\nInjected row."
        malformed = self.checks()
        malformed["focused"] = {"result": "Pass"}
        for checks in (missing, blank, multiline, malformed, self.checks(focused="Skipped"),
                       self.checks(focused=[]), self.checks(focused={}), self.checks(focused=True), None):
            with self.subTest(checks=checks):
                before = list(self.backend.writes)
                self.assertNotEqual(self.approve(self.decision(checks=checks))[0], 0)
                self.assertEqual(self.backend.writes, before)

    def test_inconsistent_outcomes_are_rejected_before_writes(self):
        self.assert_success(self.start())
        cases = (
            {"outcome": "not_submitted", "checks": self.checks(clean_review="Fail")},
            {"outcome": "waiting_checks", "checks": self.checks()},
            {"outcome": "waiting_checks", "checks": self.checks(verification="Fail")},
            {"outcome": "waiting_checks", "checks": self.checks(verification="Not verified", clean_review="Fail")},
            {"outcome": "changes_needed", "checks": self.checks()},
            {"outcome": "changes_needed", "checks": self.checks(clean_review="Fail", complete_review="Not verified")},
            {"outcome": "changes_needed", "checks": self.checks(clean_review="Fail", low_risk="Fail")},
            {"outcome": "changes_needed", "checks": self.checks(clean_review="Fail", no_sensitive_changes="Fail")},
            {"outcome": "incomplete", "checks": self.checks()},
            {"outcome": "incomplete", "checks": self.checks(complete_review="Not verified", low_risk="Fail")},
            {"outcome": "split", "checks": self.checks()},
            {"outcome": "human_review", "checks": self.checks(low_risk="Fail"), "next_steps": []},
        )
        for changes in cases:
            with self.subTest(changes=changes):
                before = list(self.backend.writes)
                values = {"next_steps": ["Request the appropriate review."], **changes}
                decision = self.decision(**values)
                self.assertNotEqual(self.approve(decision)[0], 0)
                self.assertEqual(self.backend.writes, before)

    def test_failed_approval_hides_assessment_and_shows_reviewers_recovery_action(self):
        self.assert_success(self.start())
        self.backend.fail_before = ("POST", "repos/o/r/pulls/7/reviews")
        self.assertNotEqual(self.approve()[0], 0)
        visible, report = self.visible_and_report(self.backend.comments[0]["body"])
        self.assert_no_visible_approval_assessment(visible)
        for check in self.checks().values():
            self.assertNotIn(check["reason"], visible)
            self.assertIn(check["reason"], report)
        self.assertNotIn("approval not submitted", visible)
        self.assertIn("approval not submitted", report)
        self.assertIn("#### Next steps", visible)
        self.assertRegex(visible.lower(), r"reviewer.*(?:inspect|retry|confirm)")
        self.assertNotIn("**Approved.**", visible)

    def test_changed_head_keeps_answers_hidden_and_pinned_without_approving_new_code(self):
        self.assert_success(self.start())
        self.backend.head = "c" * 40
        self.assert_success(self.approve())
        visible, report = self.visible_and_report(self.backend.comments[0]["body"])
        self.assert_no_visible_approval_assessment(visible)
        self.assertEqual(report.count("| Pass |"), 7)
        self.assertIn("b" * 40, visible)
        self.assertIn("not reviewed", visible)
        self.assertNotIn("approval not submitted", visible)
        self.assertIn("approval not submitted", report)
        self.assertNotIn("**Approved.**", visible)
        self.assertEqual(self.backend.reviews, [])

    def test_large_report_continuations_keep_assessment_and_links_inside_full_report(self):
        report = ("## Evidence\n\n" + "Trace and uncertainty. " * 30 + "\n\n") * 12
        self.report.write_text(report)
        self.assert_success(self.start())
        with patch.object(progress, "MAX_BODY", 5000):
            self.assert_success(self.approve())
        public = self.backend.comments[0]["body"]
        self.assertGreater(len(self.backend.comments), 1)
        visible, hidden = self.visible_and_report(public)
        self.assert_no_visible_approval_assessment(visible)
        self.assertIn("**Approved.**", visible)
        self.assertEqual(hidden.count("| Pass |"), 7)
        for check in self.checks().values():
            self.assertNotIn(check["reason"], visible)
            self.assertEqual(hidden.count(check["reason"]), 1)
        for continuation in self.backend.comments[1:]:
            self.assertNotIn(continuation["html_url"], visible)
            self.assertIn(continuation["html_url"], hidden)
        self.assertEqual(len(self.backend.reviews), 1)

    def test_line_count_does_not_decide_approval_when_checklist_passes(self):
        for changed_lines in (49, 50, 378):
            with self.subTest(changed_lines=changed_lines):
                self.state = self.directory / f"size-{changed_lines}.json"
                self.backend.comments.clear()
                self.backend.reviews.clear()
                self.backend.pull.update(additions=changed_lines - 4, deletions=4)
                self.assert_success(self.start())
                self.assert_success(self.approve(self.decision(changed_lines=changed_lines)))
                self.assertEqual(len(self.backend.reviews), 1)
                self.assertEqual(self.backend.reviews[0]["state"], "APPROVED")

    def test_lost_approval_response_recovers_even_when_head_later_changes(self):
        self.assert_success(self.start())
        self.backend.fail_after = ("POST", "repos/o/r/pulls/7/reviews")
        self.assertNotEqual(self.approve()[0], 0)
        visible, hidden = self.visible_and_report(self.backend.comments[0]["body"])
        self.assert_no_visible_approval_assessment(visible)
        self.assertNotIn("**Approved.**", visible)
        self.assertIn("#### Next steps", visible)
        self.assertEqual(hidden.count("| Pass |"), 7)
        self.backend.head = "c" * 40
        self.assert_success(self.approve())
        self.assertEqual(len(self.backend.reviews), 1)
        self.assertIn("Newer commits are not reviewed", self.backend.comments[0]["body"])
        visible, hidden = self.visible_and_report(self.backend.comments[0]["body"])
        self.assert_no_visible_approval_assessment(visible)
        self.assertIn("**Approved.**", visible)
        self.assertEqual(hidden.count("| Pass |"), 7)

    def test_approval_failure_keeps_report_and_can_retry(self):
        self.assert_success(self.start())
        self.backend.fail_before = ("POST", "repos/o/r/pulls/7/reviews")
        self.assertNotEqual(self.approve()[0], 0)
        self.assertEqual(self.backend.reviews, [])
        self.assertIn(self.report_text, self.backend.comments[0]["body"])
        self.assertNotEqual(json.loads(self.state.read_text())["status"], "complete")
        self.assert_success(self.approve())

    def test_failed_final_comment_recovers_approval_without_duplicate(self):
        self.assert_success(self.start())
        self.backend.fail_before = ("PATCH", "repos/o/r/issues/comments/1")
        self.backend.fail_before_occurrence = 3
        self.assertNotEqual(self.approve()[0], 0)
        self.assertEqual(len(self.backend.reviews), 1)
        self.assert_success(self.approve())
        self.assertEqual(len(self.backend.reviews), 1)

    def test_live_safeguards_withhold_approval_but_publish_report(self):
        cases = {
            "head": lambda backend: setattr(backend, "head", "c" * 40),
            "base": lambda backend: backend.pull.update(base={"sha": "c" * 40}),
            "draft": lambda backend: backend.pull.update(draft=True),
            "closed": lambda backend: backend.pull.update(state="closed"),
            "merged": lambda backend: backend.pull.update(merged=True),
            "self-authored": lambda backend: backend.pull.update(user={"login": "REVIEWER"}),
            "count mismatch": lambda backend: backend.pull.update(additions=29),
        }
        for name, mutate in cases.items():
            with self.subTest(case=name):
                self.state = self.directory / f"{name}.json"
                self.backend.comments.clear()
                self.backend.reviews.clear()
                self.backend.head = "b" * 40
                self.backend.pull.update(base={"sha": "a" * 40}, state="open", draft=False,
                                         merged=False, user={"login": "author"}, additions=30)
                self.assert_success(self.start())
                mutate(self.backend)
                self.assert_success(self.approve())
                self.assertEqual(self.backend.reviews, [])
                self.assertIn(self.report_text, self.backend.comments[0]["body"])
                if name == "self-authored":
                    self.assertIn("Human review needed", self.backend.comments[0]["body"])
                else:
                    self.assertIn("approval not submitted", self.backend.comments[0]["body"])
                self.assertNotIn("**Approved.**", self.backend.comments[0]["body"])

    def test_revision_rechecked_after_final_report_publication(self):
        self.assert_success(self.start())
        def advance(backend):
            if backend.pull_reads == 3:
                backend.head = "c" * 40
        self.backend.before_pull = advance
        self.assert_success(self.approve())
        self.assertEqual(self.backend.reviews, [])
        self.assertIn("PR revisions changed", self.backend.comments[0]["body"])

    def test_pending_review_is_left_intact_and_withholding_is_sticky(self):
        self.assert_success(self.start())
        pending = {"id": 99, "state": "PENDING", "body": "Unrelated draft"}
        self.backend.reviews.append(copy.deepcopy(pending))
        self.assert_success(self.approve())
        self.assertEqual(self.backend.reviews, [pending])
        self.backend.reviews.clear()
        self.assert_success(self.approve())
        self.assertEqual(self.backend.reviews, [])

    def test_outstanding_change_request_blocks_but_superseded_one_does_not(self):
        for resolved in (False, True):
            with self.subTest(resolved=resolved):
                self.state = self.directory / f"resolved-{resolved}.json"
                self.backend.comments.clear()
                self.backend.reviews[:] = [{"state": "CHANGES_REQUESTED", "body": "Fix this", "user": {"login": "human"}}]
                if resolved:
                    self.backend.reviews.append({"state": "APPROVED", "body": "Fixed", "user": {"login": "human"}})
                self.assert_success(self.start())
                self.assert_success(self.approve())
                self.assertEqual(sum(review.get("event") == "APPROVE" for review in self.backend.reviews), int(resolved))

    def test_ineligible_assessment_publishes_comments_only(self):
        self.assert_success(self.start())
        decision = self.decision(outcome="waiting_checks", checks=self.checks(verification="Not verified"),
                                 reason="Relevant tests are pending.",
                                 next_steps=["Request another review after the component tests finish."])
        self.assert_success(self.approve(decision))
        self.assertEqual(self.backend.reviews, [])
        self.assertIn("Relevant tests are pending", self.backend.comments[0]["body"])

    def test_ineligible_assessment_can_still_publish_inline_bugs(self):
        self.assert_success(self.start())
        self.assert_success(self.invoke("finish", "--summary", self.summary, "--report", self.report,
                                        "--inline", self.inline, "--approval",
                                        self.decision(outcome="changes_needed", checks=self.checks(clean_review="Fail"),
                                                      next_steps=["Preserve the saved value in F1 and request another review."])))
        self.assertEqual([review["event"] for review in self.backend.reviews], ["COMMENT"])

    def test_inline_bugs_cannot_contradict_passing_or_unassessed_required_fixes(self):
        self.assert_success(self.start())
        cases = {
            "approve": self.checks(),
            "not_submitted": self.checks(),
            "waiting_checks": self.checks(verification="Not verified"),
            "human_review": self.checks(low_risk="Fail"),
            "incomplete": self.checks(complete_review="Not verified"),
            "changes_needed": self.checks(verification="Fail"),
            "split": None,
        }
        for outcome, checks in cases.items():
            with self.subTest(outcome=outcome):
                decision = self.decision(outcome=outcome, checks=checks,
                                         next_steps=[] if outcome == "approve" else ["Request the appropriate review."])
                writes_before = list(self.backend.writes)
                state_before = self.state.read_bytes()
                public_before = self.backend.comments[0]["body"]
                result = self.invoke("finish", "--summary", self.summary, "--report", self.report,
                                     "--inline", self.inline, "--approval", decision)
                self.assertNotEqual(result[0], 0)
                self.assertEqual(self.backend.writes, writes_before)
                self.assertEqual(self.state.read_bytes(), state_before)
                self.assertEqual(self.backend.comments[0]["body"], public_before)
                self.assertEqual(self.backend.reviews, [])

    def test_invalid_eligibility_rejected_before_writes(self):
        self.assert_success(self.start())
        for changes in ({"changed_lines": -1}, {"changed_lines": True}, {"outcome": "approved"},
                        {"reason": ""}, {"next_steps": "Request review"}, {"checks": {}},
                        {"checks": self.checks(verification="Fail")}):
            with self.subTest(changes=changes):
                before = list(self.backend.writes)
                self.assertNotEqual(self.approve(self.decision(**changes))[0], 0)
                self.assertEqual(before, self.backend.writes)
        before = list(self.backend.writes)
        result = self.invoke("finish", "--summary", self.summary, "--report", self.report,
                             "--inline", self.inline, "--approval", self.decision())
        self.assertNotEqual(result[0], 0)
        self.assertEqual(before, self.backend.writes)

    def test_every_failed_gate_prevents_approval(self):
        self.assert_success(self.start())
        for gate in progress.APPROVAL_GATES:
            with self.subTest(gate=gate):
                decision = self.decision(changed_lines=378,
                                         checks=self.checks(**{gate: "Fail"}))
                before = list(self.backend.writes)
                self.assertNotEqual(self.approve(decision)[0], 0)
                self.assertEqual(self.backend.writes, before)

    def test_approval_decision_is_frozen_after_publication_starts(self):
        self.assert_success(self.start())
        self.backend.fail_before = ("POST", "repos/o/r/pulls/7/reviews")
        self.assertNotEqual(self.approve()[0], 0)
        before = list(self.backend.writes)
        self.assertNotEqual(self.approve(self.decision(reason="Changed judgement"))[0], 0)
        self.assertEqual(before, self.backend.writes)

    def test_approval_dry_run_shows_intent_without_reads_or_writes(self):
        self.assert_success(self.start())
        before = self.state.read_bytes()
        writes = list(self.backend.writes)
        # Any network call during a dry run is an error.
        with patch.object(progress.Github, "api", side_effect=AssertionError("Network read")):
            result = self.approve(self.decision(), "--dry-run")
        self.assert_success(result)
        self.assertEqual(json.loads(result[1])["review_event"], "APPROVE")
        self.assertEqual(self.state.read_bytes(), before)
        self.assertEqual(self.backend.writes, writes)

    def test_dismissed_approval_is_not_resubmitted(self):
        self.assert_success(self.start())
        self.assert_success(self.approve())
        self.backend.reviews[0]["state"] = "DISMISSED"
        self.assert_success(self.approve())
        self.assertEqual(len(self.backend.reviews), 1)
        self.assertEqual(json.loads(self.state.read_text())["approval"]["status"], "withheld")

    def test_removed_or_altered_approval_is_not_replaced(self):
        for alteration in ("removed", "wrong commit", "wrong author", "pending"):
            with self.subTest(alteration=alteration):
                self.state = self.directory / f"{alteration}.json"
                self.backend.comments.clear()
                self.backend.reviews.clear()
                self.assert_success(self.start())
                self.assert_success(self.approve())
                if alteration == "removed":
                    self.backend.reviews.clear()
                elif alteration == "wrong commit":
                    self.backend.reviews[0]["commit_id"] = "c" * 40
                elif alteration == "wrong author":
                    self.backend.reviews[0]["user"] = {"login": "another"}
                else:
                    self.backend.reviews[0]["state"] = "PENDING"
                count = len(self.backend.reviews)
                self.assert_success(self.approve())
                self.assertEqual(len(self.backend.reviews), count)
                self.assertEqual(json.loads(self.state.read_text())["approval"]["status"], "withheld")

    def test_duplicate_run_markers_stop_publication(self):
        self.assert_success(self.start())
        self.assert_success(self.approve())
        self.backend.reviews.append(copy.deepcopy(self.backend.reviews[0]))
        self.assertNotEqual(self.approve()[0], 0)
        self.assertEqual(len(self.backend.reviews), 2)

    def test_resume_updates_same_comment_and_new_run_gets_its_own(self):
        self.assert_success(self.start())
        self.assert_success(self.start())
        self.assert_success(self.invoke("update", "--checklist", self.checklist))
        self.assertEqual(len(self.backend.comments), 1)
        self.state = self.directory / "another-run.json"
        self.assert_success(self.start())
        self.assertEqual(len(self.backend.comments), 2)

    def test_lost_initial_post_response_recovers_without_duplicate(self):
        self.backend.fail_after = ("POST", "repos/o/r/issues/7/comments")
        result = self.start()
        self.assertNotIn(result[0], (None, 0))
        self.assertTrue(self.state.exists())
        self.assert_success(self.start())
        self.assertEqual(len(self.backend.comments), 1)

    def test_finish_embeds_exact_report_and_submits_neutral_inline_review_once(self):
        self.assert_success(self.start())
        self.assert_success(self.finish())
        self.assert_success(self.finish())
        self.assertEqual(len(self.backend.comments), 1)
        self.assertIn(self.report_text, self.backend.comments[0]["body"])
        self.assertEqual(len(self.backend.reviews), 1)
        self.assertEqual(self.backend.reviews[0]["event"], "COMMENT")
        self.assertEqual(self.backend.reviews[0]["commit_id"], "b" * 40)
        self.assertEqual(len(self.backend.reviews[0]["comments"]), 1)

    def test_lost_review_response_recovers_without_duplicate(self):
        self.assert_success(self.start())
        self.backend.fail_after = ("POST", "repos/o/r/pulls/7/reviews")
        result = self.finish()
        self.assertNotIn(result[0], (None, 0))
        self.assert_success(self.finish())
        self.assertEqual(len(self.backend.reviews), 1)
        self.assertIn(self.report_text, self.backend.comments[0]["body"])

    def test_changed_head_preserves_revision_and_skips_inline(self):
        self.assert_success(self.start())
        self.backend.head = "c" * 40
        self.finish()
        self.assertEqual(self.backend.reviews, [])
        body = self.backend.comments[0]["body"]
        self.assertIn("b" * 40, body)
        self.assertRegex(body.lower(), r"not reviewed|unreviewed")

    def test_clean_review_does_not_create_empty_formal_review(self):
        self.assert_success(self.start())
        self.assert_success(self.invoke("finish", "--summary", self.summary, "--report", self.report))
        self.assertEqual(self.backend.reviews, [])
        self.assertIn(self.report_text, self.backend.comments[0]["body"])

    def test_dry_run_does_not_write_state_or_github(self):
        self.assert_success(self.start("--dry-run"))
        self.assertFalse(self.state.exists())
        self.assertEqual(self.backend.writes, [])
        self.assert_success(self.start())
        before = self.state.read_bytes()
        writes = list(self.backend.writes)
        self.assert_success(self.finish("--dry-run"))
        self.assertEqual(self.state.read_bytes(), before)
        self.assertEqual(self.backend.writes, writes)

    def test_reused_run_cannot_be_retargeted(self):
        self.assert_success(self.start())
        before = self.state.read_bytes()
        result = self.invoke("start", "--repo", "o/r", "--pr", "7", "--base", "a" * 40, "--head", "c" * 40, "--checklist", self.checklist)
        self.assertNotIn(result[0], (None, 0))
        self.assertEqual(self.state.read_bytes(), before)
        self.assertEqual(len(self.backend.comments), 1)

    def test_failed_final_update_does_not_duplicate_published_review(self):
        self.assert_success(self.start())
        self.backend.fail_before = ("PATCH", "repos/o/r/issues/comments/1")
        self.backend.fail_before_occurrence = 2
        result = self.finish()
        self.assertNotIn(result[0], (None, 0))
        self.assertEqual(len(self.backend.reviews), 1)
        self.assertNotEqual(json.loads(self.state.read_text())["status"], "complete")
        self.assert_success(self.finish())
        self.assertEqual(len(self.backend.reviews), 1)
        self.assertIn(self.report_text, self.backend.comments[0]["body"])

    def test_interrupt_retains_unfinished_checklist(self):
        self.assert_success(self.start())
        self.assert_success(self.invoke("interrupt", "--reason", "Context source unavailable"))
        body = self.backend.comments[0]["body"]
        self.assertIn("Context source unavailable", body)
        self.assertIn("- [ ] Review", body)

    def test_continuations_keep_complete_markdown_blocks_and_link_from_main(self):
        table = "| Check | Result |\n| --- | --- |\n" + "| Evidence | Source checked |\n" * 15 + "\n"
        fold = "<details>\n<summary>Evidence</summary>\n\n" + "Trace and uncertainty.\n" * 15 + "\n</details>\n\n"
        code = "```python\n" + "print('evidence')\n" * 20 + "```\n\n"
        report = "# Review\n\n" + (table + fold + code) * 3
        parts = progress.report_parts(report, 1400)
        self.assertEqual("".join(parts), report)
        for block in (table, fold, code):
            self.assertTrue(any(block in part for part in parts))
        self.report.write_text(report)
        self.assert_success(self.start())
        with patch.object(progress, "MAX_BODY", 2400):
            self.assert_success(self.invoke("finish", "--summary", self.summary, "--report", self.report))
        self.assertEqual(len(self.backend.comments), len(parts) + 1)
        main = self.backend.comments[0]["body"]
        for comment, part in zip(self.backend.comments[1:], parts):
            self.assertIn(comment["html_url"], main)
            self.assertIn(part.rstrip(), comment["body"])
            self.assertLessEqual(len(comment["body"]), 2400)
        writes = len(self.backend.comments)
        with patch.object(progress, "MAX_BODY", 2400):
            self.assert_success(self.invoke("finish", "--summary", self.summary, "--report", self.report))
        self.assertEqual(len(self.backend.comments), writes)

    def test_oversized_indivisible_report_fails_without_truncation(self):
        self.assert_success(self.start())
        original_body = self.backend.comments[0]["body"]
        self.report.write_text("<details>\n<summary>Evidence</summary>\n\n" + "x" * 3000 + "\n\n</details>\n")
        with patch.object(progress, "MAX_BODY", 2400):
            result = self.invoke("finish", "--summary", self.summary, "--report", self.report)
        self.assertNotIn(result[0], (None, 0))
        self.assertIn("block", result[1].lower())
        self.assertEqual(len(self.backend.comments), 1)
        self.assertEqual(self.backend.comments[0]["body"], original_body)
        self.assertNotEqual(json.loads(self.state.read_text())["status"], "complete")

    def test_near_limit_summary_fails_before_publication_or_inputs_are_frozen(self):
        self.assert_success(self.start())
        state = json.loads(self.state.read_text())
        limit = 2400
        overhead = len(progress.render(state, "Reviewed", summary="x")) - 1
        overhead += len(progress.marker(state, "main")) + 2
        self.summary.write_text("x" * (limit - overhead - 10))
        self.report.write_text("")
        plain = progress.render(state, "Reviewed", summary=self.summary.read_text())
        self.assertLess(len(plain) + len(progress.marker(state, "main")) + 2, limit)
        state_before = self.state.read_bytes()
        writes_before = list(self.backend.writes)
        public_before = self.backend.comments[0]["body"]
        with patch.object(progress, "MAX_BODY", limit):
            result = self.invoke("finish", "--summary", self.summary, "--report", self.report)
        self.assertNotEqual(result[0], 0)
        self.assertIn("too large", result[1].lower())
        self.assertEqual(self.state.read_bytes(), state_before)
        self.assertEqual(self.backend.writes, writes_before)
        self.assertEqual(self.backend.comments[0]["body"], public_before)
        self.assertNotIn("publication_digest", json.loads(self.state.read_text()))
        self.summary.write_text("A shortened summary with room for publication notes.\n")
        self.assert_success(self.invoke("finish", "--summary", self.summary, "--report", self.report))

    def test_continuation_links_are_budgeted_before_publication_begins(self):
        self.assert_success(self.start())
        state = json.loads(self.state.read_text())
        limit = 2400
        overhead = len(progress.render(state, "Reviewed", summary="x")) - 1
        overhead += len(progress.marker(state, "main")) + 2
        self.summary.write_text("x" * (limit - overhead - 500 - 10))
        self.report.write_text(("## Evidence\n\n" + "A checked code path. " * 45 + "\n\n") * 12)
        self.assertGreater(len(progress.report_parts(self.report.read_text(), limit - 1000)), 5)
        plain = progress.render(state, "Reviewed", summary=self.summary.read_text())
        self.assertLess(len(plain) + len(progress.marker(state, "main")) + 2 + 500, limit)
        state_before = self.state.read_bytes()
        writes_before = list(self.backend.writes)
        with patch.object(progress, "MAX_BODY", limit):
            result = self.invoke("finish", "--summary", self.summary, "--report", self.report)
        self.assertNotEqual(result[0], 0)
        self.assertIn("too large", result[1].lower())
        self.assertEqual(self.state.read_bytes(), state_before)
        self.assertEqual(self.backend.writes, writes_before)
        self.assertEqual(len(self.backend.comments), 1)

    def test_foreign_pending_review_is_not_submitted_or_overwritten(self):
        self.assert_success(self.start())
        pending = {"id": 99, "state": "PENDING", "body": "A human's draft", "html_url": "https://github.com/o/r/pull/7#pullrequestreview-99"}
        self.backend.reviews.append(copy.deepcopy(pending))
        result = self.finish()
        self.assertNotIn(result[0], (None, 0))
        self.assertEqual(self.backend.reviews, [pending])
        self.assertNotEqual(json.loads(self.state.read_text())["status"], "complete")
        self.assertIn("publication incomplete", self.backend.comments[0]["body"].lower())

    def test_lost_continuation_response_recovers_without_duplicate(self):
        report = ("## Evidence\n\n" + "Trace and uncertainty. " * 30 + "\n\n") * 7
        self.report.write_text(report)
        self.assert_success(self.start())
        self.backend.fail_after = ("POST", "repos/o/r/issues/7/comments")
        with patch.object(progress, "MAX_BODY", 2400):
            result = self.invoke("finish", "--summary", self.summary, "--report", self.report)
            self.assertNotIn(result[0], (None, 0))
            writes = list(self.backend.writes)
            self.report.write_text(report + "A changed conclusion.\n")
            changed = self.invoke("finish", "--summary", self.summary, "--report", self.report)
            self.assertNotIn(changed[0], (None, 0))
            self.assertEqual(self.backend.writes, writes)
            self.report.write_text(report)
            self.assert_success(self.invoke("finish", "--summary", self.summary, "--report", self.report))
        self.assertEqual(len(self.backend.comments), len(progress.report_parts(report, 1400)) + 1)

    def test_failed_publication_keeps_publication_checkbox_unchecked(self):
        self.assert_success(self.start())
        self.checklist.write_text("- [x] Review\n- [x] Publish results\n")
        self.backend.fail_before = ("POST", "repos/o/r/pulls/7/reviews")
        result = self.invoke("finish", "--summary", self.summary, "--report", self.report, "--inline", self.inline, "--checklist", self.checklist)
        self.assertNotIn(result[0], (None, 0))
        self.assertIn("- [ ] Publish results", self.backend.comments[0]["body"])
        self.assertNotEqual(json.loads(self.state.read_text())["status"], "complete")

    def test_report_splitter_ignores_literal_fold_tags_and_keeps_nested_folds(self):
        nested = "<details>\n<summary>Outer evidence</summary>\n\n<details>\n<summary>Nested evidence</summary>\n\nExact trace.\n\n</details>\n\n</details>\n\n"
        literals = [
            "The renderer emits `<details>` for a fold.\n\n",
            "The renderer emits `</details>` to close a fold.\n\n",
            "The literal `` `<details>` `` includes backticks.\n\n",
            "<!-- Example literal: <details> -->\n\n",
            "<!-- Example literal:\n</details>\n-->\n\n",
            "    <details>\n\n",
            "    </details>\n\n",
        ]
        for literal in literals:
            with self.subTest(literal=literal):
                report = "Introductory evidence. " * 8 + "\n\n" + literal + nested + "Final evidence. " * 10 + "\n"
                parts = progress.report_parts(report, 320)
                self.assertEqual("".join(parts), report)
                self.assertGreater(len(parts), 1)
                self.assertTrue(any(nested in part for part in parts))

    def test_interrupt_after_failed_finish_does_not_claim_publication_complete(self):
        self.assert_success(self.start())
        self.checklist.write_text("- [x] Review\n- [x] Publish results\n")
        self.backend.fail_before = ("POST", "repos/o/r/pulls/7/reviews")
        result = self.invoke("finish", "--summary", self.summary, "--report", self.report, "--inline", self.inline, "--checklist", self.checklist)
        self.assertNotIn(result[0], (None, 0))
        self.assert_success(self.invoke("interrupt", "--reason", "GitHub publication failed"))
        body = self.backend.comments[0]["body"]
        self.assertIn("- [x] Review", body)
        self.assertIn("- [ ] Publish results", body)
        self.assertNotIn("- [x] Publish results", body)
        self.assertNotEqual(json.loads(self.state.read_text())["status"], "complete")


if __name__ == "__main__":
    unittest.main()
