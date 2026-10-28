/**
 * Assigns each worker a section of the review skill and checks its answer.
 * The workflow calls these guards before accepting a stage; persistence checks
 * repeat them against the saved bundle. No tools or filesystem access occur here.
 */
import { validateApproval } from "./approval.js";
export { validateApproval } from "./approval.js";
import { z } from "zod";
import { StageSchemas, assessmentNames } from "./contracts.js";
import type {
  ReviewInput,
  StageName,
  StageResult,
  StageResults,
} from "./contracts.js";

/**
 * The stage-to-skill map. Criteria remain in criteria.md; these instructions limit
 * each worker to its assigned part of the coordinator’s process.
 */
export const stageDefinitions = {
  setup: {
    group: "Setup",
    reference: "step-1-setup",
    instructions:
      "Read the full diff, count additions/deletions, apply the over-2,000-added-lines split policy, and enumerate every rule path from the main and wrapper rules/README.md indexes. Use absolute canonical paths. Record any permitted size exception.",
  },
  research: {
    group: "Research",
    reference: "step-2-research",
    instructions:
      "Complete fresh research or validate prior complete review evidence using the re-review gate. Missing external sources must be recorded, not invented.",
  },
  "research-check": {
    group: "Research",
    reference: "step-2-research",
    instructions:
      "Act as the parent accepting the research brief. Independently check its important claims against the cited sources, scope and current CI. Validate any reused prior research. Return a corrected self-contained brief with supported conclusions and remaining gaps for the assessments. Reading the brief alone does not complete this check. Do not repeat broad searches without a specific missing or stale source.",
  },
  product: {
    group: "Assessments",
    reference: "q-should-we-build-this",
    instructions: "",
  },
  "system-fit": {
    group: "Assessments",
    reference: "q-does-this-code-fit-into-the-existing-system",
    instructions: "",
  },
  simplicity: {
    group: "Assessments",
    reference: "q-is-this-the-simplest-solution",
    instructions: "",
  },
  readability: {
    group: "Assessments",
    reference: "q-is-this-code-clear-and-easy-to-maintain",
    instructions: "",
  },
  correctness: {
    group: "Assessments",
    reference: "q-is-this-implementation-correct",
    instructions: "",
  },
  rules: {
    group: "Rules",
    reference: "step-4-check-review-rules",
    instructions:
      "One sequential pass must return exactly one row per setup.rulePaths entry, including skipped rules with reasons. Read each selected rule fully.",
  },
  consolidation: {
    group: "Consolidation",
    reference: "step-5-create-the-final-review-report",
    instructions:
      "Perform only the evidence-consolidation items 1–5 in Step 5. Independently check important worker claims against code, requirements and current CI. Verify checklist guidance coverage, resolve contradictions and merge duplicate findings. Record unresolved claims as gaps. Do not draft or edit the report in this stage.",
  },
  draft: {
    group: "Reporting",
    reference: "step-5-create-the-final-review-report",
    instructions:
      "Perform only Step 5 item 6: write the complete report using the accepted consolidation. Editorial reduction and final acceptance are later workflow stages.",
  },
  editorial: {
    group: "Reporting",
    reference: "step-5-create-the-final-review-report",
    instructions:
      "Shorten the complete draft without changing priorities, findings, evidence, tables, check outcomes or uncertainty. Return the edited full report as markdown.",
  },
  report: {
    group: "Reporting",
    reference: "step-5-create-the-final-review-report",
    instructions:
      "Compare the completed draft and editorial versions. Restore lost detail and accept the final canonical report. Account for every worker finding with decisions.sourceId = '<stage>:<finding id>'. Explain retained, merged, excluded or open findings. Keep retained report IDs visible in markdown. The decision stage assesses this accepted report.",
  },
  "split-plan": {
    group: "Reporting",
    reference: "step-1-setup",
    instructions:
      "Return a split-only report with Assessment, Risk and scope, Split plan and CI status headings. Read the sibling split-pr skill when available. State what was inspected and that full review was deferred.",
  },
  decision: {
    group: "Decision",
    reference: "step-6-publish-results",
    instructions:
      "Perform the final approval assessment from Step 6 without publishing. Return approval in the documented seven-check schema, summaryMarkdown following templates/github-progress.md, and inlineComments for verified new bugs with valid diff anchors only. Each inline ID must exactly match a retained reportId whose source is a new bug. Required retained findings and unresolved findings cannot pass clean_review. Do not introduce new findings. For split-only output use outcome split, checks null and no inline comments. Count additions plus deletions across the whole diff. This stage returns an assessment only. A later workflow delivery worker owns publication and approval submission. Honour input.publication: local-only, staged and comment-only never allow automatic approval; if all checks pass use not_submitted with the restriction as its reason and next step.",
  },
} satisfies Record<
  StageName,
  { group: string; reference: string; instructions: string }
