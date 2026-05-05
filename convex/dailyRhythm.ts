import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsertEntries = mutation({
  args: {
    agentTypeId: v.string(),
    entries: v.array(
      v.object({
        action: v.string(),
        channel: v.string(),
        days: v.string(),
        time: v.string(),
        profileId: v.optional(v.string()),
        category: v.optional(v.string()),
        cronExpression: v.optional(v.string()),
      })
    ),
    syncedAt: v.float64(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("dailyRhythmEntries")
      .withIndex("by_agentType", (q) => q.eq("agentTypeId", args.agentTypeId))
      .collect();
    for (const row of existing) {
      await ctx.db.delete(row._id);
    }
    for (const entry of args.entries) {
      await ctx.db.insert("dailyRhythmEntries", {
        agentTypeId: args.agentTypeId,
        syncedAt: args.syncedAt,
        ...entry,
      });
    }
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("dailyRhythmEntries")
      .withIndex("by_syncedAt")
      .order("desc")
      .take(500);
  },
});
