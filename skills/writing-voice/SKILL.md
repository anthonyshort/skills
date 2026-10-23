---
name: writing-voice
description: Draft comments, messages, and replies in anthonyshort's voice when asked to write as him. Applies across reviews and other conversations.
---

# Writing voice

## Goal

Draft concise replies in Anthony's voice while preserving evidence, uncertainty, and the intended meaning.

## Checklist

Track checks in task notes, not here. Mark done only after verifying; explain N/A and report blocked or unverified checks. Run independent checks in parallel where useful.

**Context and tone**

- [ ] **Message context** - Identify the recipient, context, and intended point.
- [ ] **Main point** - Name the concern and suggested direction directly.
- [ ] **No filler** - Remove corporate phrasing, bot introductions, and praise.
- [ ] **Useful detail** - Keep replies short; retain detail needed to understand or act.
- [ ] **Plain English** - Use short sentences and familiar words; explain the user-visible effect before technical details.
- [ ] **Sentence case** - Capitalise sentence starts and “I”. Keep the tone conversational without chat shorthand.
- [ ] **Readable structure** - Use lists for multiple points, conditions or results. Do not join clauses with semicolons.
- [ ] **Emoji** - Use sparingly when the conversation supports it.

**Meaning and certainty**

- [ ] **Preferences** - Use questions and first-person wording where natural.
- [ ] **Uncertainty** - Hedge uncertainty without weakening confirmed failures.
- [ ] **Evidence and severity** - Preserve the assessment's evidence and severity.
- [ ] **Personal knowledge** - Do not invent knowledge or agreement.

**Review comments**

- [ ] **Conversational voice** - Use a short, natural question or direct request with the concrete consequence; keep report detail in the report.
- [ ] **Blocking findings** - State what needs to change and its consequence.
- [ ] **Advisory findings** - Keep suggestions optional in tone.
- [ ] **Optional nits** - Use “Nit:” only for non-blocking findings.
- [ ] **Unresolved findings** - State what still needs checking.
- [ ] **Supported judgement** - Approve, agree, or defer only when the assessment supports it.
- [ ] **Own-work notes** - Use brief factual wording.
- [ ] **GitHub review attribution** - Use `🤖 Reviewed {commit}` for the review header. Do not append attribution footers to review bodies, comments or replies.

**Drafting boundary**

- [ ] **Drafting boundary** - Do not send or publish without separate authorisation.

## Guidance

### Context and tone

- Lead with the concern and suggested direction. Remove setup or background that does not help the recipient act.
- Use plain English and one idea per sentence. Name the action, its effect and the suggested fix. Prefer “reopen the panel” and “keeps the zoom” over “loader remount” and “retained view range”. Include identifiers or lifecycle terms only when the recipient needs them to locate or fix the problem; the inline anchor already identifies the code. Keep full technical evidence in the report.
- Use detail to explain architectural consequences, concrete proposals, product wording, or necessary history; omit ceremonial introductions and praise.
- Use normal sentence case, including sentence starts and “I”. Keep wording conversational without imitating chat shorthand.
- Use lists for multiple points, conditions or results. Use separate sentences instead of semicolon joins.
- Use familiar words such as “kill”, “a bit”, and “jank” only when they fit; do not force catchphrases.

### Meaning and certainty

- Frame preferences as questions rather than requirements. First-person phrasing can fit: “I think”, “I'd prefer”, “wonder if”.
- Hedge uncertainty or preference, not a confirmed failure.
- Preserve evidence, uncertainty, and severity; do not invent personal knowledge or agreement.
- Match the register to the assessment; do not turn advice into a blocker through wording.

### Review comments

- Write like a conversation with the author: a short question or request, then the concrete consequence they need to understand. Use normal sentence case. Keep evidence and priority in the saved report; retain enough impact and certainty in the comment to make the concern clear.
- Skip bot introductions, attribution prefixes, checklist/report boilerplate and rule citations. Include a policy link only when the author needs it to act or understand the requirement.
- Translate internal mechanics into a concrete example. Prefer “moving one panel rebuilds the others” to “placement replaces unrelated store identities”. Keep exact API names in code or evidence when needed.
- Read the comment as a message to a colleague. Cut wording that sounds like a report, such as “source-backed concern”, “preparatory read refusal” or “bounded source visibility”. State uncertainty plainly: “I haven't tested this in the browser.”

| Intent | Wording |
| --- | --- |
| Blocking | “needs to”, followed by the consequence |
| Advisory | “I wonder if”, “It might be worth”, or a specific question |
| Optional | `Nit:` prefix |
| Unresolved | State what still needs checking |
| Agreement | “Same here” or “Also this” in an existing thread |

- For notes on your own work, focus on the factual outcome and omit conversational framing.

### Plain-English examples

Explain the problem before naming the mechanism. Keep the same facts and certainty.

| Avoid | Prefer |
| --- | --- |
| Placement replaces unrelated store identities. | Can we leave the other panels alone? Moving one panel currently rebuilds all of them and resets their local state. |
| The reconciliation path loses configuration identity. | Can we keep the saved colours here? Editing this replaces the existing cells and drops their formatting. |
| Preparatory read failures enter the uncertain-mutation path. | This can fail before anything is copied, but the error says a draft might have been created. Can we handle that read separately? |
| The scope requires independent verification boundaries. | Please split this into smaller PRs. Chart editing and template publishing need different checks and can be reviewed separately. |

Example review comment:

```markdown
Can we keep the existing panel here? Replacing it resets the editor and drops any unsaved typing.
```

### Drafting boundary

- Drafting in this voice does not authorise sending or publishing.
