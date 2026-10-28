import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { parseReviewInput } from "../contracts.js";
import type { ReviewInput } from "../contracts.js";
import type { LauncherOptions } from "./arguments.js";

const execute = promisify(execFile);
export const PACKAGE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
export const TSX_LOADER = fileURLToPath(import.meta.resolve("tsx"));

export function hasErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

export async function git(
  repository: string,
  ...arguments_: string[]
): Promise<string> {
  const { stdout } = await execute("git", ["-C", repository, ...arguments_], {
    maxBuffer: 1024 * 1024,
  });
  return stdout.trim();
}

/**
 * Resolve existing ancestors before checking output containment.
 */
async function canonicalPath(location: string): Promise<string> {
  const resolved = path.resolve(location);
  try {
    return await realpath(resolved);
  } catch (error) {
    if (!hasErrorCode(error, "ENOENT")) {
      throw error;
    }
    const parent = path.dirname(resolved);
    if (parent === resolved) {
      throw error;
    }
    return path.join(await canonicalPath(parent), path.basename(resolved));
  }
}

export function within(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}

export async function assertCheckout(
  repository: string,
  head: string,
): Promise<void> {
  if ((await git(repository, "rev-parse", "HEAD")) !== head) {
    throw new Error("Checkout HEAD differs from the reviewed head");
  }
  if (
    await git(repository, "status", "--porcelain=v1", "--untracked-files=all")
  ) {
    throw new Error("Reviewed checkout must be clean");
  }
}

/**
 * Pin the full comparison and reject unsafe output locations.
 */
export async function resolveReviewInputs(
  options: LauncherOptions,
  packageRoot = PACKAGE_ROOT,
): Promise<ReviewInput> {
  const repository = await realpath(path.resolve(options.repository));
  const top = await realpath(
    await git(repository, "rev-parse", "--show-toplevel"),
  );
  if (top !== repository) {
    throw new Error("--repository must name the checkout root");
  }
  const base = await git(
    repository,
    "rev-parse",
    "--verify",
    "--end-of-options",
    `${options.base}^{commit}`,
  );
  const head = await git(
    repository,
    "rev-parse",
    "--verify",
    "--end-of-options",
    `${options.head}^{commit}`,
  );
  await assertCheckout(repository, head);
  const artifacts = await canonicalPath(options.output);
  if (within(repository, artifacts)) {
    throw new Error("Output must be outside the reviewed checkout");
  }
  const packagePath = await realpath(packageRoot);
  if (within(packagePath, artifacts)) {
    throw new Error("Output must be outside the workflow package");
  }
  let publication: ReviewInput["publication"] = { mode: "local" };
  if (options.publication !== "local") {
    const match = /^([\w.-]+\/[\w.-]+)#([1-9]\d*)$/.exec(options.github ?? "");
    if (!match) {
      throw new Error("--github is required for remote publication modes");
    }
    const prNumber = Number(match[2]);
    if (!Number.isSafeInteger(prNumber)) {
      throw new Error("PR number is too large");
    }
    publication = { mode: options.publication, repository: match[1], prNumber };
  }
  return parseReviewInput({
    workflowEnabled: true,
    packageRoot: packagePath,
    repository,
    base,
    head,
    target:
      options.target ??
      (options.github
        ? `https://github.com/${options.github.replace("#", "/pull/")}`
        : `${path.basename(repository)} ${base.slice(0, 12)}…${head.slice(0, 12)}`),
    artifacts,
    runId: `review_${randomUUID()}`,
    invocationId: randomUUID(),
    tsxLoader: TSX_LOADER,
    wrapperSkillRoots: await Promise.all(
      options.wrapperSkillRoots.map((root) => realpath(path.resolve(root))),
    ),
    contextFiles: await Promise.all(
      options.contextFiles.map((file) => realpath(path.resolve(file))),
    ),
    notification: null,
    publication,
  });
}
