"""Validate approval assessments and render their public explanation."""

import json


CHECKS = {
    "focused": "Clear and focused",
    "low_risk": "Limited consequences",
    "no_sensitive_changes": "Avoids sensitive behaviour",
    "clean_review": "No required fixes",
    "complete_review": "Review finished",
    "verification": "Checks support the change",
    "concerns_resolved": "Earlier concerns resolved",
}
OUTCOMES = {
    "approve": "Checklist passed — approval not submitted",
    "human_review": "Human review needed",
    "changes_needed": "Fix these items and request another review",
    "waiting_checks": "Waiting for checks",
    "incomplete": "Review incomplete",
    "split": "Split this PR first",
    "not_submitted": "Checklist passed — approval not submitted",
}


def sentence(value):
    return isinstance(value, str) and bool(value.strip()) and "\n" not in value and "\r" not in value


def read_decision(path):
    """Validate the parent's answers without inferring code or CI safety."""
    if not path:
        return None
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict) or set(value) != {"outcome", "changed_lines", "checks", "reason", "next_steps"}:
        raise ValueError("Approval requires outcome, changed_lines, checks, reason and next_steps. Use the documented checklist schema.")
    outcome = value["outcome"]
    if not isinstance(outcome, str) or outcome not in OUTCOMES:
        raise ValueError("Unknown approval outcome.")
    if type(value["changed_lines"]) is not int or value["changed_lines"] < 0:
        raise ValueError("Approval changed_lines must be a non-negative integer.")
    if not sentence(value["reason"]):
        raise ValueError("Approval reason must be a non-empty single-line string.")
    steps = value["next_steps"]
    if not isinstance(steps, list) or any(not sentence(step) for step in steps):
        raise ValueError("Approval next_steps must be a list of non-empty single-line strings.")
    if outcome != "approve" and not steps:
        raise ValueError("A withheld approval requires a concrete next step and its owner.")
    checks = value["checks"]
    if outcome == "split":
        if checks is not None:
            raise ValueError("A split-only review must use checks: null. The approval checklist was not assessed.")
        return value
    if not isinstance(checks, dict) or set(checks) != set(CHECKS):
        raise ValueError("Approval requires a result and reason for all seven checklist items.")
    for check in checks.values():
        if (not isinstance(check, dict) or set(check) != {"result", "reason"}
                or check["result"] not in ("Pass", "Fail", "Not verified") or not sentence(check["reason"])):
            raise ValueError("Each approval check requires Pass, Fail or Not verified and a non-empty single-line reason.")
    passed = {key: item["result"] == "Pass" for key, item in checks.items()}
    if outcome in ("approve", "not_submitted") and not all(passed.values()):
        raise ValueError("A passing assessment requires every checklist item to pass.")
    if outcome == "incomplete" and passed["complete_review"]:
        raise ValueError("An incomplete review cannot mark Review finished as Pass.")
    if outcome == "waiting_checks" and (checks["verification"]["result"] != "Not verified"
            or not all(result for key, result in passed.items() if key != "verification")):
        raise ValueError("Waiting for checks requires every other item to pass and verification to be Not verified.")
    if outcome == "changes_needed":
        if not all(passed[key] for key in ("focused", "low_risk", "no_sensitive_changes", "complete_review")):
            raise ValueError("Fix-and-review guidance requires a completed, focused review with limited consequences and no sensitive changes.")
        if all(passed.values()):
            raise ValueError("Fix-and-review guidance requires a specific remaining checklist blocker.")
    if outcome != "human_review" and any(checks[key]["result"] == "Fail" for key in ("low_risk", "no_sensitive_changes")):
        raise ValueError("Known risk or sensitive-behaviour failures require human review.")
    return value


def decision_explanation(decision, confirmation=None):
    """Keep assessed content separate from the confirmed submission result."""
    outcome = decision["outcome"]
    reason = decision["reason"]
    steps = decision["next_steps"]
    label = OUTCOMES[outcome]
    if outcome == "approve":
        if confirmation and confirmation["status"] == "approved":
            label = "Approved"
            steps = []
        elif confirmation and confirmation["status"] == "withheld":
            label = OUTCOMES[confirmation.get("outcome", "not_submitted")]
            reason += " " + confirmation["reason"]
            steps = confirmation["next_steps"]
        else:
            reason += " GitHub has not confirmed approval; publication is incomplete."
            steps = ["The reviewer needs to inspect the saved submission before retrying; no author code change is requested."]
    return label, reason, steps


def render_next_steps(decision, confirmation=None):
    label, _, steps = decision_explanation(decision, confirmation)
    if label == "Approved":
        return "**Approved.**"
    if not steps:
        return ""
    return "#### Next steps\n\n" + "\n".join(f"{index}. {step}" for index, step in enumerate(steps, 1))


def render_decision(decision, head, confirmation=None):
    """Render the assessed reasons inside the full-report fold."""
    label, reason, _ = decision_explanation(decision, confirmation)
    body = f"#### Approval assessment\n\n**{label}.** {reason}\n\nReviewed commit: `{head[:7]}`."
    if decision["checks"] is None:
        body += "\n\n**Approval checklist:** Not assessed. The review stopped at the split plan."
    else:
        body += "\n\n| Check | Result | Why |\n| --- | --- | --- |"
        for key, name in CHECKS.items():
            check = decision["checks"][key]
            why = check["reason"].replace("|", "\\|")
            body += f"\n| {name} | {check['result']} | {why} |"
    return body
