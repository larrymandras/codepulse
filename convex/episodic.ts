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

export const recentEvents = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("episodicEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const byAgent = query({
  args: { agentId: v.string(), limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("episodicEvents")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const prune = internalMutation({
  args: {},
  handler: async (ctx) => {
    const thirtyDaysAgo = Date.now() / 1000 - 30 * 24 * 3600;

    const old = await ctx.db
      .query("episodicEvents")
      .withIndex("by_timestamp")
      .order("asc")
      .take(500);

    let deleted = 0;
    for (const event of old) {
      if (event.timestamp < thirtyDaysAgo) {
        await ctx.db.delete(event._id);
        deleted++;
      } else {
        break; // Sorted asc, so once we hit a recent one we're done
      }
    }

    return { deleted };
  },
});
