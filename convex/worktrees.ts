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
