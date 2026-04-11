import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const record = mutation({
  args: {
    sessionId: v.string(),
    blocks: v.array(v.any()),
    roundNum: v.optional(v.float64()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("run_blocks", {
      sessionId: args.sessionId,
      blocks: args.blocks,
      roundNum: args.roundNum,
      timestamp: args.timestamp,
    });
  },
});

/**
 * listSessions — returns up to 20 distinct session IDs with their latest
 * timestamp, ordered newest first.
 */
export const listSessions = query({
  args: {},
  handler: async (ctx) => {
    const blocks = await ctx.db
      .query("run_blocks")
      .withIndex("by_timestamp")
      .order("desc")
      .take(200);

    const sessions = new Map<string, number>();
    for (const b of blocks) {
      if (!sessions.has(b.sessionId)) {
        sessions.set(b.sessionId, b.timestamp);
      }
    }

    return Array.from(sessions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([sessionId, timestamp]) => ({ sessionId, timestamp }));
  },
});

/**
 * getBySession — returns all block records for a session, ordered by timestamp asc.
 */
export const getBySession = query({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    return await ctx.db
      .query("run_blocks")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .order("asc")
      .collect();
  },
});
