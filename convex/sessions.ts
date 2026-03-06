import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsert = mutation({
  args: {
    sessionId: v.string(),
    cwd: v.optional(v.string()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    const now = Date.now() / 1000;

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastEventAt: now,
        eventCount: existing.eventCount + 1,
        ...(args.cwd !== undefined ? { cwd: args.cwd } : {}),
        ...(args.model !== undefined ? { model: args.model } : {}),
      });
    } else {
      await ctx.db.insert("sessions", {
        sessionId: args.sessionId,
        startedAt: now,
        lastEventAt: now,
        status: "active",
        cwd: args.cwd,
        model: args.model,
        eventCount: 1,
      });
    }
  },
});

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .order("desc")
      .take(20);
  },
});

export const getById = query({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
  },
});
