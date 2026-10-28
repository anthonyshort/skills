import os from "node:os";
import path from "node:path";
import { z } from "zod";

const text = z.string().min(1);
export const LauncherOptionsSchema = z
  .object({
    repository: text,
    base: text,
    output: text,
    head: text.default("HEAD"),
    target: text.optional(),
    publication: z.enum(["local", "dry-run", "github"]).default("local"),
    github: text
      .regex(
        /^[\w.-]+\/[\w.-]+#[1-9]\d*$/,
        "--github must be OWNER/REPO#NUMBER",
      )
      .optional(),
    profile: text,
    pluginRoot: text.optional(),
    pi: text.default("pi"),
    timeoutMs: z.number().positive().max(43_200_000).default(1_800_000),
    contextFiles: z.array(text).max(20).default([]),
    wrapperSkillRoots: z.array(text).max(20).default([]),
  })
  .superRefine((options, context) => {
    if (options.publication !== "local" && !options.github) {
      context.addIssue({
        code: "custom",
        path: ["github"],
        message: "--github is required for remote publication modes",
      });
    }
  });
export type LauncherOptions = z.infer<typeof LauncherOptionsSchema>;
const HelpSchema = z.object({ help: z.literal(true) });
export type LauncherArguments = LauncherOptions | z.infer<typeof HelpSchema>;

export const usage = `Usage: node --import tsx scripts/run-review.ts --repository PATH --base REF --output PATH [options]

  --head REF                 Reviewed revision; must match checkout HEAD (default HEAD)
  --target TEXT              Human-readable review target
  --publication MODE         local (default), dry-run, or github
  --github OWNER/REPO#NUMBER  Required for dry-run or github publication
  --profile PATH             Source Pi profile (default PI_CODING_AGENT_DIR or ~/.pi/agent)
  --plugin-root PATH         Installed @tintinweb/pi-subagents (or PI_REVIEW_PLUGIN_ROOT)
  --pi PATH                  Pi executable (default pi on PATH)
  --timeout SECONDS          Maximum workflow duration (default 1800)
  --context-file PATH        Additional read-only context; repeatable
  --wrapper-skill-root PATH  Additional review wrapper root; repeatable
  --help                     Show this help

The output directory must be empty and outside the reviewed checkout. This command
uses a private temporary Pi profile and does not modify the selected profile.
`;

/**
 * Parse explicit inputs without enabling remote publication implicitly.
 */
export function parseArguments(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
): LauncherArguments {
  const contextFiles: string[] = [];
  const wrapperSkillRoots: string[] = [];
  const options: Record<string, unknown> = {
    profile: env.PI_CODING_AGENT_DIR ?? path.join(os.homedir(), ".pi/agent"),
    pluginRoot: env.PI_REVIEW_PLUGIN_ROOT,
    pi: env.PI_REVIEW_PI ?? "pi",
    contextFiles,
    wrapperSkillRoots,
  };
  const fields = new Map([
    ["repository", "repository"],
    ["base", "base"],
    ["head", "head"],
    ["target", "target"],
    ["output", "output"],
    ["profile", "profile"],
    ["plugin-root", "pluginRoot"],
    ["pi", "pi"],
    ["publication", "publication"],
    ["github", "github"],
  ]);
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (token === "--help" || token === "-h") {
      return { help: true };
    }
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const equal = token.indexOf("=");
    const key = token.slice(2, equal === -1 ? undefined : equal);
    const value = equal === -1 ? argv[++index] : token.slice(equal + 1);
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    const field = fields.get(key);
    if (field) {
      options[field] = value;
    } else if (key === "context-file") {
      contextFiles.push(value);
    } else if (key === "wrapper-skill-root") {
      wrapperSkillRoots.push(value);
    } else if (key === "timeout") {
      const seconds = Number(value);
      if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 43_200) {
        throw new Error("--timeout must be between 0 and 43200 seconds");
      }
      options.timeoutMs = seconds * 1000;
    } else {
      throw new Error(`Unknown option: --${key}`);
    }
  }
  for (const field of ["repository", "base", "output"]) {
    if (!options[field]) {
      throw new Error(`Missing --${field}`);
    }
  }
  return LauncherOptionsSchema.parse(options);
}
