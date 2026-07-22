import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

// ---- Archival cron (called daily at 02:00 UTC) ----
export const markStaleArchived = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Read threshold from agentConfigs
    const config = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", "retention_days"))
      .first();
    const retentionDays = config?.value != null ? Number(config.value) : 30;
    const cutoff = Date.now() / 1000 - retentionDays * 86400;

    const tables = ["events", "runtime_events", "llmMetrics", "toolExecutions", "agentMetrics", "emailDeliveryLog", "pagerdutyDeliveryLog", "githubTriggerLog"] as const;
    for (const table of tables) {
      // events' timestamp index was rebuilt as by_timestamp2 (2026-07-21
      // tombstone incident — see schema.ts); the other tables keep by_timestamp.
      const byTimestamp = table === "events" ? "by_timestamp2" : "by_timestamp";
      const stale = await ctx.db
        .query(table)
        .withIndex(byTimestamp as any, (q: any) => q.lt("timestamp", cutoff))
        .filter((q) => q.neq(q.field("archived"), true))
        .take(500);
      for (const row of stale) {
        await ctx.db.patch(row._id, { archived: true });
      }
    }
  },
});

// ---- Retention config management ----
export const setRetentionDays = mutation({
  args: { days: v.float64() },
  handler: async (ctx, args) => {
    // CPHLTH-01: Require authenticated Clerk identity — this mutation changes data retention policy.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");

    // Clamp to 1-365 range per T-05-01 / T-05-02
    const clamped = Math.max(1, Math.min(365, Math.round(args.days)));

    const existing = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", "retention_days"))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: clamped,
        updatedAt: Date.now() / 1000,
      });
    } else {
      await ctx.db.insert("agentConfigs", {
        configKey: "retention_days",
        value: clamped,
        source: "runtime",
        updatedAt: Date.now() / 1000,
      });
    }
    return { days: clamped };
  },
});

export const getRetentionDays = query({
  args: {},
  handler: async (ctx) => {
    const config = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", "retention_days"))
      .first();
    return config?.value != null ? Number(config.value) : 30;
  },
});
