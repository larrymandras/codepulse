import { query } from "./_generated/server";
import { v } from "convex/values";

export const overview = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db
      .query("episodicEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .take(500);

    const byType: Record<string, number> = {};
    const byAgent: Record<string, number> = {};

    for (const event of all) {
      byType[event.eventType] = (byType[event.eventType] ?? 0) + 1;
      if (event.agentId) {
        byAgent[event.agentId] = (byAgent[event.agentId] ?? 0) + 1;
      }
    }

    return {
      total: all.length,
      byType,
      byAgent,
      recent: all.slice(0, 10),
    };
  },
});

export const search = query({
  args: {
    searchText: v.string(),
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("episodicEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .take(500);

    const needle = args.searchText.toLowerCase();
    const filtered = all.filter(
      (e) =>
        e.summary.toLowerCase().includes(needle) ||
        e.eventType.toLowerCase().includes(needle) ||
        (e.agentId && e.agentId.toLowerCase().includes(needle))
    );

    return filtered.slice(0, args.limit ?? 50);
  },
});

export const timeline = query({
  args: {
    agentId: v.optional(v.string()),
    eventType: v.optional(v.string()),
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    if (args.agentId) {
      const results = await ctx.db
        .query("episodicEvents")
        .withIndex("by_agent", (q) => q.eq("agentId", args.agentId!))
        .order("desc")
        .take(limit);
      if (args.eventType) {
        return results.filter((e) => e.eventType === args.eventType);
      }
      return results;
    }

    if (args.eventType) {
      return await ctx.db
        .query("episodicEvents")
        .withIndex("by_type", (q) => q.eq("eventType", args.eventType!))
        .order("desc")
        .take(limit);
    }

    return await ctx.db
      .query("episodicEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit);
  },
});
