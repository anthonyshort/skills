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
        self.comments = []
        self.reviews = []
        self.writes = []
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
        endpoint = next(arg for arg in args if arg.startswith("repos/"))
        path = urlsplit(endpoint).path
        body = json.loads(kwargs.get("input") or "{}")
        operation = (method, path)
        if self.fail_before == operation:
            self.fail_before_occurrence -= 1
            if self.fail_before_occurrence == 0:
                self.fail_before = None
                return subprocess.CompletedProcess(command, 1, "", "simulated permission failure")

        if method == "GET" and path.endswith("/pulls/7"):
            result = {"head": {"sha": self.head}, "base": {"sha": "a" * 40}}
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
            identifier = len(self.reviews) + 1
            result = {"id": identifier, "html_url": f"https://github.com/o/r/pull/7#pullrequestreview-{identifier}", "state": "COMMENTED", **body}
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
