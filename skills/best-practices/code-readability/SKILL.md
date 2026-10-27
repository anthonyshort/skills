---
name: code-readability
description: Write, refactor or review code for clear names, comments, control flow, function composition and file organisation. Use when improving how quickly people can understand and scan code.
---

# Code readability

Make code easy to understand and scan. Look for places where readers must infer meaning, remember hidden context or jump between files.

## Guidance

- **Names:** Functions describe actions. Variables and constants describe their meaning, units and role. Use consistent domain terms and positive boolean names. Flag vague names, misleading promises and unexplained abbreviations. Keep names proportionate to scope.
- **Comments:** Explain intent, constraints, surprising behaviour and non-obvious algorithms. Correct misleading comments. Prefer clearer code to comments that narrate it. Preserve useful existing comments.
- **Flow:** Keep the main path visible. Look for deep nesting, distant guards and interleaved cases. Prefer early exits where they clarify flow. Use braces for conditional bodies, including one-line guards, where the language supports them.
- **Branches:** Prefer a `switch` when several branches compare the same value against distinct cases. Keep ordered guards and unrelated predicates as conditionals. Do not change evaluation order or fallthrough behaviour for appearance.
- **Expressions:** Check dense boolean logic, nested ternaries, long chains and surprising constants. Use meaningful intermediate names or parentheses when they make the expression easier to read. Keep declarations near their uses and scopes small.
- **Functions:** Separate meaningful phases when that exposes the main flow or reduces the state readers track together. Name the operations and give them clear inputs and outputs. One caller can justify a helper, but trivial indirection can make reading harder.
- **Functional style:** In TypeScript and JavaScript, prefer small, named, module-level functions with explicit inputs and outputs. Keep calculations and transformations pure where practical, so orchestration reads as meaningful steps. Keep helpers private unless callers need them. Retain closures, local mutation or cohesive inline code when extraction adds more indirection than clarity.
- **Files and folders:** Can readers predict where code belongs and find related behaviour? Propose specific file boundaries for distinct responsibilities. Keep related code together and avoid needless nesting, generic dumping grounds and fragmented helpers. Length prompts inspection, not automatic splitting.
- **Visual grouping:** Group related statements and separate meaningful phases. Keep comparable cases consistent. Leave mechanical formatting to tooling and avoid unrelated formatting churn.

## How to judge

See the [functional-style example](references/functional-style.md) for useful extraction versus fragmentation.

Prefer changes that address a concrete reading difficulty. Preserve behaviour. A long cohesive mapping can stay together. A short, cryptic function can need improvement.

These are preferences, not universal rules. Adapt them to the language and surrounding code. Splitting code is useful only when it reduces reading effort.
