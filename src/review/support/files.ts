import { lstat, readFile, realpath, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

export function requireCondition(
  condition: unknown,
  reason: string,
): asserts condition {
  if (!condition) {
    throw new Error(reason);
  }
}

export function within(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}

export async function exists(file: string): Promise<boolean> {
  try {
    await lstat(file);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export async function readArtifact(
  root: string,
  name: string,
): Promise<string> {
  const file = path.join(root, name);
  requireCondition(within(root, file), `Artefact escapes directory: ${name}`);
  requireCondition(await exists(file), `Missing artefact: ${name}`);
  requireCondition(
    !(await lstat(file)).isSymbolicLink() && within(root, await realpath(file)),
    `Artefact escapes directory: ${name}`,
  );
  return readFile(file, "utf8");
}

export async function readJson(root: string, name: string): Promise<unknown> {
  const value: unknown = JSON.parse(await readArtifact(root, name));
  return value;
}

export async function saveJson(file: string, value: unknown): Promise<void> {
  for (const candidate of [file, `${file}.tmp`]) {
    requireCondition(
      !(await exists(candidate)) || !(await lstat(candidate)).isSymbolicLink(),
      `Refusing symlinked publication file: ${candidate}`,
    );
  }
  const temporary = `${file}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2) + "\n", {
    mode: 0o600,
  });
  await rename(temporary, file);
}

/**
 * Match the original helper's json.dumps(sort_keys=True) for frozen inputs.
 */
export function pythonJson(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return JSON.stringify(value).replace(
      /[\u007f-\uffff]/g,
      (character) =>
        `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
    );
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item: unknown) => pythonJson(item)).join(", ")}]`;
  }
  if (typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, item]) => `${pythonJson(key)}: ${pythonJson(item)}`)
      .join(", ")}}`;
  }
  throw new Error("Frozen publication input is not JSON");
}

export function digest(value: unknown): string {
  return createHash("sha256").update(pythonJson(value)).digest("hex");
}
