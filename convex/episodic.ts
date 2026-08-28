import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const recordEvent = mutation({
  args: {
    agentId: v.optional(v.string()),
    eventType: v.string(),
    summary: v.string(),
    detail: v.optional(v.any()),
    occurredAt: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("episodicEvents", {
      agentId: args.agentId,
      eventType: args.eventType,
      summary: args.summary,
      detail: args.detail,
      occurredAt: args.occurredAt,
      timestamp: Date.now() / 1000,
    });
  },
});
