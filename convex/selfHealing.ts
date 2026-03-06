import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const recordEvent = mutation({
  args: {
    component: v.string(),
    issue: v.string(),
    action: v.string(),
    outcome: v.string(),
    details: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("selfHealingEvents", {
      component: args.component,
      issue: args.issue,
      action: args.action,
      outcome: args.outcome,
      details: args.details,
      timestamp: Date.now() / 1000,
    });
  },
});

export const componentHealth = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("selfHealingEvents").collect();
    const byComponent = new Map<string, (typeof all)[0]>();
    for (const record of all) {
      const existing = byComponent.get(record.component);
      if (!existing || record.timestamp > existing.timestamp) {
        byComponent.set(record.component, record);
      }
    }
    return Array.from(byComponent.values());
  },
});

export const recentRecoveries = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("selfHealingEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit ?? 30);
  },
});

export const uptimeStats = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("selfHealingEvents").collect();
    const resolved = all.filter((e) => e.outcome === "resolved").length;
    const failed = all.filter((e) => e.outcome === "failed").length;
    const pending = all.filter((e) => e.outcome === "pending").length;
    const actionCounts: Record<string, number> = {};
    for (const e of all) {
      actionCounts[e.action] = (actionCounts[e.action] ?? 0) + 1;
    }
    return { total: all.length, resolved, failed, pending, actionCounts };
  },
});

export const listVersions = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("versionHistory")
      .withIndex("by_changedAt")
      .order("desc")
      .take(args.limit ?? 20);
  },
});
