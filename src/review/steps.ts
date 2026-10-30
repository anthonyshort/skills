/**
 * Named review workers own their assignments, schemas and review-policy checks.
 */
import * as z from "zod";
import { callValidatedAgent } from "../workflow/agent.js";
import type { StepInput } from "../workflow/run.js";
import type { ReviewInput } from "./input.js";

/**
 * Nonempty prose and identifiers returned in worker answers.
 */
const text = z.string().min(1);

/**
 * Bounded evidence references and gap notes shared by worker output schemas.
 */
const strings = z.array(text).max(10_000);

/**
 * Output contract shared by every review worker. Setup, rules, report and
 * decision extend it locally. Finding kinds and dispositions affect publication;
 * checklist statuses remain descriptive.
 */
const ReviewEvidenceSchema = z.object({
  base: z.string(),
  head: z.string(),
  markdown: text,
  checks: z
    .array(
      z.object({
        guidance: text,
        item: text,
        method: text,
        result: text,
        evidence: strings,
        reason: text,
      }),
    )
    .min(1)
    .max(10_000),
  findings: z
    .array(
      z.object({
        id: text,
        kind: z.enum([
          "bug",
          "readability",
          "question",
          "convention",
          "preference",
          "opportunity",
        ]),
        disposition: z.enum(["required", "optional", "open"]),
        title: text,
        location: text,
        trigger: text,
        effect: text,
        action: text,
        evidence: strings.min(1),
        existingThread: z.string().nullable(),
      }),
    )
    .max(10_000),
  gaps: strings,
});

const MAX_ATTEMPTS = 2;

/**
 * Accepted answers are keyed by task name; worker payloads do not repeat it.
 */
export type ReviewResults = {
  setup: Awaited<ReturnType<typeof setupReview>>;
  research: Awaited<ReturnType<typeof researchReview>>;
  researchCheck: Awaited<ReturnType<typeof checkResearch>>;
  product: Awaited<ReturnType<typeof assessProduct>>;
  systemFit: Awaited<ReturnType<typeof assessSystemFit>>;
  simplicity: Awaited<ReturnType<typeof assessSimplicity>>;
  readability: Awaited<ReturnType<typeof assessReadability>>;
  correctness: Awaited<ReturnType<typeof assessCorrectness>>;
  rules: Awaited<ReturnType<typeof checkRules>>;
  consolidation: Awaited<ReturnType<typeof consolidateReview>>;
  draft: Awaited<ReturnType<typeof draftReport>>;
  editorial: Awaited<ReturnType<typeof editReport>>;
  report: Awaited<ReturnType<typeof acceptReport>>;
  splitPlan: Awaited<ReturnType<typeof planSplit>>;
  decision: Awaited<ReturnType<typeof decideReview>>;
};

export type StageResults = Partial<ReviewResults>;
export type StageName = keyof ReviewResults;

/**
 * Review input, diagnostics and optional agent caller shared by this run's workers.
 */
export type ReviewContext = {
  review: ReviewInput;
  attempts: { stage: StageName; attempt: number; reason: string }[];
  call?: typeof agent;
};

type ReviewStepInput = StepInput<ReviewContext, ReviewResults>;

/**
 * Establish the pinned scope, review depth and rule inventory.
 */
export function setupReview(args: ReviewStepInput) {
  return reviewAgent({
    ...args,
    label: "setup",

    /**
     * Scope and rule inventory used to choose the review route and check
     * rule coverage.
     */
    outputSchema: ReviewEvidenceSchema.extend({
      mode: z.enum(["full", "split"]),
      addedLines: z.number().int().nonnegative(),
      deletedLines: z.number().int().nonnegative(),
      sizeException: z.string().nullable(),
      rulePaths: z.array(text).max(1000),
    }),

    validate: (setup) => {
      if (new Set(setup.rulePaths).size !== setup.rulePaths.length) {
        throw new Error("Rule inventory paths must be unique");
      }
      if (
        setup.addedLines > 2000 &&
        setup.mode === "full" &&
        !setup.sizeException?.trim()
      ) {
        throw new Error(
          "Oversized full review requires a documented permitted exception",
        );
      }
    },
    prompt: `
Read “Step 1: Setup” in the review skill. Establish the pinned scope, depth and
initial risks. Return mode, addedLines, deletedLines and any sizeException.
Enumerate every rule in the main and wrapper rules/README.md indexes, returning
absolute canonical paths in rulePaths. Return the setup evidence without doing
research, splitting or the implementation review; those are later steps.
`,
  });
}

