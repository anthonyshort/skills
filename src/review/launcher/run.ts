import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ReviewInput, ReviewResult } from "../contracts.js";
import type { LauncherOptions } from "./arguments.js";
import { assertCheckout, PACKAGE_ROOT, resolveReviewInputs } from "./inputs.js";
import {
  archiveAndRemoveProfile,
  createPrivateProfile,
  resolvePluginRoot,
} from "./profile.js";
import { bootstrapSource, seedSession, startPiSession } from "./session.js";
import type { PiSession, SessionFiles } from "./session.js";
import { validateReviewResult } from "./result.js";

/**
 * Create diagnostic inputs and the bootstrap without changing the source tree.
 */
async function prepareRunFiles(inputs: ReviewInput): Promise<SessionFiles> {
  await mkdir(inputs.artifacts, { recursive: true, mode: 0o700 });
  if ((await readdir(inputs.artifacts)).length) {
    throw new Error("Output directory must be empty");
  }
  const directory = path.join(inputs.artifacts, ".runner");
  const workspace = path.join(directory, "workspace");
  const bootstrap = path.join(directory, "start-review.js");
  const sessionFile = path.join(inputs.artifacts, "session.jsonl");
  await mkdir(workspace, { recursive: true, mode: 0o700 });
  await writeFile(bootstrap, bootstrapSource(inputs), { mode: 0o600 });
  await writeFile(
    path.join(directory, "inputs.json"),
    JSON.stringify(inputs, null, 2) + "\n",
    { mode: 0o600 },
  );
  await seedSession(sessionFile, workspace);
  return { workspace, bootstrap, sessionFile };
}

/**
 * Launch one requested review with session and credential cleanup on every exit.
 */
export async function runReview(
  options: LauncherOptions,
  {
    packageRoot = PACKAGE_ROOT,
    env = process.env,
    signal,
  }: {
    packageRoot?: string;
    env?: NodeJS.ProcessEnv;
    signal?: AbortSignal;
  } = {},
): Promise<ReviewResult> {
  const inputs = await resolveReviewInputs(options, packageRoot);
  const pluginRoot = await resolvePluginRoot(
    options.pluginRoot ?? env.PI_REVIEW_PLUGIN_ROOT,
    inputs.packageRoot,
  );
  const files = await prepareRunFiles(inputs);
  const profile = await createPrivateProfile(
    path.resolve(options.profile),
    inputs.packageRoot,
    pluginRoot,
  );
  let session: PiSession | undefined;
  try {
    session = await startPiSession(inputs, files, profile, options.pi, env);
    const completion = await session.wait({
      timeoutMs: options.timeoutMs,
      signal,
    });
    if (completion.status !== "completed") {
      throw new Error(
        `Pi workflow ${completion.status}; inspect ${inputs.artifacts}`,
      );
    }
    await session.close();
    await assertCheckout(inputs.repository, inputs.head);
    if (signal?.aborted) {
      throw new Error("Review cancelled");
    }
    const result = await validateReviewResult(inputs, { env, signal });
    await assertCheckout(inputs.repository, inputs.head);
    return result;
  } finally {
    try {
      await session?.close();
    } finally {
      await archiveAndRemoveProfile(profile, inputs.artifacts);
    }
  }
}
