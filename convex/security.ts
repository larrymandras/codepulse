import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const recordEvent = mutation({
  args: {
    eventType: v.string(),
    severity: v.string(),
    source: v.string(),
    description: v.string(),
    details: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("securityEvents", {
      eventType: args.eventType,
      severity: args.severity,
      source: args.source,
      description: args.description,
      details: args.details,
      mitigated: false,
      timestamp: Date.now() / 1000,
    });
  },
});

export const recentEvents = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("securityEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .take(50);
  },
});

export const severityCounts = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("securityEvents").order("desc").take(1000);
    const counts: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const e of all) {
      counts[e.severity] = (counts[e.severity] ?? 0) + 1;
    }
    return counts;
  },
});

export const recentByType = query({
  args: { eventType: v.string(), limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("securityEvents")
      .withIndex("by_type", (q) => q.eq("eventType", args.eventType))
      .order("desc")
      .take(args.limit ?? 20);
  },
});

export const rlsStats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db
      .query("securityEvents")
      .withIndex("by_type", (q) => q.eq("eventType", "rls_violation"))
      .order("desc")
      .take(100);

    const crossProfileBlocked = all.length;
    const lastTest = all[0]?.timestamp ?? null;

    return { crossProfileBlocked, lastTest };
  },
});

export const hitlStats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db
      .query("securityEvents")
      .withIndex("by_type", (q) => q.eq("eventType", "hitl_request"))
      .order("desc")
      .take(100);

    const now = Date.now() / 1000;
    const todayStart = now - (now % 86400);

    const pending = all.filter((e) => !e.mitigated).length;
    const resolvedToday = all.filter(
      (e) => e.mitigated && e.resolvedAt && e.resolvedAt >= todayStart
    ).length;

    return { pending, resolvedToday };
  },
});

export const webhookStats = query({
  args: {},
  handler: async (ctx) => {
    const forged = await ctx.db
      .query("securityEvents")
      .withIndex("by_type", (q) => q.eq("eventType", "webhook_forgery"))
      .order("desc")
      .take(100);

    const recent = await ctx.db
      .query("webhookEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .take(50);

    return {
      totalReceived: recent.length,
      forgedBlocked: forged.length,
      lastReceived: recent[0]?.timestamp ?? null,
    };
  },
});

export const vaultStats = query({
  args: {},
  handler: async (ctx) => {
    const vaultEvents = await ctx.db
      .query("securityEvents")
      .withIndex("by_type", (q) => q.eq("eventType", "vault_access"))
      .order("desc")
      .take(50);

    const denied = vaultEvents.filter(
      (e) => e.severity === "high" || e.severity === "critical"
    ).length;
    const lastAccess = vaultEvents[0]?.timestamp ?? null;

    return {
      totalAccesses: vaultEvents.length,
      denied,
      lastAccess,
    };
  },
});
