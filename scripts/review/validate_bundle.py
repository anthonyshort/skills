#!/usr/bin/env python3
"""Validate a saved review bundle without making remote publication claims."""

import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys


ASSESSMENTS = {"product", "system-fit", "simplicity", "readability", "correctness"}
REVIEW_STAGES = ASSESSMENTS | {"setup", "research", "rules", "consolidation", "draft", "editorial", "report"}
FULL_STAGES = REVIEW_STAGES | {"decision"}
FULL_HEADINGS = {"Assessment", "Risk and scope", "Findings", "Verification summary", "References", "Supporting details"}
SPLIT_HEADINGS = {"Assessment", "Risk and scope", "Split plan", "CI status"}


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def fingerprint(text):
    """Match the workflow's UTF-16 integrity check, including non-BMP text."""
    encoded = text.encode("utf-16-le")
    first, second = 2166136261, 3339675911
    for index in range(0, len(encoded), 2):
        code = encoded[index] | encoded[index + 1] << 8
        first = ((first ^ code) * 16777619) & 0xFFFFFFFF
        second = ((second ^ code) * 16777619) & 0xFFFFFFFF
    return f"{first:08x}{second:08x}"


def indexed_rules(inputs):
    paths = []
    for root in [inputs["skillRoot"], *inputs.get("wrapperSkillRoots", [])]:
        directory = Path(root).resolve() / "rules"
        index = directory / "README.md"
        require(index.is_file(), f"Missing supplied rule index: {index}")
        for target in re.findall(r"\[[^\]]+\]\(([^)#]+\.md)(?:#[^)]*)?\)", index.read_text()):
            path = (directory / target).resolve()
            require(path.is_relative_to(directory.resolve()), f"Rule escapes its collection: {path}")
            require(path.is_file(), f"Indexed rule is missing: {path}")
            paths.append(str(path))
    require(len(paths) == len(set(paths)), "Rule indexes contain duplicate rule paths")
    return set(paths)


def read_artifact(root, name):
    path = root / name
    require(not path.is_symlink() and path.resolve().is_relative_to(root), f"Artefact escapes directory: {name}")
    require(path.is_file(), f"Missing artefact: {name}")
    return path.read_text(encoding="utf-8")


def json_artifact(root, name):
    return json.loads(read_artifact(root, name))


def diff_counts(inputs):
    for key in ("base", "head"):
        require(re.fullmatch(r"(?:[a-f0-9]{40}|[a-f0-9]{64})", inputs[key]), f"Invalid pinned revision: {key}")

    def git(*arguments):
        result = subprocess.run(
            ["git", "-c", "core.fsmonitor=false", *arguments], cwd=inputs["repository"],
            capture_output=True, text=True, timeout=30, check=False,
        )
        require(result.returncode == 0, f"Cannot inspect pinned checkout: {result.stderr.strip()}")
        return result.stdout.strip()

    require(git("rev-parse", "HEAD") == inputs["head"], "Checkout HEAD differs from reviewed head")
    require(not git("status", "--porcelain", "--untracked-files=normal"), "Reviewed checkout contains uncommitted changes")
    added, deleted = 0, 0
    for line in git("diff", "--no-ext-diff", "--no-textconv", "--numstat", inputs["base"], inputs["head"], "--").splitlines():
        values = line.split("\t", 2)
        require(len(values) == 3, "Unexpected git diff statistics")
        if values[0] != "-":
            added += int(values[0])
            deleted += int(values[1])
    return added, deleted


def validate_report(stages, status):
    if status == "split":
        require(stages["setup"]["mode"] == "split", "Split setup mode mismatch")
        canonical = stages["split-plan"]["markdown"]
        headings = SPLIT_HEADINGS
    else:
        require(stages["setup"]["mode"] == "full", "Full review setup mode mismatch")
        canonical = stages["report"]["markdown"]
        headings = FULL_HEADINGS
        for name, result in stages.items():
            if name == "decision":
                continue
            for check in result["checks"]:
                require(check["item"] in canonical and check["guidance"] in canonical, "Final report lost individual check coverage")
            for gap in result["gaps"]:
                require(gap in canonical, "Final report lost an evidence gap")
        for item in stages["rules"]["rules"]:
            require(item["path"] in canonical, "Final report lost a rule result")
        expected_findings = {
            f"{name}:{item['id']}" for name, result in stages.items()
            if name not in {"report", "decision"} for item in result["findings"]
        }
        decisions = stages["report"]["decisions"]
        require(len(decisions) == len(expected_findings) and {item["sourceId"] for item in decisions} == expected_findings, "Final report lost finding decisions")
        for item in decisions:
            if item["disposition"] in {"retained", "merged"}:
                require(item["reportId"] and item["reportId"] in canonical, "Retained finding is absent from report")
    actual_headings = set(re.findall(r"^#{1,6}\s+(.+?)\s*$", canonical, re.MULTILINE))
    require(headings <= actual_headings, f"Report is missing required sections: {', '.join(sorted(headings - actual_headings))}")
    return canonical


