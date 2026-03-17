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

// ── Summary (for dashboard cards) ────────────────────────────────

export const cronSummary = query({
  args: {},
  handler: async (ctx) => {
    const oneHourAgo = Date.now() / 1000 - 3600;
    const recent = await ctx.db
      .query("cronExecutions")
      .withIndex("by_timestamp")
      .filter((q) => q.gte(q.field("timestamp"), oneHourAgo))
      .collect();
    const failed = recent.filter((r) => !r.success);
    const avgDurationMs =
      recent.length > 0
        ? recent.reduce((sum, r) => sum + r.durationMs, 0) / recent.length
        : 0;
    return {
      totalJobs: 12,
      totalRuns: recent.length,
      succeeded: recent.length - failed.length,
      failed: failed.length,
      avgDurationMs,
    };
  },
});

// ── Per-job executions ───────────────────────────────────────────

export const cronsByJob = query({
  args: { jobName: v.string(), limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("cronExecutions")
      .withIndex("by_jobName", (q) => q.eq("jobName", args.jobName))
      .order("desc")
      .take(args.limit ?? 10);
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
