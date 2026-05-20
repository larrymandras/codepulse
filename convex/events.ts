import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

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
      .filter((q) => q.neq(q.field("archived"), true))
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
      .filter((q) => q.neq(q.field("archived"), true))
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
      .filter((q) => q.neq(q.field("archived"), true))
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
      .filter((q) => q.and(
        q.eq(q.field("toolName"), "Bash"),
        q.neq(q.field("archived"), true)
      ))
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
      .filter((q) => q.neq(q.field("archived"), true))
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
      .filter((q) => q.neq(q.field("archived"), true))
      .collect();
    return events.filter((e) => e.eventType.includes("Prompt") || e.eventType === "UserPrompt").slice(0, limit);
  },
});

export const listRecentPaginated = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("events")
      .withIndex("by_timestamp")
      .order("desc")
      .filter((q) => q.neq(q.field("archived"), true))
      .paginate(args.paginationOpts);
  },
});

export const listRecentUnified = query({
  args: {
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const fetchCount = Math.max(limit, 100);

    const buildEvents = await ctx.db
      .query("events")
      .withIndex("by_timestamp")
      .order("desc")
      .filter((q) => q.neq(q.field("archived"), true))
      .take(fetchCount);

    const runtimeEvents = await ctx.db
      .query("runtime_events")
      .withIndex("by_timestamp")
      .order("desc")
      .filter((q) => q.neq(q.field("archived"), true))
      .take(fetchCount);

    const unified = [
      ...buildEvents.map((e) => ({
        _id: e._id,
        eventType: e.eventType,
        toolName: e.toolName,
        sessionId: e.sessionId,
        timestamp: e.timestamp,
        source: "build" as const,
      })),
      ...runtimeEvents.map((e) => ({
        _id: e._id,
        eventType: e.eventType,
        toolName: (e.data as any)?.toolName ?? (e.data as any)?.tool_name,
        sessionId: (e.data as any)?.session_id ?? (e.data as any)?.sessionId,
        timestamp: e.timestamp,
        source: "runtime" as const,
      })),
    ];

    unified.sort((a, b) => b.timestamp - a.timestamp);
    return unified.slice(0, limit);
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
      .filter((q) => q.neq(q.field("archived"), true))
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
      .filter((q) => q.neq(q.field("archived"), true))
      .take(limit);
  },
});

export const listRecentRuntimePaginated = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("runtime_events")
      .withIndex("by_timestamp")
      .order("desc")
      .filter((q) => q.neq(q.field("archived"), true))
      .paginate(args.paginationOpts);
  },
});

export const countByType = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("runtime_events")
      .filter((q) => q.neq(q.field("archived"), true))
      .collect();
    const counts: Record<string, number> = {};
    for (const event of all) {
      counts[event.eventType] = (counts[event.eventType] ?? 0) + 1;
    }
    return counts;
  },
});
