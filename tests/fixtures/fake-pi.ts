import { appendFileSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { z } from "zod";
import { parseReviewInput } from "../../src/review/contracts.js";

const argv = process.argv.slice(2);
const session = argv[argv.indexOf("--session") + 1];
const flag = argv.find((value) =>
  value.startsWith("--subagents-workflow-file="),
);
if (!session || !flag) {
  throw new Error("Fake Pi requires session and workflow arguments");
}
const source = readFileSync(flag.slice(flag.indexOf("=") + 1), "utf8");
const match = /return await workflow\("review", (.*)\);/.exec(source);
if (!match) {
  throw new Error("Bootstrap does not invoke the named workflow");
}
const input = parseReviewInput(JSON.parse(match[1]));
const profile = process.env.PI_CODING_AGENT_DIR;
if (!profile) {
  throw new Error("Private profile was not supplied");
}
const settings = z
  .object({
    defaultProvider: z.string(),
    defaultModel: z.string(),
    defaultThinkingLevel: z.string().optional(),
    packages: z.array(z.string()).max(100),
  })
  .parse(JSON.parse(readFileSync(path.join(profile, "settings.json"), "utf8")));
const manifest = z
  .object({
    pi: z.object({
      subagents: z.object({ workflows: z.array(z.string()).min(1).max(100) }),
    }),
  })
  .parse(
    JSON.parse(
      readFileSync(path.join(input.packageRoot, "package.json"), "utf8"),
    ),
  );
const workflowPath = path.join(
  input.packageRoot,
  manifest.pi.subagents.workflows[0],
  "review.js",
);
if (!readFileSync(workflowPath, "utf8").includes('name: "review"')) {
  process.exit(18);
}
if (!readFileSync(session, "utf8").includes('"role":"user"')) {
  process.exit(19);
}
writeFileSync(
  path.join(input.artifacts, "capture.json"),
  JSON.stringify({
    argv,
    input,
    profile,
    settings,
    authMode: statSync(path.join(profile, "auth.json")).mode & 0o777,
  }),
);
process.stdin.resume();
process.stdin.on("end", () => process.exit(20));
const scenario = process.env.PI_REVIEW_TEST_SCENARIO;
if (scenario === "exit-zero") {
  process.exit(0);
}
if (scenario === "timeout" || scenario === "cancel") {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    stdio: "ignore",
  });
  writeFileSync(
    path.join(input.artifacts, "grandchild.pid"),
    String(child.pid),
  );
} else {
  setTimeout(() => {
    if (scenario !== "terminal-failed") {
      const fingerprint = "a".repeat(16);
      writeFileSync(
        path.join(input.artifacts, "bundle.json"),
        JSON.stringify({ fingerprint, valid: scenario !== "invalid-bundle" }),
      );
      writeFileSync(
        path.join(input.artifacts, "review-report.md"),
        "# Review\n",
      );
      const status = scenario === "incomplete" ? "incomplete" : "complete";
      let publicationStatus = {
        local: "not_requested",
        "dry-run": "rendered",
        github: "confirmed",
      }[input.publication.mode];
      if (scenario === "unconfirmed") {
        publicationStatus = "pending";
      }
      const result: Record<string, unknown> = {
        status,
        runId: input.runId,
        invocationId:
          scenario === "stale-result" ? "another-run" : input.invocationId,
        base: input.base,
        head: input.head,
        bundlePath: path.join(input.artifacts, "bundle.json"),
        reportPath:
          status === "incomplete"
            ? null
            : path.join(input.artifacts, "review-report.md"),
        fingerprint,
        publication: {
          mode: input.publication.mode,
          status: publicationStatus,
        },
        missingStages: [],
        coverageGaps: [],
      };
      if (scenario === "malformed-result") {
        delete result.coverageGaps;
      }
      writeFileSync(
        path.join(input.artifacts, "result.json"),
        JSON.stringify(result),
      );
    }
    appendFileSync(
      session,
      JSON.stringify({
        type: "custom",
        customType: "subagents:workflow",
        data: {
          name: "review-launcher",
          status: scenario === "terminal-failed" ? "failed" : "completed",
        },
      }) + "\n",
    );
  }, 120);
}
setInterval(() => {}, 1000);