def validate_decision(root, inputs, stages, status):
    decision = stages["decision"]
    approval = json_artifact(root, "approval.json")
    require(approval == decision["approval"], "Saved approval differs from accepted decision")
    require(read_artifact(root, "summary.md") == decision["summaryMarkdown"], "Saved summary differs from accepted decision")
    inline = json_artifact(root, "inline.json")
    require(inline == decision["inlineComments"], "Saved inline findings differ from accepted decision")
    require(isinstance(inline, list), "Inline findings must be an array")
    # Use the skill's existing approval rules rather than duplicating its schema.
    helper_path = Path(inputs["skillRoot"]) / "scripts/github_approval.py"
    specification = importlib.util.spec_from_file_location("review_bundle_approval", helper_path)
    require(specification and specification.loader, "Approval validator is unavailable")
    module = importlib.util.module_from_spec(specification)
    sys.dont_write_bytecode = True
    specification.loader.exec_module(module)
    module.read_decision(root / "approval.json")
    setup = stages["setup"]
    require(approval["changed_lines"] == setup["addedLines"] + setup["deletedLines"], "Approval line count differs from pinned diff")
    require((approval["outcome"] == "split") == (status == "split"), "Approval outcome differs from review scope")
    require(not decision.get("findings"), "Publication decision introduced findings after report acceptance")
    if status == "split":
        require(not inline, "Split-only output cannot contain inline implementation findings")
    if inline and approval["checks"]:
        require(approval["checks"]["clean_review"]["result"] != "Pass", "Clean review cannot contain inline bug findings")
    ids = set()
    for item in inline:
        require(isinstance(item, dict) and set(item) == {"id", "path", "line", "side", "body"}, "Invalid inline finding fields")
        require(all(isinstance(item[key], str) and item[key].strip() for key in ("id", "path", "body")), "Empty inline finding field")
        require(item["id"] not in ids and type(item["line"]) is int and item["line"] > 0 and item["side"] in {"LEFT", "RIGHT"}, "Invalid inline ID, line or side")
        require(item["id"] in stages["report"]["markdown"], "Inline finding ID is absent from final report")
        ids.add(item["id"])


