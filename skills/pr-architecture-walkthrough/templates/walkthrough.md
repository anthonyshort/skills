# Walkthrough output guide

Write for someone who needs to understand the PR before reviewing it. Use short sentences, short bullets and small Mermaid diagrams. Explain the problem and design first. Adapt these sections to the change, and omit anything that adds no useful context.

This is an example structure:

1. **Summary:** the change in a few plain-English sentences.
2. **Why:** the problem someone encounters and why it needs fixing.
3. **Before:** the existing flow, using short bullets and a small diagram.
4. **After:** the same flow with the change applied, followed by one concrete example.
5. **What this means elsewhere:** the few effects on other parts of the system that help explain the design.
6. **Details worth knowing or risks:** important trade-offs, exceptions or stack dependencies.
7. **Important changed files:** useful groups of files and what each group does together.
8. **Where to start:** a short reading path.
9. **Source snapshot:** revisions and preparation limits.

Choose the structure that helps the reviewer. Freely add, edit, reorder, combine or remove sections. Do not fill out headings just because they appear here. Add a diagram or example only when it helps. Let the reader understand the main design before introducing exceptions.

## Opening

Name the behaviour in the title. In a few sentences, explain the problem and what the PR does about it. Use words the reader can picture. Put an essential missing source or dependency here, but leave routine preparation details until the end.

Explain the problem from the user’s or caller’s point of view before describing the implementation. The opening should make sense without knowing internal class or method names.

## Before and after

Explain enough of the existing system to follow the change. Use a few bullets for the important responsibilities and steps. Show a small diagram where it helps.

Then follow the same action through the new design. Keep names and layouts comparable across diagrams. Explain who does what differently and why that solves the problem. Include one concrete example when it makes the change easier to grasp.

Keep the example’s inputs or user action the same before and after. This lets the reader see the design change without learning a second scenario. Distinguish behaviour that changes from behaviour the new design preserves.

Use component and method names only when they help the reader connect the explanation to the code. Place a few useful source links beside the explanation, without an evidence paragraph after every diagram.

When the change affects other parts of the system, use short labelled bullets to explain the consequences. Include the few that make the design clearer, rather than listing every changed caller.

## Details that affect the design

Pick the few trade-offs, temporary arrangements or exceptions the reviewer needs to know. Explain their consequences in short bullets. Keep stated intent and inferred reasons distinguishable. Do not turn this into a bug report or generic risk checklist.

For a stack, show the dependency order and give each PR a short explanation: what it adds, what it depends on and when the new behaviour starts working. A compact table can help, but avoid long paragraphs inside cells. Summarise follow-ups from their descriptions only when clearly labelled as such.

## Where to start in the code

Give a short ordered reading path. Link the few places that explain the design, and say what to look for in each. Do not repeat the full walkthrough here.

## Group important changed files

When a file map helps, group selected changed files by responsibility or part of the flow. Explain what each group does together in one short sentence, then link the relevant files. A group can span directories. For example: “These files read the settings and turn them into a data request.”

Use purpose-based labels such as “Load settings” or “Build the request”. Avoid grouping solely by file type or directory. Include only files that help the reviewer understand the change. Keep the groups short, and make clear that the list is selective.

The file map explains where the important work happens. The reading path suggests an order. Combine them when separate sections would repeat the same information. For a stack, identify which PR introduces a group when that helps explain the dependencies.

## Source snapshot

Put preparation metadata here: repository and PR links, preparation time, complete/partial status and exact compared commit IDs. Record per-PR comparisons for a stack. Use a small table if needed.

State material limits briefly, including unavailable sources, newer commits and whether diagrams were rendered. Distinguish tests read from checks actually run. Include CI details only when relevant. Do not imply that preparing the brief validates the implementation.
