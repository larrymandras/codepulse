import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const recordEvent = mutation({
  args: {
    type: v.string(),
    worktreeId: v.optional(v.string()),
    agentId: v.optional(v.string()),
    branch: v.optional(v.string()),
    baseBranch: v.optional(v.string()),
    proofPassed: v.optional(v.boolean()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("worktreeEvents", {
      ...args,
      sessionId: undefined,
    });
  },
});

export const recentEvents = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("worktreeEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const activeWorktrees = query({
  args: {},
  handler: async (ctx) => {
    // Get all worktree events and compute which are still active
    // (created but not yet cleaned)
    const all = await ctx.db
      .query("worktreeEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .take(500);

    const cleaned = new Set<string>();
    const active: typeof all = [];

    for (const evt of all) {
      const id = evt.worktreeId;
      if (!id) continue;
      if (evt.type === "cleaned") {
        cleaned.add(id);
      } else if (evt.type === "created" && !cleaned.has(id)) {
        active.push(evt);
      }
    }

    return active;
  },
});

export const byAgent = query({
  args: { agentId: v.string(), limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("worktreeEvents")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .order("desc")
      .take(args.limit ?? 50);
  },
});
