# Finding severity

| Severity | Use for | Action |
| --- | --- | --- |
| P0 | Show-stopping failure: broken behaviour, a blocking performance problem, a leak, or a crash | Request changes when submission is authorised |
| P1 | Wrong success-path behaviour, expensive work repeating after success, or an approach needing substantial revision | Address; a feature flag may limit impact |
| P2 | Potential issues, rare edge cases, and unlikely retries | Recommend or ask a focused question |

- Cheap retries such as settling or status checks are not P1. Rare encode loops on empty/error paths remain P2; verify that expensive work actually repeats after success before assigning P1.
- When safety depends on current callers, resolution, or data rather than a contract guarantee, raise a short P2 question naming the alternative. Do not drop it merely because today's path is safe.
- Keep confirmed failures distinct from questions. Put P0 and P1 findings needing correction in Required fixes; reserve Suggestions for non-blocking recommendations. Put purely aesthetic preferences in a separate Nits section. Do not praise or invent findings for clean files.
- Keep severity, evidence and assessment explicit in the saved report. Preserve impact and certainty in conversational comments without forcing a priority prefix. Honour caller-supplied severity conventions where they differ.