def publication_digest(stages, checklist):
    payload = {
        "summary": stages["decision"]["summaryMarkdown"],
        "report": (stages.get("report") or stages["split-plan"])["markdown"],
        "inline": stages["decision"]["inlineComments"], "checklist": checklist,
        "approval": stages["decision"]["approval"],
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


def validate_result(root, bundle, expected_fingerprint):
    inputs, stages, status = bundle["input"], bundle["stages"], bundle["status"]
    result = json_artifact(root, "result.json")
    for key in ("status", "runId", "invocationId", "base", "head"):
        require(result.get(key) == (status if key == "status" else inputs[key]), f"Result identity mismatch: {key}")
    require(result.get("fingerprint") == expected_fingerprint, "Result fingerprint mismatch")
    require(result.get("bundlePath") == str(root / "bundle.json"), "Result bundle path mismatch")
    require(result.get("reportPath") == (None if status == "incomplete" else str(root / "review-report.md")), "Result report path mismatch")
    publication = result["publication"]
    mode = inputs["publication"]["mode"]
    require(mode in {"local", "dry-run", "github"} and publication["mode"] == mode, "Publication mode mismatch")
    allowed = {"not_requested", "failed"} if status == "incomplete" else {
        "local": {"not_requested"}, "dry-run": {"pending", "rendered", "failed"}, "github": {"pending", "confirmed", "failed"},
    }[mode]
    require(publication.get("status") in allowed, "Publication status is incompatible with review completion")
    require(not result.get("published") or publication.get("status") == "confirmed", "Result claims publication without confirmation")
    require(status != "incomplete" or not result.get("readyForParent"), "Incomplete review cannot claim publication readiness")
    if publication["status"] == "rendered":
        preview = json_artifact(root, "publication-preview.json")
        require(preview.get("dry_run") is True and isinstance(preview.get("body"), str) and bool(preview["body"].strip()), "Invalid publication preview")
        require(preview.get("inline") == stages["decision"]["inlineComments"] and preview.get("approval_decision") == stages["decision"]["approval"], "Preview differs from accepted decision")
        require(bool(re.fullmatch(r"[a-f0-9]{64}", preview.get("publication_digest", ""))), "Preview lacks frozen publication digest")
    if publication["status"] == "confirmed":
        # Remote confirmation is performed separately by the publication helper.
        progress = json_artifact(root, "progress.json")
        for key, expected in {
            "repo": inputs["publication"]["repository"], "pr": inputs["publication"]["prNumber"], "base": inputs["base"], "head": inputs["head"],
        }.items():
            require(progress.get(key) == expected, f"Publication receipt identity mismatch: {key}")
        require(progress.get("status") == "complete", "Publication receipt is incomplete")
        require(progress.get("approval_decision") == stages["decision"]["approval"], "Publication receipt decision mismatch")
        require(progress.get("publication_digest") == publication_digest(stages, progress["checklist"]), "Publication frozen inputs differ from accepted artefacts")
        comment = progress["comments"]["main"]
        require(type(comment.get("id")) is int and comment["id"] > 0 and isinstance(comment.get("html_url"), str), "Publication receipt lacks a confirmed comment")
        if stages["decision"]["approval"]["outcome"] == "approve":
            require(progress.get("approval", {}).get("status") == "approved", "Approval receipt is not confirmed")
        if stages["decision"]["inlineComments"]:
            require(type(progress.get("inline_review", {}).get("id")) is int, "Inline review receipt is missing")
    return result


def validate(path, expected_fingerprint):
    require(not path.is_symlink(), "bundle.json must not be a symlink")
    raw = path.read_text(encoding="utf-8").strip()
    require(fingerprint(raw) == expected_fingerprint, "Saved bundle differs from accepted workflow output")
    bundle = json.loads(raw)
    require(bundle["version"] == 1, "Unsupported bundle version")
    inputs, stages, status = bundle["input"], bundle["stages"], bundle["status"]
    root = Path(inputs["artifacts"]).resolve()
    require(path.resolve() == root / "bundle.json", "Bundle is outside the selected artefact directory")
    require(status in {"complete", "split", "incomplete"}, "Unknown workflow status")
    require(bool(bundle["failures"]) == (status == "incomplete"), "Failures and completion status disagree")
    require(set(stages) <= FULL_STAGES | {"split-plan"}, "Unexpected review stage")
    for name, result in stages.items():
        require(result["stage"] == name, f"Stage identity mismatch: {name}")
        require(result["base"] == inputs["base"] and result["head"] == inputs["head"], f"Revision mismatch: {name}")
        require(read_artifact(root, f"{name}.md") == result["markdown"], f"Saved assessment differs: {name}")
        require(not re.search(r"\{\{[^}]+\}\}", result["markdown"]), f"Unfilled template: {name}")
    if "setup" in stages:
        setup = stages["setup"]
        expected_rules = indexed_rules(inputs)
        require(set(setup["rulePaths"]) == expected_rules and len(setup["rulePaths"]) == len(expected_rules), "Setup rule inventory differs from supplied indexes")
        require(setup["addedLines"] <= 2000 or setup["mode"] == "split" or bool(setup["sizeException"]), "Oversized review lacks an exception")
        require((setup["addedLines"], setup["deletedLines"]) == diff_counts(inputs), "Setup counts do not match the complete pinned diff")
    if status == "incomplete":
        require(read_artifact(root, "incomplete.md").strip(), "Incomplete output needs a failure explanation")
        validate_result(root, bundle, expected_fingerprint)
        return bundle
    require(set(stages) == (FULL_STAGES if status == "complete" else {"setup", "split-plan", "decision"}), "Review has missing or unexpected stages")
    if status == "complete":
        rules = stages["rules"]["rules"]
        require(len(rules) == len(expected_rules) and {item["path"] for item in rules} == expected_rules, "Rule coverage is incomplete or duplicated")
    canonical = validate_report(stages, status)
    require(read_artifact(root, "review-report.md") == canonical, "Canonical report differs from accepted result")
    validate_decision(root, inputs, stages, status)
    validate_result(root, bundle, expected_fingerprint)
    return bundle


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", type=Path)
    parser.add_argument("--fingerprint", required=True)
    args = parser.parse_args()
    try:
        bundle = validate(args.bundle, args.fingerprint)
    except (ValueError, KeyError, TypeError, AttributeError, OSError, subprocess.TimeoutExpired) as error:
        parser.exit(1, f"Review artefact validation failed: {error}\n")
    print(json.dumps({"status": bundle["status"], "head": bundle["input"]["head"], "validated": True, "remotePublicationVerified": False}))


if __name__ == "__main__":
    main()
