#!/usr/bin/env python3
"""Maintain one recoverable progress comment per feedback run.

Each run gets its own state file and comment, so a second feedback pass on
the same PR starts a fresh comment. A marker in the comment body lets a run
that died between the POST and the state save recover its comment instead of
posting a duplicate.

    python3 progress.py start --pr 123 [--repo owner/repo] [--state-dir DIR] [--items ...]
    python3 progress.py start --state FILE  # resume an existing run without --pr
    python3 progress.py update --state FILE --active "Item"
    python3 progress.py update --state FILE --complete "Item" --evidence "text"
    python3 progress.py update --state FILE --skip "Item" --reason "text"
    python3 progress.py update --state FILE --block "Item" --reason "text"
    python3 progress.py finish --state FILE --summary FILE
    python3 progress.py sync --state FILE  # republish the saved state after a failed publication
"""

import argparse
import json
import os
import subprocess
import sys
import uuid
from pathlib import Path

SPINNER = '<img src="https://cdnjs.cloudflare.com/ajax/libs/lightbox2/2.11.5/images/loading.gif" width="16" height="16" alt="">'
DEFAULT_ITEMS = [
    "Gathering context",
    "Reading feedback",
    "Deciding on changes",
    "Applying changes",
    "Verifying and committing",
]
DEFAULT_STATE_DIR = Path.home() / ".cache" / "pi" / "feedback"
TERMINAL = ("completed", "skipped", "blocked")


class Github:
    def api(self, method, path, payload=None):
        command = ["gh", "api", "--method", method, path]
        if payload is not None:
            command += ["--input", "-"]
        result = subprocess.run(command, input=json.dumps(payload) if payload is not None else None,
                                text=True, capture_output=True)
        if result.returncode:
            raise RuntimeError(result.stderr.strip() or "gh api failed")
        return json.loads(result.stdout) if result.stdout.strip() else None

    def list_comments(self, repo, pr):
        items = []
        page = 1
        while True:
            batch = self.api("GET", f"repos/{repo}/issues/{pr}/comments?per_page=100&page={page}")
            items.extend(batch)
            if len(batch) < 100:
                return items
            page += 1