/**
 * Gather sourced context or validate usable earlier research.
 */
export function researchReview(args: ReviewStepInput) {
  return reviewAgent({
    ...args,
    label: "research",
    outputSchema: ReviewEvidenceSchema,
    prompt: `
Read “Step 2: Research” in the review skill. Gather the research brief or validate
usable earlier research through its re-review gate. Return the brief, sources,
search coverage and gaps. A separate researchCheck worker verifies it next.
`,
  });
}

/**
 * Independently check the brief before assessments use it.
 */
export function checkResearch(args: ReviewStepInput) {
  return reviewAgent({
    ...args,
    label: "researchCheck",
    outputSchema: ReviewEvidenceSchema,
    prompt: `
Read “Step 2: Research” in the review skill, including its completion checklist.
Independently check the supplied research brief against the important cited
sources, pinned comparison and current CI. Correct unsupported claims, verify
reused evidence and preserve gaps. Return a self-contained corrected brief;
reading the first brief alone does not verify it. Do not start assessments.
`,
  });
}

/**
 * Assess the user problem and supported product alternatives.
 */
export function assessProduct(args: ReviewStepInput) {
  return reviewAgent({
    ...args,
    label: "product",
    outputSchema: ReviewEvidenceSchema,
    prompt: `
Read Step 3’s “Review best practices”, “Build and verify the checklist” and
“Q: Should we build this?” in the review skill. Return the product assessment.
`,
  });
}

/**
 * Assess ownership, dependencies and architectural fit.
 */
export function assessSystemFit(args: ReviewStepInput) {
  return reviewAgent({
    ...args,
    label: "systemFit",
    outputSchema: ReviewEvidenceSchema,
    prompt: `
Read Step 3’s “Review best practices”, “Build and verify the checklist” and
“Q: Does this code fit into the existing system?” in the review skill.
Return the system fit assessment.
`,
  });
}

/**
 * Assess the amount of implementation and scope needed.
 */
export function assessSimplicity(args: ReviewStepInput) {
  return reviewAgent({
    ...args,
    label: "simplicity",
    outputSchema: ReviewEvidenceSchema,
    prompt: `
Read Step 3’s “Review best practices”, “Build and verify the checklist” and
“Q: Is this the simplest solution?” in the review skill.
Return the simplicity assessment.
`,
  });
}

/**
 * Inspect changed bodies and tests for reading difficulties.
 */
export function assessReadability(args: ReviewStepInput) {
  return reviewAgent({
    ...args,
    label: "readability",
    outputSchema: ReviewEvidenceSchema,
    prompt: `
Read Step 3’s “Review best practices”, “Build and verify the checklist” and
“Q: Is this code clear and easy to maintain?” in the review skill.
Return the dedicated readability assessment.
`,
  });
}

/**
 * Trace behaviour, callers, tests and available CI evidence.
 */
export function assessCorrectness(args: ReviewStepInput) {
  return reviewAgent({
    ...args,
    label: "correctness",
    outputSchema: ReviewEvidenceSchema,
    prompt: `
Read Step 3’s “Review best practices”, “Build and verify the checklist” and
“Q: Is this implementation correct?” in the review skill.
Return the correctness assessment.
`,
  });
}

/**
 * Account for every indexed rule in one sequential pass.
 */
