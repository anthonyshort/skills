#!/usr/bin/env python3
"""Publish accepted review artefacts through the existing recoverable helper."""

import argparse
import importlib.util
import json
from pathlib import Path
import subprocess
import sys

from validate_bundle import validate, require, publication_digest


def save(path, value):
    require(not path.is_symlink(), f"Refusing symlinked publication file: {path}")
    temporary = path.with_suffix(path.suffix + ".tmp")
    require(not temporary.is_symlink(), "Refusing symlinked temporary publication file")
    temporary.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def helper(inputs):
    directory = Path(inputs["skillRoot"]) / "scripts"
    sys.path.insert(0, str(directory))
    sys.dont_write_bytecode = True
    specification = importlib.util.spec_from_file_location("review_publication_helper", directory / "github_progress.py")
    module = importlib.util.module_from_spec(specification)
    specification.loader.exec_module(module)
    return module


def live_target(api, inputs):
    publication = inputs["publication"]
    pull = api.api("GET", f"repos/{publication['repository']}/pulls/{publication['prNumber']}")
    require(pull.get("head", {}).get("sha") == inputs["head"], "The live PR head changed; stop before publishing and review the new revision")
    require(pull.get("state") == "open" and not pull.get("merged"), "The PR is no longer open")
    return pull


def checklist(states):
    lines = []
    for name, status in states.items():
        marker = "x" if status == "complete" else " "
        lines.append(f"- [{marker}] {name}: {status}")
    return "\n".join(lines) + "\n"


def progress(inputs, states, api=None):
    require(inputs["publication"]["mode"] == "github", "Live progress requires explicit GitHub publication")
    module = helper(inputs)
    api = api or module.Github()
    root = Path(inputs["artifacts"])
    root.mkdir(parents=True, exist_ok=True)
    state_path = root / "progress.json"
    status_path = root / "progress.md"
    if state_path.exists():
        state = json.loads(state_path.read_text())
        require(all(state.get(key) == value for key, value in {
            "repo": inputs["publication"]["repository"], "pr": inputs["publication"]["prNumber"],
            "base": inputs["base"], "head": inputs["head"],
        }.items()), "Saved progress belongs to another review")
        # Delayed progress must never replace a final report.
        if state["status"] in {"publishing", "complete"}:
            return {"status": "confirmed", "reason": "Final publication owns the comment"}
        operation = ["update", "--checklist", str(status_path)]
    else:
        operation = ["start", "--repo", inputs["publication"]["repository"], "--pr", str(inputs["publication"]["prNumber"]),
                     "--base", inputs["base"], "--head", inputs["head"], "--checklist", str(status_path)]
    live_target(api, inputs)
    require(not status_path.is_symlink(), "Refusing symlinked progress checklist")
    status_path.write_text(checklist(states), encoding="utf-8")
    result = module.run(module.parser().parse_args(["--state", str(state_path), *operation]), api)
    return {"status": "confirmed", "reason": "Progress comment updated", "url": result["url"]}


def accepted(path):
    result_path = path.parent / "result.json"
    result = json.loads(result_path.read_text())
    bundle = validate(path, result["fingerprint"])
    return bundle, result


def verify(path, api=None):
    bundle, result = accepted(path)
    inputs = bundle["input"]
    mode = inputs["publication"]["mode"]
    require(bundle["status"] != "incomplete", "An incomplete review cannot publish")
    if mode == "local":
        require(result["publication"]["status"] == "not_requested", "Unexpected local publication state")
        return {"status": "not_requested", "reason": "Local report only"}
    if mode == "dry-run":
        require(result["publication"]["status"] == "rendered", "Publication preview has not been rendered")
        preview = json.loads((path.parent / "publication-preview.json").read_text())
        state = json.loads((path.parent / "progress.json").read_text())
        require(preview["publication_digest"] == publication_digest(bundle["stages"], state["checklist"]), "Preview inputs changed")
        return {"status": "rendered", "reason": "Publication payload validated without remote writes"}
    require(result["publication"]["status"] in {"pending", "confirmed"}, "Publication was not confirmed; inspect existing remote effects before retrying")
    module = helper(inputs)
    api = api or module.Github()
    live_target(api, inputs)
    state = json.loads((path.parent / "progress.json").read_text())
    for key, value in {"repo": inputs["publication"]["repository"], "pr": inputs["publication"]["prNumber"], "base": inputs["base"], "head": inputs["head"]}.items():
        require(state.get(key) == value, f"Publication receipt identity mismatch: {key}")
    require(state.get("status") == "complete", "The publication helper did not finish")
    require(state.get("publication_digest") == publication_digest(bundle["stages"], state["checklist"]), "Frozen publication inputs changed")
    canonical = (bundle["stages"].get("report") or bundle["stages"]["split-plan"])["markdown"]
    summary = bundle["stages"]["decision"]["summaryMarkdown"]
    parts = module.report_parts(canonical, module.MAX_BODY - 1000) if state.get("report_links") else []
    for key, comment in state["comments"].items():
        remote = api.api("GET", f"repos/{state['repo']}/issues/comments/{comment['id']}")
        require(module.marker(state, key) in remote.get("body", ""), "Published comment no longer belongs to this run")
        require(remote.get("html_url") == comment["html_url"], "Published comment URL differs from its receipt")
        if key == "main":
            expected = module.render(state, "Reviewed", "", summary, "" if parts else canonical)
        elif key.startswith("report-"):
            index = int(key.removeprefix("report-"))
            require(1 <= index <= len(parts), "Unexpected saved report part")
            expected = f"## Full report — part {index}/{len(parts)}\n\n{parts[index - 1]}"
        else:
            continue
        expected = f"{expected.rstrip()}\n\n{module.marker(state, key)}"
        require(remote.get("body", "").rstrip() == expected.rstrip(), "Published comment content differs from the accepted report")
    approval = bundle["stages"]["decision"]["approval"]
    if approval["outcome"] == "approve" or bundle["stages"]["decision"]["inlineComments"]:
        reviews = api.list(f"repos/{state['repo']}/pulls/{state['pr']}/reviews")
        if approval["outcome"] == "approve":
            receipt = state.get("approval", {})
            require(receipt.get("status") == "approved" and any(review.get("id") == receipt.get("id") and review.get("state") == "APPROVED" and review.get("commit_id") == inputs["head"] for review in reviews), "GitHub has not confirmed approval at the reviewed head")
        if bundle["stages"]["decision"]["inlineComments"]:
            receipt = state.get("inline_review", {})
            require(any(review.get("id") == receipt.get("id") and review.get("state") == "COMMENTED" and review.get("commit_id") == inputs["head"] for review in reviews), "GitHub has not confirmed inline findings at the reviewed head")
    return {"status": "confirmed", "reason": "GitHub publication independently verified", "url": state["comments"]["main"]["html_url"]}


