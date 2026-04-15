import { query } from "./_generated/server";
import { v } from "convex/values";

export const recent = query({
  args: {
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("conversationImports")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit ?? 20);
  },
});
