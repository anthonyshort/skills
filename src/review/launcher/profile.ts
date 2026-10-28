import {
  chmod,
  copyFile,
  cp,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { hasErrorCode } from "./inputs.js";

const ProfileSettingsSchema = z.object({
  defaultProvider: z.string().min(1),
  defaultModel: z.string().min(1),
  defaultThinkingLevel: z.string().optional(),
});
const PluginManifestSchema = z.object({
  name: z.literal("@tintinweb/pi-subagents"),
  version: z.literal("0.22.0"),
});

/**
 * Copy model configuration and credentials without loading source-profile plugins.
 */
export async function createPrivateProfile(
  source: string,
  packageRoot: string,
  pluginRoot: string,
): Promise<string> {
  const settings = ProfileSettingsSchema.parse(
    JSON.parse(await readFile(path.join(source, "settings.json"), "utf8")),
  );
  const directory = await mkdtemp(path.join(os.tmpdir(), "pi-review-profile-"));
  try {
    await chmod(directory, 0o700);
    await writeFile(
      path.join(directory, "settings.json"),
      JSON.stringify({
        ...settings,
        packages: [packageRoot, pluginRoot],
        quietStartup: true,
      }),
      { mode: 0o600 },
    );
    await writeFile(
      path.join(directory, "subagents.json"),
      JSON.stringify({
        workflowsEnabled: true,
        fallbackSubagent: "none",
        strictAgentFiles: true,
        rememberAgents: true,
      }),
      { mode: 0o600 },
    );
    for (const name of ["auth.json", "models.json", "models-store.json"]) {
      try {
        await copyFile(path.join(source, name), path.join(directory, name));
        await chmod(path.join(directory, name), 0o600);
      } catch (error) {
        if (!hasErrorCode(error, "ENOENT")) {
          throw error;
        }
      }
    }
    return directory;
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

export async function resolvePluginRoot(
  explicit: string | undefined,
  packageRoot: string,
): Promise<string> {
  let root: string;
  try {
    root = await realpath(
      explicit ??
        path.join(packageRoot, "node_modules/@tintinweb/pi-subagents"),
    );
  } catch {
    throw new Error(
      "Install the pinned pi-subagents development dependency or pass --plugin-root",
    );
  }
  const result = PluginManifestSchema.safeParse(
    JSON.parse(await readFile(path.join(root, "package.json"), "utf8")),
  );
  if (!result.success) {
    throw new Error("The launcher requires @tintinweb/pi-subagents 0.22.0");
  }
  return root;
}

/**
 * Retain diagnostic sessions while always deleting the copied credentials.
 */
export async function archiveAndRemoveProfile(
  profile: string,
  artifacts: string,
): Promise<void> {
  try {
    await cp(
      path.join(profile, "sessions"),
      path.join(artifacts, "subagent-sessions"),
      { recursive: true, errorOnExist: true, force: false },
    );
  } catch (error) {
    if (!hasErrorCode(error, "ENOENT")) {
      throw error;
    }
  } finally {
    await rm(profile, { recursive: true, force: true });
  }
}
