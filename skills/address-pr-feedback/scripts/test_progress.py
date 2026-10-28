#!/usr/bin/env python3
"""Tests for progress.py.

Runs the helper against a stub `gh` executable so no live GitHub calls are
made. The stub keeps its world (comments, POST failure flag) in a JSON file
named by STUB_WORLD and returns real-shaped payloads.

    python3 test_progress.py
"""

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent / "progress.py"
REPO = "acme/web"
PR = "123"

STUB = '''#!/usr/bin/env python3
"""Stub gh for progress.py tests. World lives in the file named by STUB_WORLD."""
import json
import os
import sys

args = sys.argv[1:]
world_path = os.environ["STUB_WORLD"]
world = json.loads(open(world_path).read())

def save():
    with open(world_path, "w") as handle:
        json.dump(world, handle)

if args[0] == "repo":
    assert args[1:] == ["view", "--json", "nameWithOwner"], args
    print(json.dumps({"nameWithOwner": "acme/web"}))
    sys.exit(0)
assert args[0] == "api", args
method = args[args.index("--method") + 1]
path = args[args.index("--method") + 2]
body = json.loads(sys.stdin.read())["body"] if "--input" in args else None
if method == "POST":
    if world.get("fail_post"):
        world["fail_post"] = False
        save()
        sys.stderr.write("stub: simulated POST failure\\n")
        sys.exit(1)
    comment_id = world["next_id"]
    world["next_id"] += 1
    world["comments"][str(comment_id)] = body
    save()
    print(json.dumps({"id": comment_id,
                      "html_url": "https://github.com/acme/web/pull/123#issuecomment-%d" % comment_id}))
elif method == "GET":
    assert path.startswith("repos/acme/web/issues/123/comments"), path
    print(json.dumps([{"id": int(key), "body": value} for key, value in world["comments"].items()]))
elif method == "PATCH":
    comment_id = path.rsplit("/", 1)[1]
    if comment_id not in world["comments"]:
        sys.stderr.write("stub: unknown comment\\n")
        sys.exit(1)
    if world.get("fail_patch"):
        world["fail_patch"] = False
        save()
        sys.stderr.write("stub: simulated PATCH failure\\n")
        sys.exit(1)
    world["comments"][comment_id] = body
    save()
    print(json.dumps({"id": int(comment_id),
                      "html_url": "https://github.com/acme/web/pull/123#issuecomment-%d" % int(comment_id)}))
else:
    sys.stderr.write("stub: unhandled %s %s\\n" % (method, path))
    sys.exit(1)
'''


class ProgressTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        root = Path(self._tmp.name)
        self.stub_dir = root / "stub"
        self.stub_dir.mkdir()
        stub = self.stub_dir / "gh"
        stub.write_text(STUB)
        os.chmod(stub, 0o755)
        self.state_dir = root / "state"
        self.world_path = root / "world.json"
        self.world_path.write_text(json.dumps({"comments": {}, "next_id": 1}))
        self.env = dict(os.environ)
        self.env["PATH"] = str(self.stub_dir) + os.pathsep + self.env["PATH"]
        self.env["STUB_WORLD"] = str(self.world_path)

    def tearDown(self):
        self._tmp.cleanup()

    def run_cli(self, *args):
        return subprocess.run([sys.executable, str(SCRIPT), *args], capture_output=True, text=True, env=self.env)

    def world(self):
        return json.loads(self.world_path.read_text())

    def set_world(self, **changes):
        world = self.world()
        world.update(changes)
        self.world_path.write_text(json.dumps(world))

    def start(self, *extra):
        """Run a fresh start and return the state file path it printed."""
        result = self.run_cli("start", "--pr", PR, "--repo", REPO, "--state-dir", str(self.state_dir), *extra)
        self.assertEqual(result.returncode, 0, result.stderr)
        lines = result.stdout.strip().splitlines()
        self.assertEqual(len(lines), 2, result.stdout)
        state_path = Path(lines[0])
        self.assertTrue(state_path.exists(), lines)
        self.assertIn("issuecomment-", lines[1], result.stdout)
        return state_path

    def state(self, path):
        return json.loads(path.read_text())

    def update(self, path, *args):
        result = self.run_cli("update", "--state", str(path), *args)
        self.assertEqual(result.returncode, 0, result.stderr)
        return result

    def body(self):
        return next(iter(self.world()["comments"].values()))

    def complete_all(self, path):
        for item in self.state(path)["items"]:
            self.update(path, "--active", item)
            self.update(path, "--complete", item, "--evidence", "done")

    def write_summary(self, path, text="Summary text with detail."):
        summary = path.parent / "summary.md"
        summary.write_text(text)
        return summary

    def test_command_shapes(self):
        """The exact command shapes from SKILL.md: flags after the subcommand."""
        path = self.start("--items", "A", "B")
        self.assertEqual(self.state(path)["items"], ["A", "B"])
        self.assertIn("- [ ] A", self.body())
        self.assertIn("- [ ] B", self.body())
        self.update(path, "--active", "A")
        self.update(path, "--complete", "A", "--evidence", "evidence text")
        self.update(path, "--skip", "B", "--reason", "not needed")
        summary = self.write_summary(path)
        result = self.run_cli("finish", "--state", str(path), "--summary", str(summary))
        self.assertEqual(result.returncode, 0, result.stderr)
        # One action per call: two action flags at once is rejected.
        fresh = self.start()
        result = self.run_cli("update", "--state", str(fresh), "--active", "A", "--complete", "B")
        self.assertEqual(result.returncode, 2, result.stderr)

    def test_repo_discovery(self):
        """Without --repo the helper asks gh for nameWithOwner."""
        result = self.run_cli("start", "--pr", PR, "--state-dir", str(self.state_dir))
        self.assertEqual(result.returncode, 0, result.stderr)
        state_path = Path(result.stdout.strip().splitlines()[0])
        self.assertEqual(self.state(state_path)["repo"], "acme/web")

    def test_sequential_updates(self):
        path = self.start()
        self.assertIn("- [ ] Gathering context", self.body())
        self.update(path, "--active", "Gathering context")
        self.assertIn("loading.gif", self.body())
        self.assertIn("Gathering context — in progress", self.body())
        self.update(path, "--complete", "Gathering context", "--evidence", "PR description, diff and CI read")
        self.assertIn("- [x] Gathering context — PR description, diff and CI read", self.body())
        self.assertIn("<!-- feedback-progress:", self.body())

    def test_resume_and_fresh(self):
        path = self.start()
        before = self.world()
        result = self.run_cli("start", "--state", str(path), "--pr", PR)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("issuecomment-", result.stdout)
        self.assertEqual(self.world(), before)
        second = self.start()
        self.assertNotEqual(second, path)
        self.assertEqual(len(self.world()["comments"]), 2)

    def test_blocked_finalisation(self):
        path = self.start()
        items = self.state(path)["items"]
        for item in items[:-1]:
            self.update(path, "--active", item)
            self.update(path, "--complete", item, "--evidence", "done")
        self.update(path, "--block", items[-1], "--reason", "CI is failing")
        summary = self.write_summary(path)
        result = self.run_cli("finish", "--state", str(path), "--summary", str(summary))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("blocked: CI is failing", self.body())
        # A pending stage blocks finalisation and is named in the error.
        fresh = self.start()
        result = self.run_cli("finish", "--state", str(fresh), "--summary", str(summary))
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("Gathering context", result.stderr)

    def test_terminal_rejections(self):
        path = self.start()
        self.complete_all(path)
        summary = self.write_summary(path)
        result = self.run_cli("finish", "--state", str(path), "--summary", str(summary))
        self.assertEqual(result.returncode, 0, result.stderr)
        result = self.run_cli("update", "--state", str(path), "--active", "Gathering context")
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("finalised", result.stderr)
        # Re-activating a completed item is out of order.
        fresh = self.start()
        self.update(fresh, "--active", "Gathering context")
        self.update(fresh, "--complete", "Gathering context", "--evidence", "done")
        result = self.run_cli("update", "--state", str(fresh), "--active", "Gathering context")
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("out of order", result.stderr)
        # Unknown item names.
        result = self.run_cli("update", "--state", str(fresh), "--complete", "No such item", "--evidence", "x")
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("Unknown item", result.stderr)

    def test_api_failure_and_recovery(self):
        self.set_world(fail_post=True)
        result = self.run_cli("start", "--pr", PR, "--repo", REPO, "--state-dir", str(self.state_dir))
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("simulated POST failure", result.stderr)
        state_path = next(self.state_dir.glob("*.json"))
        self.assertIsNone(self.state(state_path)["comment_id"])
        # The comment exists on GitHub with this run's marker; the next start adopts it.
        run_id = self.state(state_path)["run_id"]
        world = self.world()
        world["comments"]["99"] = "orphan\n<!-- feedback-progress:%s -->" % run_id
        self.world_path.write_text(json.dumps(world))
        result = self.run_cli("start", "--state", str(state_path), "--pr", PR)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.state(state_path)["comment_id"], 99)
        self.assertEqual(len(self.world()["comments"]), 1)

    def test_sequential_ordering(self):
        path = self.start()
        # Activating a later stage while an earlier one is pending is rejected.
        result = self.run_cli("update", "--state", str(path), "--active", "Reading feedback")
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("out of order", result.stderr)
        # Completing a stage that was never activated is rejected.
        result = self.run_cli("update", "--state", str(path), "--complete", "Gathering context", "--evidence", "x")
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("must be active", result.stderr)
        # Skipping a later stage while an earlier one is open is rejected.
        result = self.run_cli("update", "--state", str(path), "--skip", "Applying changes", "--reason", "x")
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("out of order", result.stderr)

    def test_resume_without_pr(self):
        path = self.start()
        result = self.run_cli("start", "--state", str(path))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("issuecomment-", result.stdout)
        # A conflicting PR number is rejected.
        result = self.run_cli("start", "--state", str(path), "--pr", "999")
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("conflicts", result.stderr)

    def test_patch_failure_and_sync(self):
        path = self.start()
        self.update(path, "--active", "Gathering context")
        self.update(path, "--complete", "Gathering context", "--evidence", "done")
        self.set_world(fail_patch=True)
        result = self.run_cli("update", "--state", str(path), "--active", "Reading feedback")
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("simulated PATCH failure", result.stderr)
        # The stage change is saved despite the failed publication.
        self.assertEqual(self.state(path)["stages"]["Reading feedback"]["status"], "active")
        # sync republishes the saved state.
        result = self.run_cli("sync", "--state", str(path))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Reading feedback — in progress", self.body())

    def test_finish_failure_and_sync(self):
        path = self.start()
        self.complete_all(path)
        summary = self.write_summary(path)
        self.set_world(fail_patch=True)
        result = self.run_cli("finish", "--state", str(path), "--summary", str(summary))
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("simulated PATCH failure", result.stderr)
        # The summary and finalised flag are saved despite the failed publication.
        state = self.state(path)
        self.assertTrue(state["finalised"])
        self.assertIn("Summary text with detail.", state["summary"])
        # sync republishes the finalised summary with unchanged stage outcomes.
        result = self.run_cli("sync", "--state", str(path))
        self.assertEqual(result.returncode, 0, result.stderr)
        body = self.body()
        self.assertIn("Summary text with detail.", body)
        self.assertIn("- [x] Gathering context — done", body)

    def test_summary_persistence(self):
        path = self.start()
        self.complete_all(path)
        summary = self.write_summary(path)
        result = self.run_cli("finish", "--state", str(path), "--summary", str(summary))
        self.assertEqual(result.returncode, 0, result.stderr)
        state = self.state(path)
        self.assertTrue(state["finalised"])
        self.assertIn("Summary text with detail.", state["summary"])
        self.assertIn("Summary text with detail.", self.body())


if __name__ == "__main__":
    unittest.main(verbosity=2)
