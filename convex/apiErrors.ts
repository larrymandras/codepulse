import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const insert = mutation({
  args: {
    sessionId: v.string(),
    model: v.optional(v.string()),
    errorMessage: v.string(),
    statusCode: v.optional(v.string()),
    durationMs: v.optional(v.float64()),
    attempt: v.optional(v.float64()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("apiErrors", args);
  },
});

export const recent = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("apiErrors")
      .withIndex("by_timestamp")
      .order("desc")
      .take(50);
  },
});

export const byStatusCode = query({
  args: {},
  handler: async (ctx) => {
    const errors = await ctx.db
      .query("apiErrors")
      .withIndex("by_timestamp")
      .order("desc")
      .collect();

    const counts: Record<string, number> = {};
    for (const e of errors) {
      const code = e.statusCode ?? "unknown";
      counts[code] = (counts[code] ?? 0) + 1;
    }

    return Object.entries(counts)
      .map(([statusCode, count]) => ({ statusCode, count }))
      .sort((a, b) => b.count - a.count);
  },
});
