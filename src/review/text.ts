import type { StageResults } from "./contracts.js";

/**
 * Normalises thrown values for stage failures and notification diagnostics.
 */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Preserves every check and gap in the canonical report. Bounded detail folds
 * let the existing GitHub helper split a long report into continuation comments.
 */
export function coverageMarkdown(stages: StageResults): string {
  const lines = ["", "## Workflow assessment and rule coverage", ""];
  function folds(title: string, blocks: string[]) {
    let content = "";
    let part = 1;
    const flush = () => {
      if (!content) {
        return;
      }
      lines.push(
        "<details>",
        `<summary>${title} — part ${part++}</summary>`,
        "",
        content,
        "</details>",
        "",
      );
      content = "";
    };
    for (const block of blocks) {
      if (content.length + block.length > 40000) {
        flush();
      }
      content += block + "\n\n";
    }
    flush();
  }
  for (const [name, result] of Object.entries(stages)) {
    const blocks = result.checks.map((item) =>
      [
        `- ${item.item} — ${item.result}. Method: ${item.method}. Guidance: ${item.guidance}. ${item.reason}`,
        ...item.evidence.map((evidence) => `  - ${evidence}`),
      ].join("\n"),
    );
    blocks.push(...result.gaps.map((gap) => `- Coverage gap: ${gap}`));
    folds(name, blocks);
  }
  folds(
    "Rules",
    (stages.rules?.rules ?? []).map((item) =>
      [
        `- Rule ${item.path}: ${item.selection}, ${item.result}. ${item.reason}`,
        ...item.evidence.map((evidence) => `  - ${evidence}`),
      ].join("\n"),
    ),
  );
  return lines.join("\n");
}

/**
 * Detects accidental writer changes without putting the bundle in shell argv.
 * Both halves hash UTF-16 code units, so the VM and Node agree on non-BMP text.
 * This checksum is not a defence against a hostile writer.
 */
export function fingerprint(text: string): string {
  let first = 2166136261;
  let second = 3339675911;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619) >>> 0;
    second = Math.imul(second ^ code, 16777619) >>> 0;
  }
  return (
    first.toString(16).padStart(8, "0") + second.toString(16).padStart(8, "0")
  );
}