def resolve_repo(repo):
    if repo:
        return repo
    result = subprocess.run(["gh", "repo", "view", "--json", "nameWithOwner"], text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError("pass --repo or run inside the PR's repository")
    return json.loads(result.stdout)["nameWithOwner"]


def marker(run_id):
    return f"<!-- feedback-progress:{run_id} -->"


def render(state):
    lines = ["**🤖 Addressing review feedback**", ""]
    for item in state["items"]:
        stage = state["stages"][item]
        status, note = stage["status"], stage.get("note") or ""
        if status == "completed":
            lines.append(f"- [x] {item} — {note}")
        elif status == "active":
            lines.append(f"- [ ] {SPINNER} {item} — in progress")
        elif status == "skipped":
            lines.append(f"- [ ] {item} — skipped: {note}")
        elif status == "blocked":
            lines.append(f"- [ ] {item} — blocked: {note}")
        else:
            lines.append(f"- [ ] {item}")
    body = "\n".join(lines)
    if state.get("summary"):
        body += "\n\n" + state["summary"]
    return body + "\n" + marker(state["run_id"])


def save(path, state):
    """Write the state file atomically: temp file in the same directory, then rename."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(json.dumps(state, indent=2) + "\n")
    os.replace(temporary, path)


def load(path):
    return json.loads(path.read_text())


def url(state):
    return f"https://github.com/{state['repo']}/pull/{state['pr']}#issuecomment-{state['comment_id']}"


def first_open(state):
    """The first stage that is not completed, skipped or blocked."""
    for item in state["items"]:
        if state["stages"][item]["status"] not in TERMINAL:
            return item
    return None


def adopt(gh, state):
    """Find this run's comment by its marker. Returns the comment id or None."""
    for comment in gh.list_comments(state["repo"], state["pr"]):
        if marker(state["run_id"]) in (comment.get("body") or ""):
            return comment["id"]
    return None


def ensure_comment(gh, state):
    if state["comment_id"] is None:
        state["comment_id"] = adopt(gh, state)
        if state["comment_id"] is None:
            raise RuntimeError("The progress comment was not found. Run start to create it.")


def start(args, gh):
    path = Path(args.state) if args.state else None
    state = load(path) if path is not None and path.exists() else None
    if state is not None:
        if args.repo and args.repo != state["repo"]:
            raise RuntimeError(f"--repo {args.repo!r} conflicts with the stored {state['repo']!r}.")
        if args.pr is not None and args.pr != state["pr"]:
            raise RuntimeError(f"--pr {args.pr} conflicts with the stored {state['pr']}.")
    else:
        if args.pr is None:
            raise RuntimeError("start requires --pr for a fresh run.")
        repo = resolve_repo(args.repo)
        run_id = uuid.uuid4().hex[:8]
        if path is None:
            path = Path(args.state_dir) / f"{repo.replace('/', '-')}-pr{args.pr}-{run_id}.json"
        items = args.items or DEFAULT_ITEMS
        state = {
            "run_id": run_id,
            "repo": repo,
            "pr": args.pr,
            "head": args.head,
            "comment_id": None,
            "items": items,
            "stages": {item: {"status": "pending", "note": None} for item in items},
            "summary": None,
            "finalised": False,
        }
        # Save before the POST so a crash between POST and save is recoverable.
        save(path, state)
    print(path)
    sys.stdout.flush()
    if state["comment_id"] is None:
        state["comment_id"] = adopt(gh, state)
        if state["comment_id"] is None:
            comment = gh.api("POST", f"repos/{state['repo']}/issues/{state['pr']}/comments",
                             {"body": render(state)})
            state["comment_id"] = comment["id"]
        save(path, state)
    print(url(state))


def update(args, gh):
    path = Path(args.state)
    state = load(path)
    if state["finalised"]:
        raise RuntimeError("This run is finalised. Start a new run for further work.")
    action = "active" if args.active else "complete" if args.complete else "skip" if args.skip else "block"
    item = args.active or args.complete or args.skip or args.block
    if item not in state["stages"]:
        raise RuntimeError(f"Unknown item {item!r}. Items: {', '.join(state['items'])}")
    open_item = first_open(state)
    if item != open_item:
        raise RuntimeError(f"{item!r} is out of order. The first unfinished stage is {open_item!r}.")
    stage = state["stages"][item]
    current = stage["status"]
    if action == "active":
        if current != "pending":
            raise RuntimeError(f"{item} is {current}; only a pending stage can be activated.")
    elif action == "complete":
        if current != "active":
            raise RuntimeError(f"{item} must be active before it can be completed.")
        if not args.evidence:
            raise RuntimeError("Completing a stage requires --evidence.")
    else:
        if not args.reason:
            raise RuntimeError(f"Marking {item} {action} requires --reason.")
    stage["status"] = {"active": "active", "complete": "completed", "skip": "skipped", "block": "blocked"}[action]
    stage["note"] = args.evidence if action == "complete" else args.reason
    # Persist the intended change before publishing, so a failed PATCH can be retried with sync.
    save(path, state)
    ensure_comment(gh, state)
    gh.api("PATCH", f"repos/{state['repo']}/issues/comments/{state['comment_id']}", {"body": render(state)})
    print(url(state))


def finish(args, gh):
    path = Path(args.state)
    state = load(path)
    if state["finalised"]:
        raise RuntimeError("This run is already finalised.")
    open_items = [item for item in state["items"] if state["stages"][item]["status"] not in TERMINAL]
    if open_items:
        raise RuntimeError("Not every stage is finished: " + ", ".join(open_items))
    state["summary"] = Path(args.summary).read_text().rstrip()
    state["finalised"] = True
    save(path, state)
    ensure_comment(gh, state)
    gh.api("PATCH", f"repos/{state['repo']}/issues/comments/{state['comment_id']}", {"body": render(state)})
    print(url(state))


def sync(args, gh):
    """Republish the saved state, including a finalised summary. Stage outcomes are unchanged."""
    path = Path(args.state)
    state = load(path)
    ensure_comment(gh, state)
    gh.api("PATCH", f"repos/{state['repo']}/issues/comments/{state['comment_id']}", {"body": render(state)})
    print(url(state))


def parser():
    shared = argparse.ArgumentParser(add_help=False)
    shared.add_argument("--pr", type=int, help="PR number.")
    shared.add_argument("--repo", help="owner/repo. Defaults to the current repository.")
    shared.add_argument("--state-dir", default=str(DEFAULT_STATE_DIR), help="Directory for state files.")
    result = argparse.ArgumentParser(description=__doc__)
    commands = result.add_subparsers(dest="command", required=True)
    start = commands.add_parser("start", parents=[shared])
    start.add_argument("--state", help="State file to resume. Omit to start a fresh run.")
    start.add_argument("--items", nargs="+", help="Checklist items in order.")
    start.add_argument("--head", help="Head commit SHA.")
    update = commands.add_parser("update", parents=[shared])
    update.add_argument("--state", required=True, help="State file printed by start.")
    action = update.add_mutually_exclusive_group(required=True)
    action.add_argument("--active", help="Mark this item in progress.")
    action.add_argument("--complete", help="Mark this item complete.")
    action.add_argument("--skip", help="Mark this item skipped.")
    action.add_argument("--block", help="Mark this item blocked.")
    update.add_argument("--evidence", help="Evidence for --complete.")
    update.add_argument("--reason", help="Reason for --skip or --block.")
    finish = commands.add_parser("finish", parents=[shared])
    finish.add_argument("--state", required=True, help="State file printed by start.")
    finish.add_argument("--summary", required=True, help="Path to the summary Markdown.")
    sync = commands.add_parser("sync", parents=[shared])
    sync.add_argument("--state", required=True, help="State file printed by start.")
    return result


def main(argv=None):
    args = parser().parse_args(argv)
    try:
        gh = Github()
        {"start": start, "update": update, "finish": finish, "sync": sync}[args.command](args, gh)
        return 0
    except (RuntimeError, FileNotFoundError, json.JSONDecodeError, KeyError, ValueError) as error:
        print(error, file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
