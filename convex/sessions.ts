import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

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

export const upsertWithStatus = mutation({
  args: {
    sessionId: v.string(),
    status: v.string(),
    model: v.optional(v.string()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        lastEventAt: args.timestamp,
        ...(args.model !== undefined ? { model: args.model } : {}),
      });
    } else {
      await ctx.db.insert("sessions", {
        sessionId: args.sessionId,
        startedAt: args.timestamp,
        lastEventAt: args.timestamp,
        status: args.status,
        model: args.model,
        eventCount: 0,
      });
    }
  },
});

export const listByStatus = query({
  args: { status: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .order("desc")
      .take(50);
  },
});

export const markCompleted = mutation({
  args: {
    sessionId: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
    if (session) {
      await ctx.db.patch(session._id, {
        status: args.status,
        lastEventAt: Date.now() / 1000,
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

export const listAll = query({
  args: {
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("sessions")
      .order("desc")
      .take(limit);
  },
});

export const listPaginated = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_status")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const comparison = query({
  args: {
    sessionIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const results = [];
    for (const sid of args.sessionIds) {
      const session = await ctx.db
        .query("sessions")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", sid))
        .first();
      if (session) {
        const duration = session.lastEventAt - session.startedAt;
        results.push({
          sessionId: session.sessionId,
          model: session.model ?? "unknown",
          eventCount: session.eventCount,
          duration,
          status: session.status,
          startedAt: session.startedAt,
          lastEventAt: session.lastEventAt,
        });
      }
    }
    return results;
  },
});
