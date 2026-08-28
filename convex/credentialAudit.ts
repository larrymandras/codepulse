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
