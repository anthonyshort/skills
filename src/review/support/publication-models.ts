import { z } from "zod";
import { ApprovalSchema, InlineCommentSchema } from "../contracts.js";

const text = z.string().min(1);
export const CommentReceiptSchema = z.object({
  id: z.number().int().positive(),
  html_url: text,
});
export const RemoteCommentSchema = CommentReceiptSchema.extend({
  body: z.string(),
});
export const RemoteReviewSchema = z.object({
  id: z.number().int().positive(),
  state: text,
  commit_id: text,
});
export const LivePullSchema = z.object({
  head: z.object({ sha: text }),
  base: z.object({ sha: text }),
  state: text,
  merged: z.boolean(),
});
export const ProgressStateSchema = z
  .object({
    repo: text,
    pr: z.number().int().positive(),
    base: text,
    head: text,
    run_id: text,
    status: text,
    checklist: z.string(),
    comments: z.record(z.string(), CommentReceiptSchema),
    publication_digest: text.optional(),
    approval_decision: ApprovalSchema.optional(),
    approval: z
      .object({
        status: text,
        id: z.number().int().positive().optional(),
        html_url: text.optional(),
      })
      .passthrough()
      .optional(),
    inline_review: CommentReceiptSchema.optional(),
    report_links: z.array(z.string()).max(10_000).optional(),
  })
  .passthrough();
export type ProgressState = z.infer<typeof ProgressStateSchema>;
export const PreviewSchema = z.object({
  dry_run: z.literal(true),
  body: text,
  report_parts: z.array(z.string()).max(10_000),
  inline: z.array(InlineCommentSchema).max(100),
  approval_decision: ApprovalSchema,
  publication_digest: z.string().regex(/^[a-f0-9]{64}$/),
});
export const PublicationReceiptSchema = z.object({
  status: z.enum(["not_requested", "rendered", "confirmed"]),
  reason: text,
  url: text.optional(),
});
export type PublicationReceipt = z.infer<typeof PublicationReceiptSchema>;
