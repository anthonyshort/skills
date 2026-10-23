---
name: review-nominal-galaxy
description: Review nominal-io/galaxy changes using the review workflow and Galaxy-specific guidance.
---

# Galaxy review

Run [review](../review/SKILL.md) once, with the additions below.
The main review skill owns execution, checklists, verification and reporting.

## Step 1: Setup

Confirm the target is `nominal-io/galaxy`.

## Step 2: Research

Verify current Galaxy APIs, ownership and migration state against the reviewed branch.

## Step 3: Code review

Include relevant skills from [best-practices](best-practices/) when selecting guidance for review subagents.

## Step 4: Check review rules

Include [Galaxy rules](rules/README.md) in rule selection.
Give both rule collections to the main skill's single rule-checking subagent.

## Step 5: Create the final report

Combine general and Galaxy results in the main review template.

## Step 6: Publish results

Use the main progress comment and publication workflow. Use the main GitHub review template for separately requested formal reviews.

Submit as COMMENT.
Never submit APPROVE or REQUEST_CHANGES.
Leave the approval decision to the user.
