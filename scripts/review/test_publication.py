"""Exercise the review publisher against the existing in-memory GitHub backend."""

import contextlib
import copy
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch


ROOT = Path(os.environ.get("REVIEW_PACKAGE_ROOT", Path(__file__).resolve().parents[2]))
sys.path.insert(0, str(ROOT / "scripts/review"))
sys.path.insert(0, str(ROOT / "skills/review/scripts"))
sys.dont_write_bytecode = True


def load(name, file):
    specification = importlib.util.spec_from_file_location(name, file)
    module = importlib.util.module_from_spec(specification)
    specification.loader.exec_module(module)
    return module


publication = load("tested_review_publication", ROOT / "scripts/review/publication.py")
helper_tests = load("existing_review_publication_fakes", ROOT / "skills/review/scripts/test_github_progress.py")


class PublicationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.bundle_path = self.root / "bundle.json"
        self.result_path = self.root / "result.json"
        self.backend = helper_tests.GitHub()
        self.api_calls = []
        self.transport = patch.object(publication.subprocess, "run", side_effect=self.fake_transport)
        self.transport.start()
        self.addCleanup(self.transport.stop)
        self.approval = {
            "outcome": "human_review", "changed_lines": 49,
            "checks": {key: {"result": "Fail" if key == "low_risk" else "Pass", "reason": f"Fixture evidence for {key}."} for key in (
                "focused", "low_risk", "no_sensitive_changes", "clean_review", "complete_review", "verification", "concerns_resolved",
            )},
            "reason": "A reviewer needs to assess the saved-work consequence.",
            "next_steps": ["A human reviewer should inspect the data consequence."],
        }
        self.inputs = {
            "skillRoot": str(ROOT / "skills/review"), "artifacts": str(self.root),
            "base": "a" * 40, "head": "b" * 40, "runId": "fixture-run", "invocationId": "fixture-invocation",
            "publication": {"mode": "github", "repository": "o/r", "prNumber": 7},
        }
        self.bundle = {
            "status": "complete", "input": self.inputs,
            "stages": {
                "setup": {"addedLines": 30, "deletedLines": 19},
                "report": {"markdown": "# Review\n\nTraced the saved-work caller. Human judgement is required.\n"},
                "decision": {"approval": self.approval, "summaryMarkdown": "- **Overall:** A human needs to assess the data consequence.\n", "inlineComments": []},
            },
        }
        self.write_artifacts()
        self.acceptance = patch.object(publication, "accepted", side_effect=self.accepted)
        self.acceptance.start()
        self.addCleanup(self.acceptance.stop)

    def fake_transport(self, command, **kwargs):
        self.api_calls.append(list(command))
        return self.backend.run(command, **kwargs)

    def accepted(self, path):
        self.assertEqual(path, self.bundle_path)
        return copy.deepcopy(self.bundle), json.loads(self.result_path.read_text())

    def write_artifacts(self):
        self.bundle_path.write_text(json.dumps(self.bundle))
        decision = self.bundle["stages"]["decision"]
        for name, value in {
            "approval.json": json.dumps(decision["approval"]),
            "summary.md": decision["summaryMarkdown"],
            "inline.json": json.dumps(decision["inlineComments"]),
            "review-report.md": self.bundle["stages"]["report"]["markdown"],
        }.items():
            (self.root / name).write_text(value)
        mode = self.inputs["publication"]["mode"]
        self.result_path.write_text(json.dumps({
            "status": self.bundle["status"], "runId": self.inputs["runId"], "invocationId": self.inputs["invocationId"],
            "base": self.inputs["base"], "head": self.inputs["head"],
            "publication": {"mode": mode, "status": "not_requested" if mode == "local" else "pending"},
        }))

    def invoke_main(self, *arguments):
        output = io.StringIO()
        with patch.object(sys, "argv", ["publication.py", *map(str, arguments)]), contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
            try:
                publication.main()
                code = 0
            except SystemExit as error:
                code = error.code
        return code, output.getvalue()

    def result(self):
        return json.loads(self.result_path.read_text())

    def progress_state(self):
        return json.loads((self.root / "progress.json").read_text())

    def test_local_finish_and_verify_make_no_external_calls(self):
        self.inputs["publication"]["mode"] = "local"
        self.write_artifacts()
        self.assertEqual(publication.finish(self.bundle_path)["status"], "not_requested")
        self.assertEqual(publication.verify(self.bundle_path)["status"], "not_requested")
        self.assertEqual(self.api_calls, [])
        self.assertFalse((self.root / "progress.json").exists())

    def test_local_and_dry_run_progress_refuse_external_delivery(self):
        for mode in ("local", "dry-run"):
            with self.subTest(mode=mode):
                self.inputs["publication"]["mode"] = mode
                with self.assertRaisesRegex(ValueError, "explicit GitHub"):
                    publication.progress(self.inputs, {"research": "running"})
        self.assertEqual(self.api_calls, [])

    def test_dry_run_renders_with_real_helper_and_never_calls_github(self):
        self.inputs["publication"]["mode"] = "dry-run"
        self.write_artifacts()
        receipt = publication.finish(self.bundle_path)
        self.assertEqual(receipt["status"], "rendered")
        preview = json.loads((self.root / "publication-preview.json").read_text())
        self.assertTrue(preview["dry_run"])
        self.assertIn("Human judgement is required", preview["body"])
        self.assertEqual(preview["approval_decision"], self.approval)
        self.assertEqual(self.result()["publication"], {"mode": "dry-run", "status": "rendered"})
        self.assertEqual(publication.verify(self.bundle_path)["status"], "rendered")
        self.assertEqual(self.api_calls, [])

    def test_dry_run_verification_rejects_changed_preview_digest(self):
        self.inputs["publication"]["mode"] = "dry-run"
        self.write_artifacts()
        publication.finish(self.bundle_path)
        preview_path = self.root / "publication-preview.json"
        preview = json.loads(preview_path.read_text())
        preview["publication_digest"] = "0" * 64
        preview_path.write_text(json.dumps(preview))
        with self.assertRaisesRegex(ValueError, "Preview inputs changed"):
            publication.verify(self.bundle_path)
        self.assertEqual(self.api_calls, [])

    def test_github_finish_saves_confirmed_receipts_and_full_report(self):
        receipt = publication.finish(self.bundle_path)
        self.assertEqual(receipt["status"], "confirmed")
        self.assertEqual(self.result()["publication"]["status"], "confirmed")
        state = self.progress_state()
        self.assertEqual((state["repo"], state["pr"], state["base"], state["head"]), ("o/r", 7, "a" * 40, "b" * 40))
        self.assertEqual(state["status"], "complete")
        self.assertEqual(state["approval_decision"], self.approval)
        self.assertEqual(state["publication_digest"], publication.publication_digest(self.bundle["stages"], state["checklist"]))
        self.assertEqual(len(self.backend.comments), 1)
        self.assertIn(self.bundle["stages"]["report"]["markdown"], self.backend.comments[0]["body"])
        self.assertEqual(publication.verify(self.bundle_path)["status"], "confirmed")

    def test_confirmed_finish_rechecks_receipts_without_repeating_writes(self):
        publication.finish(self.bundle_path)
        before = list(self.backend.writes)
        self.assertEqual(publication.finish(self.bundle_path)["status"], "confirmed")
        self.assertEqual(self.backend.writes, before)

    def test_approval_is_verified_at_the_reviewed_commit(self):
        self.approval["outcome"] = "approve"
        self.approval["checks"]["low_risk"]["result"] = "Pass"
        self.approval["next_steps"] = []
        self.write_artifacts()
        self.assertEqual(publication.finish(self.bundle_path)["status"], "confirmed")
        self.assertEqual(len(self.backend.reviews), 1)
        self.assertEqual(self.backend.reviews[0]["state"], "APPROVED")
        self.backend.reviews[0]["commit_id"] = "c" * 40
        with self.assertRaisesRegex(ValueError, "confirmed approval at the reviewed head"):
            publication.verify(self.bundle_path)

    def test_inline_findings_are_verified_at_the_reviewed_commit(self):
        self.approval["checks"]["clean_review"]["result"] = "Fail"
        self.bundle["stages"]["decision"]["inlineComments"] = [{
            "id": "F1", "path": "src/save.ts", "line": 12, "side": "RIGHT", "body": "F1. Preserve the saved value.",
        }]
        self.write_artifacts()
        self.assertEqual(publication.finish(self.bundle_path)["status"], "confirmed")
        self.assertEqual(self.backend.reviews[0]["state"], "COMMENTED")
        self.backend.reviews[0]["commit_id"] = "c" * 40
        with self.assertRaisesRegex(ValueError, "confirmed inline findings at the reviewed head"):
            publication.verify(self.bundle_path)

    def test_stale_head_prevents_finish_and_progress_writes(self):
        self.backend.head = "c" * 40
        with self.assertRaisesRegex(ValueError, "live PR head changed"):
            publication.finish(self.bundle_path)
        with self.assertRaisesRegex(ValueError, "live PR head changed"):
            publication.progress(self.inputs, {"research": "running"})
        self.assertEqual(self.backend.writes, [])
        self.assertFalse((self.root / "progress.json").exists())

    def test_uncertain_write_is_saved_as_failed_and_not_automatically_repeated(self):
        self.backend.fail_after = ("POST", "repos/o/r/issues/7/comments")
        code, output = self.invoke_main("finish", self.bundle_path)
        self.assertEqual(code, 1, output)
        self.assertIn("not confirmed", output)
        self.assertEqual(len(self.backend.comments), 1)
        self.assertEqual(self.result()["publication"]["status"], "failed")
        self.assertTrue(self.result()["publication"]["inspectBeforeRetry"])
        writes = list(self.backend.writes)
        code, output = self.invoke_main("finish", self.bundle_path)
        self.assertEqual(code, 1, output)
        self.assertIn("already attempted", output)
        self.assertEqual(self.backend.writes, writes)

    def test_progress_reuses_one_comment_and_delayed_updates_leave_final_report_unchanged(self):
        publication.progress(self.inputs, {"research": "running"})
        publication.progress(self.inputs, {"research": "complete", "assessments": "running"})
        self.assertEqual(len(self.backend.comments), 1)
        self.assertIn("assessments: running", self.backend.comments[0]["body"])
        publication.finish(self.bundle_path)
        body = self.backend.comments[0]["body"]
        writes = list(self.backend.writes)
        receipt = publication.progress(self.inputs, {"research": "running"})
        self.assertEqual(receipt["status"], "confirmed")
        self.assertEqual(self.backend.comments[0]["body"], body)
        self.assertEqual(self.backend.writes, writes)

    def test_verification_rejects_removed_run_marker_without_mutating_remote(self):
        publication.finish(self.bundle_path)
        self.backend.comments[0]["body"] = "Another process replaced this comment."
        writes = list(self.backend.writes)
        with self.assertRaisesRegex(ValueError, "no longer belongs to this run"):
            publication.verify(self.bundle_path)
        self.assertEqual(self.backend.writes, writes)

    def test_verification_rejects_changed_content_even_with_the_run_marker(self):
        publication.finish(self.bundle_path)
        self.backend.comments[0]["body"] += "\nAn unrelated edit changed the published report."
        writes = list(self.backend.writes)
        with self.assertRaisesRegex(ValueError, "content differs from the accepted report"):
            publication.verify(self.bundle_path)
        self.assertEqual(self.backend.writes, writes)

    def test_incomplete_review_cannot_publish(self):
        self.bundle["status"] = "incomplete"
        with self.assertRaisesRegex(ValueError, "incomplete review cannot publish"):
            publication.finish(self.bundle_path)
        self.assertEqual(self.api_calls, [])


if __name__ == "__main__":
    unittest.main()
