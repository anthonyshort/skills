#!/usr/bin/env python3
"""Maintain one recoverable GitHub progress comment per review run."""

import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import uuid


MAX_BODY = 60_000


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

    def list(self, path):
        items = []
        page = 1
        while True:
            batch = self.api("GET", f"{path}?per_page=100&page={page}")
            items.extend(batch)
            if len(batch) < 100:
                return items
            page += 1


def save(path, state):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(state, indent=2) + "\n")
    temporary.replace(path)


def marker(state, key):
    return f"<!-- review-progress:{state['run_id']}:{key} -->"


def read(path):
    return path.read_text(encoding="utf-8")


def checked_size(body):
    if len(body) > MAX_BODY:
        raise ValueError("Comment is too large. Shorten the summary or split the oversized report block.")
    return body


def report_parts(report, limit):
    """Split only between complete Markdown blocks outside fences and details."""
    blocks = []
    current = []
    fence = None
    depth = 0
    in_comment = False
    for line in report.splitlines(keepends=True):
        current.append(line)
        match = re.match(r"^ {0,3}(`{3,}|~{3,})", line)
        if match:
            token = match.group(1)
            if fence is None:
                fence = token
            elif token[0] == fence[0] and len(token) >= len(fence) and not line[match.end():].strip():
                fence = None
        if fence is None and not match:
            visible = ""
            remaining = line
            while remaining:
                boundary = "-->" if in_comment else "<!--"
                before, separator, after = remaining.partition(boundary)
                if not in_comment:
                    visible += before
                if not separator:
                    break
                in_comment = not in_comment
                remaining = after
            tag = re.fullmatch(r" {0,3}<(\/?)details(?:\s[^>]*)?>\s*", visible, re.I)
            if tag:
                depth += -1 if tag.group(1) else 1
            if depth < 0:
                raise ValueError("Report has an unmatched closing details tag.")
        if not line.strip() and fence is None and depth == 0 and not in_comment:
            blocks.append("".join(current))
            current = []
    if fence is not None or depth or in_comment:
        raise ValueError("Report contains an unclosed code fence, details fold or HTML comment.")
    if current:
        blocks.append("".join(current))
    parts = []
    for block in blocks:
        if len(block) > limit:
            raise ValueError("An indivisible report block exceeds the comment limit. Split its table, fold or prose before retrying.")
        if parts and len(parts[-1]) + len(block) <= limit:
            parts[-1] += block
        else:
            parts.append(block)
    return parts or [""]


def inline_comments(path):
    items = json.loads(read(path)) if path else []
    if not isinstance(items, list):
        raise ValueError("Inline input must be a JSON list.")
    ids = set()
    for item in items:
        if not isinstance(item, dict) or set(item) != {"id", "path", "line", "side", "body"}:
            raise ValueError("Each inline finding requires exactly id, path, line, side and body.")
        if not all(isinstance(item[key], str) and item[key].strip() for key in ("id", "path", "body")):
            raise ValueError("Inline id, path and body must be non-empty strings.")
        if item["id"] in ids or type(item["line"]) is not int or item["line"] < 1 or item["side"] not in ("LEFT", "RIGHT"):
            raise ValueError("Inline IDs must be unique, lines positive integers and sides LEFT or RIGHT.")
        ids.add(item["id"])
        checked_size(f"**{item['id']}**\n\n{item['body'].rstrip()}")
    return items


def render(state, title, note="", summary="", report=""):
    link = f"https://github.com/{state['repo']}/commit/{state['head']}"
    body = f"🤖 {title} [{state['head'][:7]}]({link})\n\n---\n\n### Status\n\n{state['checklist'].rstrip()}\n"
    if note:
        body += f"\n{note}\n"
    body += "\n---\n"
    if summary:
        body += f"\n### Result\n\n{summary.rstrip()}\n\n---\n"
    if report:
        body += f"\n<details>\n<summary>Full report</summary>\n\n{report}\n\n</details>\n"
    return body


def incomplete(state):
    return {**state, "checklist": re.sub(r"(?im)^(- )\[x\](.*(?:publish|publication).*)$", r"\1[ ]\2", state["checklist"])}


