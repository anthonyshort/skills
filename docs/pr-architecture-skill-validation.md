# PR architecture walkthrough first draft validation

Validated on 29 October 2026. The first draft produces Markdown with Mermaid and supports unattended preparation. An initial local trial and one real PR walkthrough are complete. Assignment automation remains future work.

## Structural checks

- The skill-creator `quick_validate.py` check passed for `skills/pr-architecture-walkthrough`.
- `git diff --check` passed. New Markdown files were also checked against `/dev/null` because they were untracked.
- README, design-outline and skill-template links resolve.
- All 25 skill frontmatter names and folder names are unique.
- Running `scripts/link.py --home <temporary-directory>` created resolving links to the new skill and its template in both `.agents/skills` and `.claude/skills`. Live installation links were not changed.

## Independent behavioural trial

An independent read-only agent received the skill, its output guide and a temporary Git repository containing a three-change local stack. It received no expected conclusions, parent research or design explanation. The parent created the fixture and assessed the returned brief against the source.

The fixture lives at `/tmp/pr-architecture-trial-9fuc_ugi/repo`, with raw scope metadata at `/tmp/pr-architecture-trial-9fuc_ugi/context.json`. These are temporary evaluation artefacts.

| Stage | Commit | Observed in the returned brief |
| --- | --- | --- |
| Baseline | `9c23e1438674adb4548fd32f355406d78b9d5cba` | Explained the unchanged preview entry point and original report formatting. |
| First change | `4ad28cd32e26bb8b15bc3a377fee69be4d80f292` | Identified the new row contract and adapter as introduced but unconnected to preview. |
| Second change | `85b06d2320ec69c3bc25eed5ab5557576e1df650` | Identified the point where report preview calls the new path. |
| Third change | `c53ac4a30a6e05b2885135af4b7eaa13f3a48eba` | Explained mapping moving beside its caller and the temporary adapter disappearing. |

The agent inspected individual and cumulative comparisons and returned a self-contained Markdown brief without asking questions. It included comparable baseline/final Mermaid diagrams, a concrete input/output example, exact revisions, stage-by-stage attribution and an ordered source-reading path. It distinguished inferred motivation from source facts and noted that the generic formatter had only one observed caller. Those claims match the fixture.

One useful excerpt from the returned explanation was: “The temporary `toRows` module matters when reviewing the individual PRs: it is introduced by local-1, activated by local-2 and removed by local-3. It disappears entirely from the cumulative diff.”

## Limits and next trials

The fixture is small and local. It does not establish performance on large repositories, remote PR metadata, branching stacks, missing dependencies, revised PRs or assignment-triggered execution. Mermaid was not rendered because an existing renderer was unavailable. No implementation tests were run, and the brief did not claim otherwise.

Next, use real PRs to tune background depth, diagram usefulness, length and reading order. Include a single PR, a structural refactor and a stack if available. Build assignment automation after the user finds the output useful.

## First real PR trial

At the user’s request, searched GitHub directly for open Galaxy PRs assigned to or requesting review from `anthonyshort`. Selected [#20229](https://github.com/nominal-io/galaxy/pull/20229), which requests the user’s review and changes 170 files with 2,095 additions and 3,171 deletions. It is a review request, rather than an issue-assignee assignment.

The [saved walkthrough](trials/galaxy-pr-20229-walkthrough.md) compares effective base `377bded2d4be26d136a1424cd4bb71092c429e8d` with head `caf60ed5d2a2af5a2057c5b23be54cc2f5879b25`. Source research used the pinned Git objects, GitHub metadata and discussion. Two read-only agents investigated compute/chart contracts and workbook boundaries, and the parent checked key claims and saved the synthesis.

The brief includes three Mermaid diagrams, a concrete before/after example, the remaining URL and saved-time boundaries, the bucket-anchor migration trade-off, follow-up PR context and a source-reading path. All 27 source links resolve to the inspected commits and valid line anchors. All 40 reference-link uses resolve. The PR remained open with unchanged base and head when rechecked before delivery.

The first version produced about 1,800 words, excluding link definitions. Mermaid rendering was not checked because no installed renderer was available. Local implementation tests and browser checks were not run. Existing failing CI checks are identified without claiming their causes were investigated. No GitHub comments, reviews or implementation changes were made.

## Readability revision after user feedback

The user found the first real brief too dense for reviewing many PRs each day. They asked for simpler English, shorter sentences, more bullets and a faster explanation of the problem and design.

Updated the skill and output guide to favour that style. The main brief now has a rough 500–800 word guide, with shorter output for small changes. Preparation metadata goes at the end. Technical names, exceptions and evidence lists must earn their place.

Rewrote the same PR brief to about 730 words. It keeps two small before/after diagrams, a concrete example, the URL conversion boundary and migration trade-off. It uses short bullets in place of dense tables and paragraphs. An independent read-only editorial pass found no remaining concrete readability problems or inconsistent guidance. This checks the revised example and instructions, rather than proving future generated briefs will follow them. No new source investigation or runtime validation was performed for the rewrite.

The user approved this revision as exactly the output they wanted. Its reading order is now explicit in the output guide: what changes, why it matters, before, after, effects elsewhere, important details, code-reading path and source snapshot. Headings remain adaptable. The skill does not require a fixed number of sections, diagrams or exceptions.

The user then suggested grouping important changed files by what they do together. Added guidance for a selective file map with purpose-based labels, short explanations and source links. It can be combined with the reading path to avoid repetition. The user also clarified that the structure must remain an example: the agent is free to add, edit, reorder, combine or remove sections that help the reviewer. Both the skill and output guide now say this explicitly.

## Remove the suggested outline

After the Picco trial, the user preferred the output from before the suggested structure was added. Removed the output guide and its example headings. The skill now explicitly leaves headings, order and document shape to the agent. It retains the approved plain-English style, small diagrams, source evidence and optional grouped file pointers. No existing walkthrough or GitHub comment was rewritten as part of this change.
