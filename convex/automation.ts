import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ── Cron Executions ──────────────────────────────────────────────

export const recordCron = mutation({
  args: {
    jobName: v.string(),
    startedAt: v.float64(),
    durationMs: v.float64(),
    success: v.boolean(),
    error: v.optional(v.string()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("cronExecutions", args);
  },
});

export const recentCrons = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("cronExecutions")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit ?? 50);
  },
});

// ── Heartbeat Alerts ─────────────────────────────────────────────

export const recordHeartbeat = mutation({
  args: {
    alerts: v.any(),
    alertCount: v.float64(),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("heartbeatAlerts", args);
  },
});

export const recentHeartbeats = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("heartbeatAlerts")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit ?? 20);
  },
});

// ── Job Lifecycle ────────────────────────────────────────────────

export const recordJob = mutation({
  args: {
    jobId: v.string(),
    status: v.string(),
    trigger: v.optional(v.string()),
    error: v.optional(v.string()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("jobLifecycle", args);
  },
});

export const recentJobs = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("jobLifecycle")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit ?? 50);
  },
});

// ── Proactive Messages ───────────────────────────────────────────

export const recordProactiveMessage = mutation({
  args: {
    messageType: v.string(),
    channelId: v.optional(v.string()),
    chatId: v.optional(v.string()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("proactiveMessages", args);
  },
});

export const recentProactiveMessages = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("proactiveMessages")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit ?? 50);
  },
});

// ── Subagent Executions ──────────────────────────────────────────

export const recordSubagentExecution = mutation({
  args: {
    agentId: v.string(),
    success: v.boolean(),
    durationMs: v.float64(),
    tokensUsed: v.float64(),
    error: v.optional(v.string()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("subagentExecutions", args);
  },
});

export const recentSubagentExecutions = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subagentExecutions")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit ?? 50);
  },
});

// ── Webhook Events ───────────────────────────────────────────────

export const recordWebhook = mutation({
  args: {
    hookId: v.string(),
    taskId: v.optional(v.string()),
    source: v.optional(v.string()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("webhookEvents", args);
  },
});

export const recentWebhooks = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("webhookEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit ?? 50);
  },
});
