import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";

const CommentSchema = z.object({
  id: z.number(),
  html_url: z.string(),
  body: z.string(),
});
const ReviewSchema = CommentSchema.extend({
  state: z.string(),
  commit_id: z.string(),
  user: z.object({ login: z.string() }),
}).passthrough();
const OperationSchema = z.object({ method: z.string(), path: z.string() });
export const BackendSchema = z.object({
  head: z.string(),
  base: z.string(),
  viewer: z.string().default("reviewer"),
  comments: z.array(CommentSchema).max(10_000).default([]),
  reviews: z.array(ReviewSchema).max(10_000).default([]),
  calls: z.array(OperationSchema).max(10_000).default([]),
  writes: z.array(OperationSchema).max(10_000).default([]),
  failBefore: OperationSchema.nullable().default(null),
  failAfter: OperationSchema.nullable().default(null),
});
export type Backend = z.infer<typeof BackendSchema>;

function main() {
  const file = process.env.FAKE_GITHUB_STATE;
  if (!file) {
    throw new Error("Fake GitHub requires an explicit state file");
  }
  const state = BackendSchema.parse(JSON.parse(readFileSync(file, "utf8")));
  const args = process.argv.slice(2);
  if (args[0] !== "api") {
    throw new Error("Only fake gh api is supported");
  }
  const method = args[args.indexOf("--method") + 1];
  const endpoint = args.find(
    (value) => value.startsWith("repos/") || value === "user",
  );
  if (!endpoint) {
    throw new Error("Missing fake endpoint");
  }
  const url = new URL(endpoint, "https://api.github.invalid/");
  const route = url.pathname.replace(/^\//, "");
  const operation = { method, path: route };
  const matches = (candidate: Backend["failBefore"]) =>
    candidate?.method === method && candidate.path === route;
  const save = () => writeFileSync(file, JSON.stringify(state));
  state.calls.push(operation);
  if (matches(state.failBefore)) {
    state.failBefore = null;
    save();
    throw new Error("Simulated permission failure");
  }
  const text = args.includes("--input") ? readFileSync(0, "utf8") : "{}";
  const body: unknown = JSON.parse(text || "{}");
  let response: unknown;
  if (method === "GET" && route === "user") {
    response = { login: state.viewer };
  } else if (method === "GET" && route.endsWith("/pulls/1")) {
    response = {
      head: { sha: state.head },
      base: { sha: state.base },
      state: "open",
      merged: false,
      draft: false,
      user: { login: "author" },
      additions: 1,
      deletions: 0,
    };
  } else if (method === "GET" && route.endsWith("/issues/1/comments")) {
    response = state.comments;
  } else if (method === "GET" && route.includes("/issues/comments/")) {
    response = state.comments.find(
      (comment) => comment.id === Number(route.split("/").at(-1)),
    );
  } else if (method === "GET" && route.endsWith("/pulls/1/reviews")) {
    const page = Number(url.searchParams.get("page") ?? 1);
    response = state.reviews.slice((page - 1) * 100, page * 100);
  } else if (method === "POST" && route.endsWith("/issues/1/comments")) {
    const content = z.object({ body: z.string() }).parse(body);
    response = {
      ...content,
      id: state.comments.length + 1,
      html_url: `https://github.com/fixture/app/pull/1#issuecomment-${state.comments.length + 1}`,
    };
    state.comments.push(CommentSchema.parse(response));
  } else if (method === "PATCH" && route.includes("/issues/comments/")) {
    const comment = state.comments.find(
      (value) => value.id === Number(route.split("/").at(-1)),
    );
    if (!comment) {
      throw new Error("Missing fake comment");
    }
    Object.assign(comment, z.object({ body: z.string() }).parse(body));
    response = comment;
  } else if (method === "POST" && route.endsWith("/pulls/1/reviews")) {
    const payload = z
      .object({
        body: z.string(),
        event: z.enum(["APPROVE", "COMMENT"]),
        commit_id: z.string(),
      })
      .passthrough()
      .parse(body);
    response = {
      ...payload,
      id: state.reviews.length + 1,
      html_url: `https://github.com/fixture/app/pull/1#pullrequestreview-${state.reviews.length + 1}`,
      state: payload.event === "APPROVE" ? "APPROVED" : "COMMENTED",
      user: { login: state.viewer },
    };
    state.reviews.push(ReviewSchema.parse(response));
  } else {
    throw new Error(`Unexpected fake request: ${method} ${route}`);
  }
  if (method !== "GET") {
    state.writes.push(operation);
  }
  if (matches(state.failAfter)) {
    state.failAfter = null;
    save();
    throw new Error("Response lost after server saved write");
  }
  save();
  process.stdout.write(JSON.stringify(response));
}

if (process.env.FAKE_GITHUB_EXECUTE === "1") {
  try {
    main();
  } catch (error) {
    process.stderr.write(String(error));
    process.exitCode = 1;
  }
}