>;

/**
 * Builds one worker assignment from pinned inputs and already accepted answers.
 * Retry feedback describes the rejected answer without reusing that worker.
 */
export function stagePrompt(
  input: ReviewInput,
  name: StageName,
  context: StageResults,
  feedback: string,
): string {
  const definition = stageDefinitions[name];
  return [
    `You are the ${name} worker for one pinned code review.`,
    `Read shared review constraints in ${input.skillRoot}/criteria.md#rules. Do not perform its coordinator steps.`,
    `Assigned instructions: ${input.skillRoot}/criteria.md#${definition.reference}`,
    "Read the assigned section and perform only its task. Coordinator steps outside that section are not part of your assignment.",
    `Wrapper guidance: ${JSON.stringify(input.wrapperSkillRoots.map((root) => `${root}/SKILL.md`))}.`,
    "Execute only your assigned stage. Do not recursively run the review or delegate more agents.",
    "For assessments and later stages, research-check is the accepted corrected research brief and takes precedence over the initial research result. Preserve remaining evidence gaps.",
    "Accepted prior reports are supplied inline below and saved later by the writer. Editing happens in later stages. Publication belongs to the workflow delivery worker. Do not treat unsaved intermediate files or future stages as missing evidence.",
    `Read supplied scope and requirements files: ${JSON.stringify(input.contextFiles)}. Apply caller restrictions, cite the files and record unavailable external context rather than inventing sources.`,
    "Finish by calling StructuredOutput with markdown, individual checks, findings and gaps. Text outside that tool call is discarded. Do not substitute a prose final answer.",
    "Read relevant best-practice skill descriptions and select guidance for this question. Cite guidance sections and versions.",
    assessmentNames.some((question) => question === name)
      ? "Read the main skill's Review best practices and Build and verify the checklist sections as well as your assigned question. Return only your own assessment."
      : "",
    "Do not modify source or artefacts, install anything, run local project checks, start services, trigger CI, publish, notify, or call github_review_complete. Use source inspection and existing CI.",
    "Before inspecting source, confirm checkout HEAD matches the supplied head and the checkout is clean. Read other revisions through pinned Git objects. Record a mismatch as blocked rather than reviewing another revision.",
    "A blocked or unavailable evidence source is a recorded gap, not a passed check. Findings need locations, triggers, effects and evidence. An empty findings array is valid.",
    definition.instructions,
    ["draft", "editorial", "report"].includes(name)
      ? `Use ${input.skillRoot}/templates/review-report.md. Return the complete self-contained report. Preserve coverage, research context and every evidence gap.`
      : "",
    `Pinned inputs: ${JSON.stringify(input)}`,
    `Prior accepted results: ${JSON.stringify(context)}`,
    feedback
      ? `The prior attempt failed validation: ${feedback}. Make one fresh attempt.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Pins the worker’s structured-output schema to this review’s exact revisions.
 */
export function stageJsonSchema(name: StageName, input: ReviewInput) {
  return z.toJSONSchema(
    StageSchemas[name].extend({
      base: z.literal(input.base),
      head: z.literal(input.head),
    }),
    { target: "draft-7" },
  );
}

/**
 * Throws when an answer loses evidence, coverage or finding provenance.
 * The caller owns retrying the stage and recording a final failure.
 */
export function validateStage(
  result: StageResult,
  prior: StageResults,
  input: ReviewInput,
): void {
  if (result.base !== input.base || result.head !== input.head) {
    throw new Error("Assessment revisions differ from pinned inputs");
  }
  if (
    result.checks.some(
      (check) =>
        !check.evidence.length &&
        ![
          "Blocked",
          "Not run",
          "N/A",
          "CI pending",
          "CI skipped",
          "CI cancelled",
        ].includes(check.result),
    )
  ) {
    throw new Error("Verified checks require evidence");
  }
  if (
    new Set(result.findings.map((finding) => finding.id)).size !==
    result.findings.length
  ) {
    throw new Error("Finding IDs must be unique within an assessment");
  }
  const prose = result.markdown.replace(
    /^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[ \t]*$/gm,
    "",
  );
  if (/^# Review:\s+\{\{\s*target\s*\}\}\s*$/m.test(prose)) {
    throw new Error("Replace the report target scaffold");
  }
  const headings =
    result.stage === "report"
      ? [
          "Assessment",
          "Risk and scope",
          "Findings",
          "Verification summary",
          "References",
          "Supporting details",
        ]
      : result.stage === "split-plan"
        ? ["Assessment", "Risk and scope", "Split plan", "CI status"]
        : [];
  if (
    headings.some(
      (heading) =>
        !new RegExp(`^#{2,3} ${heading}\\s*$`, "m").test(result.markdown),
    )
  ) {
    throw new Error("Final report is missing required template sections");
  }
  if (result.stage === "setup") {
    if (new Set(result.rulePaths).size !== result.rulePaths.length) {
      throw new Error("Rule inventory paths must be unique");
    }
    if (
      result.addedLines > 2000 &&
      result.mode === "full" &&
      !result.sizeException?.trim()
    ) {
      throw new Error(
        "Oversized full review requires a documented permitted exception",
      );
    }
  }
  if (result.stage === "rules") {
    validateRuleCoverage(result, prior);
  }
  if (result.stage === "report") {
    validateFindingDecisions(result, prior);
  }
  if (result.stage === "decision") {
    validateApproval(result, prior);
  }
}