export function checkRules(args: ReviewStepInput) {
  const setup = args.results.setup;
  if (!setup) {
    throw new Error("Rule coverage requires accepted setup");
  }
  return reviewAgent({
    ...args,
    label: "rules",

    /**
     * One result per indexed rule, consumed by consolidation and the final report.
     */
    outputSchema: ReviewEvidenceSchema.extend({
      rules: z
        .array(
          z.object({
            path: text,
            selection: z.enum(["selected", "skipped"]),
            result: z.enum([
              "Satisfied",
              "Concern found",
              "Not applicable",
              "Not verified",
              "Skipped",
            ]),
            reason: text,
            evidence: z.array(text).max(10_000),
          }),
        )
        .max(1000),
    }),

    validate: ({ rules }) => {
      const actual = rules.map((rule) => rule.path);
      if (
        new Set(actual).size !== actual.length ||
        setup.rulePaths.length !== actual.length ||
        setup.rulePaths.some((path) => !actual.includes(path))
      ) {
        throw new Error(
          "Rule coverage has missing, duplicate or unexpected paths",
        );
      }
      for (const rule of rules) {
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
    },
    prompt: `
Read “Step 4: Check review rules” in the review skill and the supplied main and
wrapper rule indexes. Work through rules sequentially in this worker.
Return exactly one rules row per setup.rulePaths entry, including skipped rules
with reasons. Consolidation checks this evidence after the rule pass.
`,
  });
}

/**
 * Verify claims, resolve disagreements and merge findings.
 */
export function consolidateReview(args: ReviewStepInput) {
  return reviewAgent({
    ...args,
    label: "consolidation",
    outputSchema: ReviewEvidenceSchema,
    prompt: `
Read Step 5’s “Rules for a good report” and “Create the report”, items 1–5,
in the review skill. Verify claims, resolve disagreements and merge findings
from the accepted research, all five assessments and the rules. Return the
consolidated evidence and conclusions. Drafting and editing happen later.
`,
  });
}

/**
 * Write the complete report from accepted review evidence.
 */
export function draftReport(args: ReviewStepInput) {
  return reviewAgent({
    ...args,
    label: "draft",
    outputSchema: ReviewEvidenceSchema,
    prompt: `
Read Step 5’s “Rules for a good report” and “Create the report”, item 6,
in the review skill, plus templates/review-report.md. Write the full report
from accepted consolidation. Editorial reduction and acceptance happen later.
`,
  });
}

/**
 * Shorten the draft while preserving evidence and findings.
 */
export function editReport(args: ReviewStepInput) {
  return reviewAgent({
    ...args,
    results: { draft: args.results.draft },
    label: "editorial",
    outputSchema: ReviewEvidenceSchema,
    prompt: `
Read Step 5’s “Rules for a good report” and “Create the report”, item 7,
in the review skill, plus templates/review-report.md. Perform only the editorial
role: shorten the supplied draft while preserving its findings, evidence,
counts, individual check outcomes and uncertainty. Return the whole edited
report. The next worker compares it with the original and accepts the report.
`,
  });
}

/**
 * Compare the edit and draft, restore detail and accept the report.
 */
export function acceptReport(args: ReviewStepInput) {
  return reviewAgent({
    ...args,
    label: "report",

    /**
     * The accepted report and accounting decisions for every earlier finding.
     */
    outputSchema: ReviewEvidenceSchema.extend({
      decisions: z
        .array(
          z.object({
            sourceId: text,
            disposition: z.enum(["retained", "merged", "excluded", "open"]),
            reportId: z.string().nullable(),
            reason: text,
          }),
        )
        .max(10_000),
    }),

    validate: (report) => {
      const expected = Object.entries(args.results)
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
            (!decision.reportId ||
              !report.markdown.includes(decision.reportId)),
        )
      ) {
        throw new Error(
          "Retained findings require an ID present in the report",
        );
      }
    },
    prompt: `
Read Step 5’s “Rules for a good report”, the comparison/restoration part of
“Create the report”, item 7, and its completion checklist in the review skill.
Read templates/review-report.md. Compare draft and editorial versions, restore
lost evidence and return the accepted self-contained report in markdown.
Account for every input finding exactly once in decisions using
sourceId = '<stage>:<finding id>'. Explain retained, merged, excluded and open
findings, keeping retained report IDs visible in markdown. Do not save files.
`,
  });
}

/**
 * Propose useful review boundaries without a full implementation review.
 */
