---
name: writing-pull-request-description
description: Write or revise a pull request description from the diff and task context. Use when drafting a PR body or updating it after scope changes.
---

# Write a pull request description

Help a reviewer understand why the change is needed, get a high-level view of what changed and decide where to focus before opening the diff.

## Prepare

- Inspect the diff against the target branch, relevant code and task context. Don’t summarise from commit messages alone.
- Describe the final change. Replace stale descriptions when scope changes.
- Follow the repository’s required template, fitting the guidance below into it.
- Write for someone who hasn’t read the conversation. Link issues or related PRs when they explain the problem or a dependency.

## Make the description scannable

**Do:** Use actual Markdown headings and focused lists for multi-part changes. Default to the structure below, not an essay describing these topics in order.
**Don’t:** Treat concision as a reason to remove structure or pack several concerns into one paragraph or bullet.

- Open with one or two sentences describing the outcome. Don’t lead with branch logistics or internal symbol names.
- Use `## Why` to explain the previous limitation and why it matters. Keep it to a short paragraph or a few bullets. Explain why this approach helps when that isn’t obvious.
- Use `## What changed` for a short list of meaningful changes. Plain bullets are fine. Add bold labels only when they help scanning, and use concrete actions rather than technical category names. Keep each bullet to one idea and usually one or two sentences.
- Add `## Example` when code, before-and-after behaviour, a screenshot or an interaction sequence explains the change better than prose. Put it next to the changes it illustrates.
- Add `## Validation` only when meaningful checks remain before merging or releasing. Use unchecked checkboxes naming the affected route or workflow, concrete actions and expected behaviour. Derive checks from the diff and known gaps, not invented routes or generic checklists. Don’t fill this section with completed test, build or lint results, or “no checks run” statements. Omit it entirely when there’s nothing useful to do next.
- Add `## Risks and limitations` or `## Migration` only for concrete concerns, trade-offs or required actions. Don’t invent risks or add a “no risks identified” section.
- Put a required predecessor PR or other review-blocking dependency near the top, not in a closing paragraph. Explain what it supplies.

For a genuinely small, single-purpose change, an opening sentence and a few change bullets can be enough. Don’t add empty sections or repeat the opening just to fill `Why`.

## Choose reviewer-level detail

**Do:** Explain observable behaviour and the important choices a reviewer needs to assess.
**Don’t:** Narrate the diff, list every file or catalogue every internal safeguard.

- Group related implementation work under its effect. For example, explain that retries don’t send another message before naming receipt storage or reservation checks.
- Keep rationale with the change it explains. Don’t repeat it across the opening, `Why` and every change bullet.
- Keep concrete limitations visible, such as live delivery not being tested or a guarantee ending after a restart.
- Omit development history, unrelated prototype results, agent-review endorsements and inventories of unchanged areas.
- Split dense bullets rather than hiding a wall of text inside a list. Use numbered lists for sequences and tables only for genuine comparisons.

## Use everyday English

**Do:** Explain the change as you would to a colleague: what happens, when it happens and why that helps.
**Don’t:** Make the reviewer translate abstract labels or implementation terms before they can understand the behaviour. Structure alone doesn’t make technical prose readable.

- Prefer “keeps updating the same message after a restart” to “persistent identity”.
- Prefer “rejects conflicting updates” to “safe reservations”.
- Prefer “stops retries when we can’t tell whether the message sent” to “uncertain delivery”.
- Name the mechanism only when it helps the reviewer assess a choice. Keep precise API names in code, but explain their effect in normal words.
- Read the draft aloud. Replace wording that sounds like a specification or textbook, without adding slang or losing important limits.

## Show useful examples

**Do:** Show a small, realistic example when the PR changes how someone calls an API, configures a feature or uses a workflow.
**Don’t:** Replace a useful example with a paragraph of API names, or include code merely to decorate the description.

- Use language-tagged code fences and concrete inputs. Explain the expected result next to the example.
- Use before-and-after snippets when the difference is the point. Keep examples consistent with the actual code.
- Show consumer usage rather than implementation internals. For non-code changes, a short sample of the resulting output can be more useful.
- Include migration steps for breaking changes. Don’t invent an API or behaviour to make the description look complete.

## Example description

This illustrative API change shows the expected shape, not mandatory wording or facts to reuse:

````markdown
Adds a delivery key so callers can retry a notification without sending the same message twice.

## Why

A caller can time out after a message has already been sent. Retrying currently sends another copy because the service can’t recognise the earlier request.

## What changed

- Callers can give each notification a delivery key. Reusing it returns the previous result instead of sending another message.
- Saves completed sends so retrying after a restart still won’t send a duplicate.
- If a message might have sent, stops retries until someone checks what happened rather than risking another copy.

## Example

Reuse the same key when retrying the same notification:

```ts
await notifications.send({
  deliveryKey: 'report-123-ready',
  channel: 'engineering',
  text: 'Report 123 is ready',
});
```

A retry with this key returns the original receipt.

## Validation

- [ ] Using a live transport, send a notification, restart the service with the same database, then retry with the same delivery key. Confirm only one message exists and the original receipt is returned.
````

## Check before returning

- Can a reviewer find the reason, main changes and any outstanding validation by scanning headings and bullets?
- Does every validation item tell someone what to do next and what result to expect? If no meaningful checks remain, omit the section.
- Does each paragraph or bullet cover one idea, without forcing the reviewer to extract a list from prose?
- Can the reviewer picture what happens without decoding technical labels? Replace abstract nouns with actions and consequences.
- Are examples, behaviour claims and proposed validation steps grounded in the diff or task evidence?
- Is any detail repeated or only useful as an inline review comment? Cut or move it.
- Return the description as Markdown. Publish or update a PR only when requested.
