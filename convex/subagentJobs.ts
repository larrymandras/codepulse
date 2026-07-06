import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Phase 168 (background subagents) — background delegate_task job status.
 *
 * Standalone table (NOT an extension of swarmTasks — D-09; /hive semantics
 * stay untouched). Mirrors query-then-insert-or-patch upsert idiom from
 * swarmTasks.ts (Convex has no native upsert).
 *
 * upsert: keyed on `by_jobId` — re-ingest of the same jobId patches the
 *         existing row rather than inserting a duplicate (T-168-14).
 *         `submittedAt` is optional at the mutation-arg level because the
 *         live emitter does not currently populate it (docs/astridr-
 *         contract.md §2.31) — on first insert it falls back to
 *         `finishedAt` or "now" rather than ever being left unset.
 * byId:       returns the subagentJobs row for a given jobId
 * listRecent: returns recent rows across all statuses, newest-first by
 *             submittedAt (scans + sorts, mirrors swarmTasks.goalsByAgent's
 *             "fine at swarm scale" precedent — no dedicated global-recency
 *             index needed at this table's scale)
 */

export const upsert = mutation({
  args: {
    jobId: v.string(),
    agentTypeId: v.string(),
    status: v.string(),
    taskSnippet: v.string(),
    resultSnippet: v.optional(v.string()),
    error: v.optional(v.string()),
    channelId: v.optional(v.string()),
    chatId: v.optional(v.string()),
    submittedAt: v.optional(v.float64()),
    finishedAt: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const now = Date.now() / 1000; // seconds-epoch, matching the contract's submittedAt/finishedAt unit

    const existing = await ctx.db
      .query("subagentJobs")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        agentTypeId: args.agentTypeId,
        status: args.status,
        taskSnippet: args.taskSnippet,
        resultSnippet: args.resultSnippet,
        error: args.error,
        channelId: args.channelId ?? existing.channelId,
        chatId: args.chatId ?? existing.chatId,
        finishedAt: args.finishedAt ?? existing.finishedAt,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("subagentJobs", {
        jobId: args.jobId,
        agentTypeId: args.agentTypeId,
        status: args.status,
        taskSnippet: args.taskSnippet,
        resultSnippet: args.resultSnippet,
        error: args.error,
        channelId: args.channelId,
        chatId: args.chatId,
        submittedAt: args.submittedAt ?? args.finishedAt ?? now,
        finishedAt: args.finishedAt,
        updatedAt: now,
      });
    }
  },
});

export const byId = query({
  args: { jobId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subagentJobs")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .first();
  },
});

export const listRecent = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("subagentJobs").collect();
    return rows.sort((a, b) => b.submittedAt - a.submittedAt).slice(0, 50);
  },
});
