import { query } from "./_generated/server";
import { v } from "convex/values";

export const byExecutionId = query({
  args: {
    executionId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("executionModes")
      .withIndex("by_executionId", (q) => q.eq("executionId", args.executionId))
      .order("desc")
      .take(1);
  },
});

export const recent = query({
  args: {
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("executionModes")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit ?? 50);
  },
});
