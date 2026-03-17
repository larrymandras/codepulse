import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const recordViolation = mutation({
  args: {
    toolName: v.string(),
    permission: v.string(),
    detail: v.optional(v.string()),
    strict: v.boolean(),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("sandboxViolations", args);
  },
});

export const recent = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sandboxViolations")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const byTool = query({
  args: { toolName: v.string(), limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sandboxViolations")
      .withIndex("by_tool", (q) => q.eq("toolName", args.toolName))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const byPermission = query({
  args: { permission: v.string(), limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sandboxViolations")
      .withIndex("by_permission", (q) => q.eq("permission", args.permission))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const overview = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db
      .query("sandboxViolations")
      .withIndex("by_timestamp")
      .order("desc")
      .take(200);

    if (all.length === 0) {
      return {
        totalViolations: 0,
        strictBlocked: 0,
        byTool: {} as Record<string, number>,
        byPermission: {} as Record<string, number>,
        lastViolation: null,
      };
    }

    const strictBlocked = all.filter((e) => e.strict).length;
    const byTool: Record<string, number> = {};
    const byPermission: Record<string, number> = {};
    for (const e of all) {
      byTool[e.toolName] = (byTool[e.toolName] ?? 0) + 1;
      byPermission[e.permission] = (byPermission[e.permission] ?? 0) + 1;
    }

    return {
      totalViolations: all.length,
      strictBlocked,
      byTool,
      byPermission,
      lastViolation: all[0]?.timestamp ?? null,
    };
  },
});
