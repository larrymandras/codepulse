import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const recordAccess = mutation({
  args: {
    toolName: v.string(),
    credentialKey: v.string(),
    agentId: v.optional(v.string()),
    granted: v.boolean(),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("credentialAudit", args);
  },
});

export const recent = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("credentialAudit")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const deniedAccesses = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("credentialAudit")
      .withIndex("by_granted", (q) => q.eq("granted", false))
      .order("desc")
      .take(args.limit ?? 20);
  },
});

export const byTool = query({
  args: { toolName: v.string(), limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("credentialAudit")
      .withIndex("by_tool", (q) => q.eq("toolName", args.toolName))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const overview = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db
      .query("credentialAudit")
      .withIndex("by_timestamp")
      .order("desc")
      .take(200);

    if (all.length === 0) {
      return {
        totalAccesses: 0,
        denied: 0,
        lastAccess: null,
        byTool: {} as Record<string, number>,
      };
    }

    const denied = all.filter((e) => !e.granted).length;
    const byTool: Record<string, number> = {};
    for (const e of all) {
      byTool[e.toolName] = (byTool[e.toolName] ?? 0) + 1;
    }

    return {
      totalAccesses: all.length,
      denied,
      lastAccess: all[0]?.timestamp ?? null,
      byTool,
    };
  },
});
