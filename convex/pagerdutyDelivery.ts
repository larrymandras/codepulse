import { internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

// PagerDuty Events API v2 endpoint — hardcoded constant, never from user input (T-70-03)
const PAGERDUTY_ENDPOINT = "https://events.pagerduty.com/v2/enqueue";

// ============================================================
// TRIGGER — fire a PagerDuty incident (D-05, D-06)
// ============================================================

export const sendPagerdutyAlert = internalAction({
  args: {
    alertId: v.id("alerts"),
    ruleId: v.string(),
    attempt: v.float64(),
  },
  handler: async (ctx, args) => {
    const sentAt = Date.now() / 1000;

    // 1. Load alert
    const alert = await ctx.runQuery(internal.pagerdutyDelivery.getAlertById, {
      id: args.alertId,
    });
    if (!alert) return;

    // 2. Load custom rule to get pagerdutyConfig
    const rule = await ctx.runQuery(internal.pagerdutyDelivery.getCustomRuleById, {
      id: args.ruleId,
    });
    if (!rule?.pagerdutyConfig?.enabled) return; // not configured — silent skip
    if (!rule.pagerdutyConfig.routingKey) return; // no routing key — silent skip

    // 3. Build payload (D-05: dedup_key = codepulse-{ruleId}, D-06: severity from rule with per-rule override)
    const dedupKey = `codepulse-${args.ruleId}`;
    const payload = {
      routing_key: rule.pagerdutyConfig.routingKey,
      event_action: "trigger" as const,
      dedup_key: dedupKey,
      payload: {
        summary: ((alert.message ?? "CodePulse alert triggered") as string).slice(0, 1024),
        source: "CodePulse",
        severity: rule.pagerdutyConfig.severity ?? (alert.severity as string) ?? "warning",
        timestamp: new Date(((alert.createdAt ?? sentAt) as number) * 1000).toISOString(),
        component: (rule.name ?? args.ruleId) as string,
        group: "codepulse-alerts",
        custom_details: {
          alertId: args.alertId,
          ruleId: args.ruleId,
        },
      },
      client: "CodePulse",
      client_url: "https://codepulse.app/alerts",
    };

    // 4. Send to PagerDuty Events API v2 — try/catch, never rethrow
    try {
      const res = await fetch(PAGERDUTY_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const status = res.ok ? "success" : "failed";
      const errorMessage = res.ok
        ? undefined
        : `HTTP ${res.status}: ${await res.text().catch(() => "unknown")}`;

      await ctx.runMutation(api.deliveryLogs.insertPagerdutyLog, {
        alertId: args.alertId,
        ruleId: args.ruleId,
        attempt: args.attempt,
        status,
        errorMessage,
        dedupKey,
        action: "trigger",
        sentAt,
      });
    } catch (e: any) {
      await ctx.runMutation(api.deliveryLogs.insertPagerdutyLog, {
        alertId: args.alertId,
        ruleId: args.ruleId,
        attempt: args.attempt,
        status: "failed",
        errorMessage: e.message ?? String(e),
        dedupKey,
        action: "trigger",
        sentAt,
      });
    }
  },
});

// ============================================================
// RESOLVE — resolve a PagerDuty incident (D-07)
// Same dedup_key as trigger — PagerDuty dedup is idempotent
// ============================================================

export const sendPagerdutyResolve = internalAction({
  args: {
    alertId: v.id("alerts"),
    ruleId: v.string(),
  },
  handler: async (ctx, args) => {
    const sentAt = Date.now() / 1000;

    const rule = await ctx.runQuery(internal.pagerdutyDelivery.getCustomRuleById, {
      id: args.ruleId,
    });
    if (!rule?.pagerdutyConfig?.enabled) return; // not configured — silent skip
    if (!rule.pagerdutyConfig.routingKey) return; // no routing key — silent skip

    const dedupKey = `codepulse-${args.ruleId}`;

    try {
      const res = await fetch(PAGERDUTY_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routing_key: rule.pagerdutyConfig.routingKey,
          event_action: "resolve",
          dedup_key: dedupKey,
        }),
      });
      const status = res.ok ? "resolved" : "failed";
      const errorMessage = res.ok ? undefined : `HTTP ${res.status}`;

      await ctx.runMutation(api.deliveryLogs.insertPagerdutyLog, {
        alertId: args.alertId,
        ruleId: args.ruleId,
        attempt: 1,
        status,
        errorMessage,
        dedupKey,
        action: "resolve",
        sentAt,
      });
    } catch (e: any) {
      await ctx.runMutation(api.deliveryLogs.insertPagerdutyLog, {
        alertId: args.alertId,
        ruleId: args.ruleId,
        attempt: 1,
        status: "failed",
        errorMessage: e.message ?? String(e),
        dedupKey,
        action: "resolve",
        sentAt,
      });
    }
  },
});

// ============================================================
// HELPER INTERNAL QUERIES
// ============================================================

export const getAlertById = internalQuery({
  args: { id: v.id("alerts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getCustomRuleById = internalQuery({
  args: { id: v.string() },
  handler: async (ctx, args): Promise<any> => {
    // Custom rule IDs are Convex document IDs stored as strings
    // Returns alertRuleCustom document or null
    try {
      const doc = await ctx.db.get(args.id as any);
      return doc ?? null;
    } catch {
      return null;
    }
  },
});
