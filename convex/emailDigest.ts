import { internalAction, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Resend } from "resend";
import { render } from "@react-email/render";
import { DigestEmailTemplate } from "./emailTemplates/DigestEmailTemplate";

// ============================================================
// CONFIG QUERIES + MUTATIONS — Settings UI consumption
// ============================================================

/**
 * getEmailDigestConfig — internalQuery for sendEmailDigest action
 * Returns email-digest-enabled and email-digest-schedule from agentConfigs.
 */
export const getEmailDigestConfig = internalQuery({
  args: {},
  handler: async (ctx) => {
    const enabledRow = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", "email-digest-enabled"))
      .first();
    const scheduleRow = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", "email-digest-schedule"))
      .first();
    return {
      enabled: (enabledRow?.value as boolean) ?? false,
      schedule: (scheduleRow?.value as string) ?? "daily",
    };
  },
});

/**
 * getEmailDigestConfigPublic — public query for Settings UI
 * Same as getEmailDigestConfig but accessible via api.emailDigest.getEmailDigestConfigPublic.
 */
export const getEmailDigestConfigPublic = query({
  args: {},
  handler: async (ctx) => {
    const enabledRow = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", "email-digest-enabled"))
      .first();
    const scheduleRow = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", "email-digest-schedule"))
      .first();
    return {
      enabled: (enabledRow?.value as boolean) ?? false,
      schedule: (scheduleRow?.value as string) ?? "daily",
    };
  },
});

/**
 * setEmailDigestConfig — public mutation for Settings UI
 * Upserts email-digest-enabled and email-digest-schedule in agentConfigs.
 * Follows the upsert pattern from webhookDelivery.ts (query by_key, patch if exists, insert if not).
 */
export const setEmailDigestConfig = mutation({
  args: {
    enabled: v.boolean(),
    schedule: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now() / 1000;

    // Upsert email-digest-enabled
    const enabledRow = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", "email-digest-enabled"))
      .first();
    if (enabledRow) {
      await ctx.db.patch(enabledRow._id, { value: args.enabled, updatedAt: now });
    } else {
      await ctx.db.insert("agentConfigs", {
        configKey: "email-digest-enabled",
        value: args.enabled,
        updatedAt: now,
      });
    }

    // Upsert email-digest-schedule
    const scheduleRow = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", "email-digest-schedule"))
      .first();
    if (scheduleRow) {
      await ctx.db.patch(scheduleRow._id, { value: args.schedule, updatedAt: now });
    } else {
      await ctx.db.insert("agentConfigs", {
        configKey: "email-digest-schedule",
        value: args.schedule,
        updatedAt: now,
      });
    }
  },
});

// ============================================================
// HELPER INTERNAL QUERIES
// ============================================================

/**
 * getRecipientEmail — internalQuery
 * Returns the emailAddress from the first profileConfigs row, or null.
 */
export const getRecipientEmail = internalQuery({
  args: {},
  handler: async (ctx) => {
    const profile = await ctx.db.query("profileConfigs").first();
    return profile?.emailAddress ?? null;
  },
});

/**
 * getActiveAlerts — internalQuery
 * Returns up to 10 unacknowledged alerts for digest email content.
 */
export const getActiveAlerts = internalQuery({
  args: {},
  handler: async (ctx) => {
    const alerts = await ctx.db
      .query("alerts")
      .withIndex("by_acknowledged", (q) => q.eq("acknowledged", false))
      .take(10);
    return alerts.map((a) => ({
      severity: a.severity,
      message: a.message,
      source: a.source,
    }));
  },
});

/**
 * getLatestBriefingNarrative — internalQuery
 * Returns the narrative from the most recent briefing, or empty string.
 */
export const getLatestBriefingNarrative = internalQuery({
  args: {},
  handler: async (ctx) => {
    const briefing = await ctx.db
      .query("briefings")
      .order("desc")
      .first();
    return briefing?.narrative ?? "";
  },
});

// ============================================================
// CORE DELIVERY ACTION
// ============================================================

/**
 * sendEmailDigest — internalAction (cron target)
 * Per D-01, D-02, D-15:
 *   - Fires daily at 06:05 UTC (5 min after generate-daily-digest)
 *   - Wraps generateDailyDigestAction output (sessions, cost, anomalies, briefing, alerts)
 *   - Missing RESEND_API_KEY logs failure without crashing
 *   - Disabled email-digest-enabled config silently skips
 *   - All delivery attempts logged to emailDeliveryLog
 */
export const sendEmailDigest = internalAction({
  args: {},
  handler: async (ctx) => {
    const sentAt = Date.now() / 1000;

    // 1. Guard: API key (D-15) — log and return, do NOT rethrow
    // Note: attempt is always 1 for cron-fired digests — each cron fire is a
    // single delivery attempt with no built-in retry. Multiple attempt-1 entries
    // for the same ruleId on different days are distinct cron fires, not retries.
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(api.deliveryLogs.insertEmailLog, {
        ruleId: "digest",
        attempt: 1,
        status: "failed",
        errorMessage: "RESEND_API_KEY not configured",
        sentAt,
      });
      return;
    }

    // 2. Guard: enabled check — silent skip (not an error)
    const config = await ctx.runQuery(internal.emailDigest.getEmailDigestConfig, {});
    if (!config.enabled) return;

    // 3. Get recipient from profileConfigs.emailAddress
    const recipient = await ctx.runQuery(internal.emailDigest.getRecipientEmail, {});
    if (!recipient) {
      await ctx.runMutation(api.deliveryLogs.insertEmailLog, {
        ruleId: "digest",
        attempt: 1,
        status: "failed",
        errorMessage: "No recipient email configured in profile",
        sentAt,
      });
      return;
    }

    // 4. Gather digest data — reuse getDailyDigestDataInternal (D-02)
    const now = new Date();
    const dayStart =
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;
    const digestData = await ctx.runQuery(
      internal.briefings.getDailyDigestDataInternal,
      { dayStart }
    );
    const date = now.toISOString().slice(0, 10);

    // 5. Get active alerts for email content
    const activeAlerts = await ctx.runQuery(internal.emailDigest.getActiveAlerts, {});

    // 6. Get latest briefing narrative
    const briefingNarrative = await ctx.runQuery(
      internal.emailDigest.getLatestBriefingNarrative,
      {}
    );

    // 7. Render React Email template to HTML
    const html = await render(
      DigestEmailTemplate({
        date,
        sessions: digestData.completedSessions.length,
        totalCostUsd: digestData.totalCost,
        anomalyCount: digestData.anomalyCount,
        activeAlerts: activeAlerts.map((a) => ({
          severity: a.severity,
          message: a.message,
          source: a.source,
        })),
        briefingNarrative,
        findingsCount: digestData.findings.length,
      })
    );

    // 8. Send via Resend — try/catch, never rethrow (D-15)
    const resend = new Resend(apiKey);
    const subject = `CodePulse Daily Digest — ${date}`;

    try {
      const { error } = await resend.emails.send({
        from: "CodePulse <onboarding@resend.dev>",
        to: [recipient],
        subject,
        html,
      });

      await ctx.runMutation(api.deliveryLogs.insertEmailLog, {
        ruleId: "digest",
        attempt: 1,
        status: error ? "failed" : "success",
        errorMessage: error?.message,
        recipient,
        subject,
        sentAt,
      });
    } catch (e: any) {
      await ctx.runMutation(api.deliveryLogs.insertEmailLog, {
        ruleId: "digest",
        attempt: 1,
        status: "failed",
        errorMessage: e.message ?? String(e),
        recipient,
        subject,
        sentAt,
      });
    }
  },
});
