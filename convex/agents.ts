import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const register = mutation({
  args: {
    sessionId: v.string(),
    agentId: v.string(),
    parentAgentId: v.optional(v.string()),
    agentType: v.string(),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("agents", {
      sessionId: args.sessionId,
      agentId: args.agentId,
      parentAgentId: args.parentAgentId,
      agentType: args.agentType,
      status: "running",
      startedAt: Date.now() / 1000,
      model: args.model,
    });
  },
});

export const updateStatus = mutation({
  args: {
    agentId: v.string(),
    status: v.string(),
    endedAt: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.agentId))
      .first();

    if (agent) {
      await ctx.db.patch(agent._id, {
        status: args.status,
        endedAt: args.endedAt,
      });
    }
  },
});

export const listRunning = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("agents")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .take(50);
  },
});

export const topology = query({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agents")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("agents")
      .order("desc")
      .take(200);
  },
});

export const detail = query({
  args: { agentId: v.string() },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.agentId))
      .first();
    if (!agent) return null;

    // Get coordination events involving this agent
    const outgoing = await ctx.db
      .query("agentCoordination")
      .withIndex("by_fromAgent", (q) => q.eq("fromAgent", args.agentId))
      .order("desc")
      .take(20);
    const incoming = await ctx.db
      .query("agentCoordination")
      .withIndex("by_toAgent", (q) => q.eq("toAgent", args.agentId))
      .order("desc")
      .take(20);

    // Get event count for this agent's session
    const sessionEvents = await ctx.db
      .query("events")
      .withIndex("by_session", (q) => q.eq("sessionId", agent.sessionId))
      .take(500);

    return {
      ...agent,
      coordination: [...outgoing, ...incoming]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 30),
      eventCount: sessionEvents.length,
    };
  },
});