class Publisher:
    def __init__(self, api, state, path):
        self.api, self.state, self.path = api, state, path
        self.root = f"repos/{state['repo']}"
        self.issue = f"{self.root}/issues/{state['pr']}/comments"
        self.pull = f"{self.root}/pulls/{state['pr']}"

    def comment(self, key, body):
        tag = marker(self.state, key)
        body = checked_size(f"{body.rstrip()}\n\n{tag}")
        found = self.state["comments"].get(key)
        if not found:
            matches = [item for item in self.api.list(self.issue) if tag in (item.get("body") or "")]
            if len(matches) > 1:
                raise ValueError(f"Multiple comments match {key}. Resolve them before retrying.")
            found = matches[0] if matches else None
        if found:
            current = self.api.api("GET", f"{self.root}/issues/comments/{found['id']}")
            if tag not in (current.get("body") or ""):
                raise ValueError("Saved comment no longer contains this run's marker. Refusing to overwrite it.")
            saved = self.api.api("PATCH", f"{self.root}/issues/comments/{found['id']}", {"body": body})
        else:
            saved = self.api.api("POST", self.issue, {"body": body})
        self.state["comments"][key] = {"id": saved["id"], "html_url": saved["html_url"]}
        save(self.path, self.state)
        return saved["html_url"]

    def inlines(self, items):
        if not items:
            return
        tag = marker(self.state, "inline-review")
        digest = hashlib.sha256(json.dumps(items, sort_keys=True).encode()).hexdigest()
        previous = self.state.get("inline_digest")
        if previous and previous != digest:
            raise ValueError("Inline findings changed after publication began. Inspect the existing review before retrying.")
        self.state["inline_digest"] = digest
        save(self.path, self.state)
        reviews = self.api.list(f"{self.pull}/reviews")
        matches = [review for review in reviews if tag in (review.get("body") or "")]
        if len(matches) > 1:
            raise ValueError("Multiple inline reviews match this run. Inspect them before retrying.")
        if matches:
            review = matches[0]
            if review["state"] == "PENDING":
                review = self.api.api("POST", f"{self.pull}/reviews/{review['id']}/events", {"event": "COMMENT"})
            elif review["state"] != "COMMENTED":
                raise ValueError("This run's inline review has an unexpected state. Inspect it before retrying.")
        else:
            if any(review["state"] == "PENDING" for review in reviews):
                raise ValueError("An unrelated pending review exists. Leave it intact and resolve publication explicitly.")
            comments = [{key: item[key] for key in ("path", "line", "side", "body")} for item in items]
            for item, comment in zip(items, comments):
                comment["body"] = f"**{item['id']}**\n\n{comment['body'].rstrip()}"
            review = self.api.api("POST", f"{self.pull}/reviews", {
                "commit_id": self.state["head"], "event": "COMMENT", "body": f"Verified inline findings.\n\n{tag}",
                "comments": comments,
            })
        self.state["inline_review"] = {"id": review["id"], "html_url": review["html_url"]}
        save(self.path, self.state)


