import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ---- NEW events table functions ----

export const ingest = mutation({
  args: {
    sessionId: v.string(),
    eventType: v.string(),
    toolName: v.optional(v.string()),
    filePath: v.optional(v.string()),
    payload: v.any(),
    hookType: v.optional(v.string()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("events", {
      sessionId: args.sessionId,
      eventType: args.eventType,
      toolName: args.toolName,
      filePath: args.filePath,
      payload: args.payload,
      hookType: args.hookType,
      timestamp: args.timestamp,
    });
  },
});

export const listRecent = query({
  args: {
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("events")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit);
  },
});

export const listBySession = query({
  args: {
    sessionId: v.string(),
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("events")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(limit);
  },
});

export const listByTool = query({
  args: {
    toolName: v.string(),
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("events")
      .withIndex("by_tool", (q) => q.eq("toolName", args.toolName))
      .order("desc")
      .take(limit);
  },
});

export const listBashCommands = query({
  args: {
    sessionId: v.string(),
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("events")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .filter((q) => q.eq(q.field("toolName"), "Bash"))
      .take(limit);
  },
});

export const listErrors = query({
  args: {
    sessionId: v.string(),
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const events = await ctx.db
      .query("events")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .collect();
    return events.filter((e) => e.eventType === "Error" || e.eventType === "ToolError").slice(0, limit);
  },
});

export const listPrompts = query({
  args: {
    sessionId: v.string(),
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const events = await ctx.db
      .query("events")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .collect();
    return events.filter((e) => e.eventType.includes("Prompt") || e.eventType === "UserPrompt").slice(0, limit);
  },
});

// ---- LEGACY runtime_events functions (kept for backward compat) ----

export const insertEvent = mutation({
  args: {
    eventType: v.string(),
    data: v.any(),
    timestamp: v.float64(),
    critical: v.boolean(),
    receivedAt: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("runtime_events", {
      eventType: args.eventType,
      data: args.data,
      timestamp: args.timestamp,
      critical: args.critical,
      receivedAt: args.receivedAt,
    });
  },
});

export const listByType = query({
  args: {
    eventType: v.string(),
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("runtime_events")
      .withIndex("by_type", (q) => q.eq("eventType", args.eventType))
      .order("desc")
      .take(limit);
  },
});

export const listCritical = query({
  args: {
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("runtime_events")
      .withIndex("by_critical", (q) => q.eq("critical", true))
      .order("desc")
      .take(limit);
  },
});

export const countByType = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("runtime_events").collect();
    const counts: Record<string, number> = {};
    for (const event of all) {
      counts[event.eventType] = (counts[event.eventType] ?? 0) + 1;
    }
    return counts;
  },
});