function validateRuleCoverage(
  result: z.infer<typeof StageSchemas.rules>,
  prior: StageResults,
): void {
  const expected = prior.setup?.rulePaths;
  if (!expected) {
    throw new Error("Rule coverage requires accepted setup");
  }
  const actual = result.rules.map((rule) => rule.path);
  if (
    new Set(actual).size !== actual.length ||
    expected.length !== actual.length ||
    expected.some((path) => !actual.includes(path))
  ) {
    throw new Error("Rule coverage has missing, duplicate or unexpected paths");
  }
  for (const rule of result.rules) {
    if ((rule.selection === "skipped") !== (rule.result === "Skipped")) {
      throw new Error("Rule selection and result disagree");
    }
    if (
      rule.selection === "selected" &&
      ["Satisfied", "Concern found"].includes(rule.result) &&
      !rule.evidence.length
    ) {
      throw new Error("Selected verified rules require evidence");
    }
  }
}

function validateFindingDecisions(
  report: z.infer<typeof StageSchemas.report>,
  prior: StageResults,
): void {
  const expected = Object.entries(prior)
    .filter(([name]) => !["report", "decision"].includes(name))
    .flatMap(([stage, result]) =>
      result.findings.map((finding) => `${stage}:${finding.id}`),
    );
  const actual = report.decisions.map((decision) => decision.sourceId);
  if (
    new Set(actual).size !== actual.length ||
    actual.length !== expected.length ||
    expected.some((id) => !actual.includes(id))
  ) {
    throw new Error(
      "Final report must account for every input finding exactly once",
    );
  }
  if (
    report.decisions.some(
      (decision) =>
        ["retained", "merged"].includes(decision.disposition) &&
        (!decision.reportId || !report.markdown.includes(decision.reportId)),
    )
  ) {
    throw new Error("Retained findings require an ID present in the report");
  }
}