def run(args, api):
    state = json.loads(read(args.state)) if args.state.exists() else None
    if args.command == "start":
        target = {key: getattr(args, key) for key in ("repo", "pr", "base", "head")}
        if not re.fullmatch(r"[\w.-]+/[\w.-]+", args.repo) or args.pr < 1:
            raise ValueError("Provide --repo OWNER/REPO and a positive --pr number.")
        if not all(re.fullmatch(r"[0-9a-fA-F]{40}", value) for value in (args.base, args.head)):
            raise ValueError("Base and head must be full 40-character commit hashes.")
        if state and any(state[key] != value for key, value in target.items()):
            raise ValueError("State belongs to a different target or revision. Use a new state file for a new run.")
        if state and state.get("status") == "complete":
            return {"status": "complete", "url": state["comments"]["main"]["html_url"]}
        state = state or {**target, "run_id": uuid.uuid4().hex, "comments": {}, "status": "reviewing"}
    elif state is None:
        raise ValueError("No run state found. Use start first.")
    elif state.get("status") == "complete" and args.command != "finish":
        raise ValueError("This run is complete. Use a new state file for a new review.")
    if getattr(args, "checklist", None):
        state["checklist"] = read(args.checklist)
    summary = read(args.summary) if args.command == "finish" else ""
    report = read(args.report) if args.command == "finish" else ""
    items = inline_comments(args.inline) if args.command == "finish" else []
    if args.command == "finish":
        publication = {"summary": summary, "report": report, "inline": items, "checklist": state["checklist"]}
        digest = hashlib.sha256(json.dumps(publication, sort_keys=True).encode()).hexdigest()
        if state.get("publication_digest") and state["publication_digest"] != digest:
            raise ValueError("Publication inputs changed after finishing began. Retry identical files, or inspect the existing publication and use a new run.")
        state["publication_digest"] = digest
    title = "Reviewed" if args.command == "finish" else "Reviewing"
    note = f"**Interrupted:** {args.reason}" if args.command == "interrupt" else ""
    body = render(incomplete(state) if args.command == "interrupt" else state, title, note, summary, report)
    parts = report_parts(report, MAX_BODY - 1000) if len(body) + 500 > MAX_BODY else []
    if args.dry_run:
        return {"dry_run": True, "body": body if not parts else render(state, title, note, summary),
                "report_parts": parts, "inline": items, "publication_digest": state.get("publication_digest")}
    state["status"] = "publishing" if args.command == "finish" else ("interrupted" if args.command == "interrupt" else "reviewing")
    save(args.state, state)
    publisher = Publisher(api, state, args.state)
    advanced = api.api("GET", publisher.pull)["head"]["sha"] != state["head"]
    if advanced:
        note += "\n**Newer commits are not reviewed.** This run remains pinned to the linked revision."
        if items:
            note += " Inline findings were kept in the report because the PR head changed."
    if args.command == "finish":
        body = render(state, title, note, summary, report)
        parts = report_parts(report, MAX_BODY - 1000) if len(body) + 500 > MAX_BODY else []
        pending = incomplete(state)
        publisher.comment("main", render(pending, "Reviewing", "**Publishing results — publication incomplete.**" + note, summary))
        if items and not advanced:
            publisher.inlines(items)
        if parts:
            links = []
            for index, part in enumerate(parts, 1):
                url = publisher.comment(f"report-{index}", f"## Full report — part {index}/{len(parts)}\n\n{part}")
                links.append(f"- [Full report — part {index}/{len(parts)}]({url})")
            summary += "\n\n### Full report\n\n" + "\n".join(links)
            report = ""
        state["status"] = "complete"
    body = render(incomplete(state) if args.command == "interrupt" else state, title, note.strip(), summary, report)
    url = publisher.comment("main", body)
    save(args.state, state)
    return {"status": state["status"], "url": url, "inline_review": state.get("inline_review")}


def parser():
    result = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""Examples (options precede the operation):
  python3 github_progress.py --state /tmp/review/github.json start --repo owner/repo --pr 42 --base FULL_SHA --head FULL_SHA --checklist status.md
  python3 github_progress.py --state /tmp/review/github.json update --checklist status.md
  python3 github_progress.py --state /tmp/review/github.json --dry-run finish --summary summary.md --report review-report.md --inline inline.json

The checklist is Markdown supplied by the parent. Finish accepts an updated
--checklist. Inline JSON is a list of {id, path, line, side, body}; side is LEFT
or RIGHT. Only supply verified new bugs with current diff anchors. The parent
checks existing threads for duplicates and edits prose before publication.

Dry run renders payloads without network calls or state writes. Real operations
read GitHub and persist recoverable state before writing. Retry the same command
and state after a failure. Do not run concurrent writers against one state file.
Finish inputs are frozen once publication begins. Retry with identical files.
""")
    result.add_argument("--state", required=True, type=Path)
    result.add_argument("--dry-run", action="store_true")
    commands = result.add_subparsers(dest="command", required=True)
    start = commands.add_parser("start", help="Create a run or recover its initial comment")
    start.add_argument("--repo", required=True)
    start.add_argument("--pr", required=True, type=int)
    start.add_argument("--base", required=True)
    start.add_argument("--head", required=True)
    start.add_argument("--checklist", required=True, type=Path)
    update = commands.add_parser("update", help="Replace the checklist at a meaningful milestone")
    update.add_argument("--checklist", required=True, type=Path)
    finish = commands.add_parser("finish", help="Publish the summary, complete report and optional inline bugs")
    finish.add_argument("--summary", required=True, type=Path)
    finish.add_argument("--report", required=True, type=Path)
    finish.add_argument("--checklist", type=Path)
    finish.add_argument("--inline", type=Path)
    interrupt = commands.add_parser("interrupt", help="Record an incomplete or blocked run")
    interrupt.add_argument("--reason", required=True)
    return result


def main(argv=None):
    args = parser().parse_args(argv)
    try:
        print(json.dumps(run(args, Github()), indent=2))
        return 0
    except (OSError, ValueError, RuntimeError, KeyError) as error:
        print(f"Publication incomplete: {error}\nInspect saved run state and retry after resolving the problem.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
