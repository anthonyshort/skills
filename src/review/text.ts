import type { ReviewInput, StageResults } from "./contracts.js";

export function quote(value: string): string {
  return "'" + value.replace(/'/g, "'\\''") + "'";
}

export function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

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

// Detect accidental writer changes without placing the entire bundle in shell argv.
// This is an integrity check, not a security boundary against a hostile writer.
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

export function supportCommand(
  input: ReviewInput,
  name: "publication" | "validate-bundle",
): string {
  return `node --import ${quote(input.tsxLoader)} ${quote(`${input.supportRoot}/${name}.ts`)}`;
}