export function planSplit(args: ReviewStepInput) {
  return reviewAgent({
    ...args,
    label: "splitPlan",
    outputSchema: ReviewEvidenceSchema,
    prompt: `
Read Step 1’s “Choose the review depth” in the review skill and the sibling
split-pr/SKILL.md. Return useful smaller review boundaries, their ordering and
verification limits. This is split-only: do not perform the five assessments,
rule pass or full report, and do not imply those reviews were completed.
`,
  });
}

/**
 * Assess approval and prepare publication material without submitting it.
 */
export function decideReview(args: ReviewStepInput) {
  const setup = args.results.setup;
  if (!setup) {
    throw new Error("Approval requires accepted setup");
  }

  /**
   * A single approval gate. All seven named gates must pass before approval.
   */
  const approvalCheck = z.object({
    result: z.enum(["Pass", "Fail", "Not verified"]),
    reason: text,
  });

  return reviewAgent({
    ...args,
    label: "decision",

    /**
     * Approval assessment and publication content, including source-linked
     * inline findings.
     */
    outputSchema: ReviewEvidenceSchema.extend({
      findings: ReviewEvidenceSchema.shape.findings.max(0),
      approval: z.object({
        outcome: z.enum([
          "split",
          "human_review",
          "incomplete",
          "changes_needed",
          "waiting_checks",
          "not_submitted",
          "approve",
        ]),
        changed_lines: z.number().int().nonnegative(),
        checks: z
          .strictObject({
            focused: approvalCheck,
            low_risk: approvalCheck,
            no_sensitive_changes: approvalCheck,
            clean_review: approvalCheck,
            complete_review: approvalCheck,
            verification: approvalCheck,
            concerns_resolved: approvalCheck,
          })
          .nullable(),
        reason: text,
        next_steps: z.array(text).max(10_000),
      }),
      summaryMarkdown: z.string().min(1),
      inlineComments: z
        .array(
          z.object({
            id: text,
            path: text,
            line: z.number().int().positive(),
            side: z.enum(["LEFT", "RIGHT"]),
            body: text,
          }),
        )
        .max(100),
    }),

    validate: (decision) => {
      const { approval, inlineComments } = decision;
      const report = args.results.report;
      if (approval.changed_lines !== setup.addedLines + setup.deletedLines) {
        throw new Error("Approval changed_lines must match the complete diff");
      }
      const checks = approval.checks;
      if (approval.outcome !== "approve" && !approval.next_steps.length) {
        throw new Error(
          "Withheld approval requires a concrete next step and owner",
        );
      }
      if (setup.mode === "split") {
        if (approval.outcome !== "split" || inlineComments.length > 0) {
          throw new Error(
            "Split-only output must not claim implementation approval or inline findings",
          );
        }
        if (checks !== null) {
          throw new Error("Split approval must use checks null");
        }
        return;
      }
      if (approval.outcome === "split" || !checks) {
        throw new Error("Full review requires all seven approval checks");
      }
      if (!report) {
        throw new Error("Approval requires an accepted report");
      }
      if (
        ["approve", "not_submitted"].includes(approval.outcome) &&
        Object.values(checks).some((check) => check.result !== "Pass")
      ) {
        throw new Error(
          "Passing approval requires every checklist item to pass",
        );
      }
      const sources = Object.entries(args.results).flatMap(([stage, result]) =>
        result.findings.map((finding) => ({
          sourceId: `${stage}:${finding.id}`,
          finding,
        })),
      );
      const includedFindings = report.decisions
        .filter((reportDecision) => reportDecision.disposition !== "excluded")
        .map((reportDecision) => {
          const source = sources.find(
            (source) => source.sourceId === reportDecision.sourceId,
          );
          if (!source) {
            throw new Error(
              "Report decision refers to an unknown source finding",
            );
          }
          return { finding: source.finding, reportDecision };
        });
      const hasUnresolvedFindings =
        report.findings.some((finding) =>
          ["required", "open"].includes(finding.disposition),
        ) ||
        includedFindings.some(
          (item) =>
            ["required", "open"].includes(item.finding.disposition) ||
            item.reportDecision.disposition === "open",
        );
      if (
        (hasUnresolvedFindings || inlineComments.length > 0) &&
        checks.clean_review.result === "Pass"
      ) {
        throw new Error(
          "Clean review cannot pass with retained required or unresolved findings",
        );
      }
      if (
        new Set(inlineComments.map((comment) => comment.id)).size !==
        inlineComments.length
      ) {
        throw new Error("Inline finding IDs must be unique");
      }
      for (const comment of inlineComments) {
        const isAcceptedNewBug = includedFindings.some(
          ({ finding, reportDecision }) =>
            reportDecision.reportId === comment.id &&
            ["retained", "merged"].includes(reportDecision.disposition) &&
            finding.kind === "bug" &&
            finding.existingThread === null,
        );
        if (!isAcceptedNewBug) {
          throw new Error(
            "Inline findings must reference an accepted new bug by exact report ID",
          );
        }
      }
    },
    prompt: `
Read Step 6’s “What to do”, items 1–3 only, in the review skill. Assess the
accepted report without publishing. Return the approval object through
StructuredOutput instead of saving approval.json. Honour input.publication:
local-only and comment-only cannot approve; use not_submitted when all checks
pass but submission is disallowed. For split-only output use outcome split,
checks null and no inline findings. Do not introduce new findings.

Read templates/github-review.md and the sibling writing-voice/SKILL.md.
Return summaryMarkdown using the template’s assessment-first layout, including
research and alternatives folds. Use exactly “#### Findings” and
“#### Opportunities” for those sections when needed. Omit Next steps, Full report,
the reviewed-commit heading and approval checks; delivery adds them from the
accepted result. Do not use the skill’s Python publication helpers.

Return inlineComments only for verified new bugs with valid pinned diff anchors.
Each inline id must exactly match a retained report ID whose source is a new bug.
`,
  });
}

