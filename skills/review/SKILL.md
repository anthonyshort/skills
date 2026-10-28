---
name: review
description: Review a PR, branch, diff, or codebase across product, direction, design and correctness. Automatically research context, select guidance, delegate concerns and synthesise evidence-backed findings.
---

# Review

You are the reviewer for a code change. You will do research on the background behind the code and then perform a review of the code using subagents, skills, and reference files.

The output is a report that evaluates the change against a few different metrics.

## Goals

- The change solves the right problem.
- The change fits the intended long-term architectural direction.
- The change is the simplest and smallest change to solve the problem.
- The change has simple, elegant, and consistent APIs.
- The code is clear and easy to maintain.
- The change works correctly.
- The change has a clear scope, understood risks and a practical way to verify it.

## Rules

- Use this skill, its rules and relevant specialist skills as the review criteria. Do not add checks from repository review guides or style documents.
- Use repository documents to understand intent, behaviour and architecture. Treat them as context, not additional review checklists.
- Follow operational instructions needed to access the code and CI evidence, along with any instructions required by the agent environment.

- Do not perform code changes.
- Only mark checklist items done after verifying.
- Explain any N/A or blocked checks.
- Separate current behaviour, accepted conventions, personal preferences and future direction.
- Reading guidance or checklists alone does not complete checks.
- Do not invent product requirements or require speculative future migrations.
- Provide evidence for each claim of correctness and completion.
- Use existing checkouts, Git objects and installed tools.
- Do not install dependencies or tools. Do not run local builds, tests, linters, formatters or typechecks.
- Use CI for automated results. This applies to workers and specialist guidance too. Do not trigger jobs.
- Do not create runtime test harnesses or start local services. Use an existing deployment for manual checks.

## Deliverable

- Saved review report with findings, research and an assessment.
- For PR reviews, a live progress comment, final results and verified new inline bugs unless the user requests a local-only review.

## Execution mode

Use the standalone steps below by default. This skill does not require pi-subagents or a saved workflow.

Only use an external workflow when the caller explicitly supplies its script and requests workflow execution. Read [the workflow contract](references/workflow.md) first. Do not discover, install, select or enable a workflow on the caller’s behalf. Keep wrappers and caller restrictions in either mode.

Delegated workers read this entry’s goals and rules, their assigned stage guidance and the supplied context. Return the assigned assessment. Do not restart the whole review or delegate the same stage again unless asked.

## How to perform a review

Read each reference before its stage. Preserve this order and the completion requirements in each reference. Apply wrapper additions to the matching numbered step.

### Step 1: Setup

Read [setup](references/setup.md). Pin the full reviewed revisions, choose full or split-only review and record the initial risks. For split-only reviews, follow that reference and continue directly to Step 6.

### Step 2: Research

Read [research](references/research.md). Validate earlier evidence under the re-review gate or delegate fresh research. Read and check the completed brief before starting code review.

### Step 3: Code review

Read [assessments](references/assessments.md). Assign the five review questions, including a separate readability pass. Independent assessments can run together after research.

### Step 4: Check review rules

Read [rules](references/rules.md). One agent checks every indexed rule sequentially across general and wrapper collections. Check the returned coverage against those indexes.

### Step 5: Create the final review report

Read [consolidation](references/consolidation.md), then [reporting](references/reporting.md). Check claims and coverage, resolve disagreements, write the self-contained report and validate the editorial edit.

### Step 6: Publish results

Read [publication](references/publication.md) before creating the initial PR progress comment, and again before final publication. The parent owns publication. Use the existing helper and maintain one live comment per run unless caller restrictions override publication. Refresh the relevant facts before publishing and report confirmation or incomplete publication.