def finish(path, api=None):
    bundle, result = accepted(path)
    inputs = bundle["input"]
    mode = inputs["publication"]["mode"]
    require(bundle["status"] != "incomplete", "An incomplete review cannot publish")
    if mode == "local" or result["publication"]["status"] in {"confirmed", "rendered"}:
        return verify(path, api)
    require(result["publication"]["status"] == "pending", "Publication was already attempted; inspect saved state before explicit recovery")
    root = path.parent
    module = helper(inputs)
    api = api or module.Github()
    state_path = root / "progress.json"
    status_path = root / "progress.md"
    states = {name: "complete" for name in bundle["stages"]}
    states["publication"] = "complete"
    status_path.write_text(checklist(states), encoding="utf-8")
    if mode == "github":
        live_target(api, inputs)
        if not state_path.exists():
            module.run(module.parser().parse_args([
                "--state", str(state_path), "start", "--repo", inputs["publication"]["repository"], "--pr", str(inputs["publication"]["prNumber"]),
                "--base", inputs["base"], "--head", inputs["head"], "--checklist", str(status_path),
            ]), api)
    elif not state_path.exists():
        save(state_path, {"repo": inputs["publication"]["repository"], "pr": inputs["publication"]["prNumber"],
                          "base": inputs["base"], "head": inputs["head"], "run_id": inputs["runId"], "comments": {}, "status": "reviewing", "checklist": status_path.read_text()})
    arguments = ["--state", str(state_path)] + (["--dry-run"] if mode == "dry-run" else []) + [
        "finish", "--summary", str(root / "summary.md"), "--report", str(root / "review-report.md"),
        "--inline", str(root / "inline.json"), "--approval", str(root / "approval.json"), "--checklist", str(status_path),
    ]
    response = module.run(module.parser().parse_args(arguments), api)
    if mode == "dry-run":
        save(root / "publication-preview.json", response)
        # Preview verification uses the same checklist that the helper digested.
        state = json.loads(state_path.read_text())
        state["checklist"] = status_path.read_text()
        save(state_path, state)
        result["publication"] = {"mode": mode, "status": "rendered"}
        save(root / "result.json", result)
    receipt = verify(path, api)
    if mode == "github":
        result["publication"] = {"mode": mode, **receipt}
        save(root / "result.json", result)
    return receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=["progress", "finish", "verify"])
    parser.add_argument("bundle", type=Path, nargs="?")
    parser.add_argument("--input")
    parser.add_argument("--states")
    args = parser.parse_args()
    try:
        if args.operation == "progress":
            receipt = progress(json.loads(args.input), json.loads(args.states))
        else:
            require(args.bundle is not None, "A saved bundle path is required")
            receipt = finish(args.bundle) if args.operation == "finish" else verify(args.bundle)
        print(json.dumps(receipt))
    except (ValueError, KeyError, TypeError, OSError, RuntimeError, subprocess.TimeoutExpired) as error:
        if args.operation == "finish" and args.bundle and (args.bundle.parent / "result.json").is_file():
            result = json.loads((args.bundle.parent / "result.json").read_text())
            result["publication"] = {"mode": result["publication"]["mode"], "status": "failed", "reason": str(error), "inspectBeforeRetry": True}
            save(args.bundle.parent / "result.json", result)
        parser.exit(1, f"Review publication not confirmed: {error}\n")


if __name__ == "__main__":
    main()