/**
 * Add review guidance and evidence checks to the shared validated agent call.
 */
function reviewAgent<Result extends z.infer<typeof ReviewEvidenceSchema>>({
  input: { review: input, attempts, call },
  results,
  label,
  outputSchema,
  prompt,
  validate,
}: ReviewStepInput & {
  label: StageName;
  outputSchema: z.ZodType<Result>;
  prompt: string;
  validate?: (result: Result) => void;
}): Promise<Result> {
  return callValidatedAgent({
    call: call ?? agent,
    label,
    outputSchema,
    maxAttempts: MAX_ATTEMPTS,
    prompt: [
      `
Perform only the assigned task. Read the “Goals” and “Rules” sections of the
review skill at ${input.skillRoot}/SKILL.md, then locate and read the sections
named in your assignment. Resolve its relative resource links from
${input.skillRoot}; sibling skills are under its parent directory.

The coordinator owns orchestration and delivery. Do not invoke the whole skill,
run another workflow, delegate, save artefacts, publish or notify, even when the
skill describes those parent responsibilities. Return all evidence and report
text through StructuredOutput using the supplied schema. Text outside that
call is discarded. Record missing guidance as a gap rather than inventing it.

Before source inspection, confirm checkout HEAD matches input.head and the
checkout is clean. Record a mismatch as blocked; read other revisions through
pinned Git objects. Use the accepted researchCheck brief over research where
they disagree. Future workflow steps are not missing evidence.
`,
      `Wrapper guidance: ${JSON.stringify(input.wrapperSkillRoots.map((root) => `${root}/SKILL.md`))}.`,
      `Read supplied scope and requirements files: ${JSON.stringify(input.contextFiles)}. Record unavailable external context rather than inventing sources.`,
      `Pinned inputs: ${JSON.stringify(input)}`,
      `Prior accepted results: ${JSON.stringify(results)}`,
      prompt,
    ].join("\n"),
    validate: (result) => {
      if (result.base !== input.base || result.head !== input.head) {
        throw new Error("Assessment revisions differ from pinned inputs");
      }
      if (
        new Set(result.findings.map((finding) => finding.id)).size !==
        result.findings.length
      ) {
        throw new Error("Finding IDs must be unique within an assessment");
      }
      validate?.(result);
    },
    onAttemptFailed: ({ attempt, reason }) => {
      attempts.push({ stage: label, attempt, reason });
    },
  });
}
