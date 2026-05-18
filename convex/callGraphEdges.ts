import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ============================================================
// CALL GRAPH EDGES — agent-to-tool dependency tracking (Phase 59)
// ============================================================

export const upsertEdge = mutation({
  args: {
    agentId: v.string(),
    toolName: v.string(),
    sessionId: v.string(),
    success: v.boolean(),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("callGraphEdges")
      .withIndex("by_agent_tool", (q) =>
        q.eq("agentId", args.agentId).eq("toolName", args.toolName)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        sessionId: args.sessionId,
        callCount: existing.callCount + 1,
        lastCallAt: args.timestamp,
        errorCount: args.success ? existing.errorCount : existing.errorCount + 1,
        lastErrorAt: args.success ? existing.lastErrorAt : args.timestamp,
        status: args.success ? "healthy" : "errored",
      });
    } else {
      await ctx.db.insert("callGraphEdges", {
        agentId: args.agentId,
        toolName: args.toolName,
        sessionId: args.sessionId,
        callCount: 1,
        lastCallAt: args.timestamp,
        errorCount: args.success ? 0 : 1,
        lastErrorAt: args.success ? undefined : args.timestamp,
        status: args.success ? "healthy" : "errored",
        archived: undefined,
      });
    }
  },
});

export const listEdges = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("callGraphEdges")
      .withIndex("by_timestamp")
      .order("desc")
      .filter((q) => q.neq(q.field("archived"), true))
      .take(500);
  },
});

export const getBySession = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("callGraphEdges")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .filter((q) => q.neq(q.field("archived"), true))
      .collect();
  },
});
