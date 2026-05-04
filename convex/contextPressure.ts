import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const insert = mutation({
  args: {
    sessionId: v.string(),
    fillPercent: v.float64(),
    tokensUsed: v.float64(),
    tokensMax: v.float64(),
    turnDelta: v.float64(),
    avgPerTurn: v.float64(),
    thresholdCrossed: v.boolean(),
    systemPromptOverhead: v.optional(v.float64()),
    turnNumber: v.optional(v.float64()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("contextPressure", args);
  },
});

/**
 * Fetch the latest context_pressure event for the most recent active session.
 * If no active session exists, returns the latest event from any session (stale).
 */
export const latestForActiveSession = query({
  args: {},
  handler: async (ctx) => {
    // Find active session
    const activeSession = await ctx.db
      .query("sessions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .order("desc")
      .first();

    if (activeSession) {
      const latest = await ctx.db
        .query("contextPressure")
        .withIndex("by_session", (q) => q.eq("sessionId", activeSession.sessionId))
        .order("desc")
        .first();
      if (latest) return { ...latest, stale: false };
    }

    // Fallback: latest from any session (stale indicator)
    const fallback = await ctx.db
      .query("contextPressure")
      .withIndex("by_timestamp")
      .order("desc")
      .first();
    return fallback ? { ...fallback, stale: true } : null;
  },
});

/** Recent history for sparkline (last 20 entries for active session). */
export const historyForActiveSession = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    const activeSession = await ctx.db
      .query("sessions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .order("desc")
      .first();
    if (!activeSession) return [];
    const rows = await ctx.db
      .query("contextPressure")
      .withIndex("by_session", (q) => q.eq("sessionId", activeSession.sessionId))
      .order("desc")
      .take(args.limit ?? 20);
    return rows;
  },
});
