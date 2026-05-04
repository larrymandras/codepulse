import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const insert = mutation({
  args: {
    sessionId: v.string(),
    tier: v.string(),
    score: v.float64(),
    signals: v.optional(v.any()),
    model: v.string(),
    fromOverride: v.boolean(),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("complexityAssessments", args);
  },
});
