import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ============================================================
// PUBLIC QUERIES + MUTATIONS — Settings page consumption
// ============================================================

/**
 * getChannels — public query for Settings UI
 * Returns stored webhook URLs for Discord and Slack.
 */
export const getChannels = query({
  args: {},
  handler: async (ctx) => {
    const discordRow = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", "webhook-discord-url"))
      .first();
    const slackRow = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", "webhook-slack-url"))
      .first();
    return {
      discordUrl: (discordRow?.value as string) ?? null,
      slackUrl: (slackRow?.value as string) ?? null,
    };
  },
});

/**
 * setChannel — public mutation for Settings UI
 * Upserts a webhook URL for the given channel ("discord" or "slack").
 * T-06-09 mitigation: validates URL starts with https://
 */
export const setChannel = mutation({
  args: {
    channel: v.string(),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.url.startsWith("https://")) {
      throw new Error(
        "Invalid webhook URL. Paste a full Discord or Slack webhook URL starting with https://."
      );
    }
    const configKey = `webhook-${args.channel}-url`;
    const existing = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", configKey))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.url,
        updatedAt: Date.now() / 1000,
      });
    } else {
      await ctx.db.insert("agentConfigs", {
        configKey,
        value: args.url,
        updatedAt: Date.now() / 1000,
      });
    }
  },
});

/**
 * removeChannel — public mutation for Settings UI
 * Deletes the agentConfigs record for the given webhook channel.
 */
export const removeChannel = mutation({
  args: {
    channel: v.string(),
  },
  handler: async (ctx, args) => {
    const configKey = `webhook-${args.channel}-url`;
    const existing = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", configKey))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

/**
 * testWebhook — public action for Settings UI
 * Sends a test message to the stored webhook URL for the given channel.
 * Returns { success: boolean, error?: string }
 */
export const testWebhook = action({
  args: {
    channel: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const channels = await ctx.runQuery(
      internal.webhookDelivery.getNotificationChannels,
      {}
    );
    const url =
      args.channel === "discord" ? channels.discordUrl : channels.slackUrl;

    if (!url) {
      return { success: false, error: "No webhook URL configured" };
    }
    if (!url.startsWith("https://")) {
      return {
        success: false,
        error:
          "Invalid webhook URL. Paste a full Discord or Slack webhook URL starting with https://.",
      };
    }

    try {
      let payload: object;
      if (args.channel === "discord") {
        payload = {
          embeds: [
            {
              title: "CodePulse Test Alert",
              description:
                "This is a test message from CodePulse. Your Discord webhook is configured correctly.",
              color: 5592575,
              footer: { text: "CodePulse Alert Routing" },
              timestamp: new Date().toISOString(),
            },
          ],
        };
      } else {
        payload = {
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "*CodePulse Test Alert*\nThis is a test message from CodePulse. Your Slack webhook is configured correctly.",
              },
            },
          ],
        };
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        return { success: true };
      } else {
        const text = await res.text().catch(() => String(res.status));
        return {
          success: false,
          error: `Webhook responded with ${res.status}: ${text.slice(0, 200)}`,
        };
      }
    } catch (e: unknown) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  },
});

/**
 * getPreferences — public query for Settings UI
 * Returns stored notification preferences or defaults.
 */
export const getPreferences = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", "notification-preferences"))
      .first();
    return (
      (row?.value as Record<string, string>) ?? {
        critical: "always",
        error: "always",
        warning: "digest",
        info: "dashboard_only",
      }
    );
  },
});

const VALID_MODES = ["always", "digest", "dashboard_only", "disabled"] as const;

/**
 * setPreferences — public mutation for Settings UI
 * Validates and upserts per-severity delivery mode preferences.
 */
export const setPreferences = mutation({
  args: {
    preferences: v.object({
      critical: v.string(),
      error: v.string(),
      warning: v.string(),
      info: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    for (const [key, val] of Object.entries(args.preferences)) {
      if (!VALID_MODES.includes(val as (typeof VALID_MODES)[number])) {
        throw new Error(
          `Invalid delivery mode "${val}" for severity "${key}". Must be one of: always, digest, dashboard_only, disabled`
        );
      }
    }
    const configKey = "notification-preferences";
    const existing = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", configKey))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.preferences,
        updatedAt: Date.now() / 1000,
      });
    } else {
      await ctx.db.insert("agentConfigs", {
        configKey,
        value: args.preferences,
        source: "dashboard",
        updatedAt: Date.now() / 1000,
      });
    }
  },
});

// ============================================================
// SEVERITY MAPPINGS
// ============================================================

export function buildDiscordPayload(alert: {
  message: string;
  severity: string;
  source: string;
  createdAt: number;
}) {
  const colorMap: Record<string, number> = {
    critical: 16711680,
    error: 16744192,
    warning: 16776960,
    info: 5592575,
  };
  return {
    embeds: [
      {
        title: alert.message.slice(0, 1000),
        color: colorMap[alert.severity] ?? 5592575,
        fields: [
          { name: "Severity", value: alert.severity, inline: true },
          { name: "Rule", value: alert.source, inline: true },
          {
            name: "Triggered",
            value: new Date(alert.createdAt * 1000).toISOString(),
            inline: false,
          },
        ],
        url: "https://codepulse.app/alerts",
        footer: { text: "CodePulse Alert Routing" },
        timestamp: new Date(alert.createdAt * 1000).toISOString(),
      },
    ],
  };
}

export function buildSlackPayload(alert: {
  message: string;
  severity: string;
  source: string;
  createdAt: number;
}) {
  const emojiMap: Record<string, string> = {
    critical: "🔴",
    error: "🟠",
    warning: "🟡",
    info: "🔵",
  };
  return {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${emojiMap[alert.severity] ?? "⚪"} ${alert.message.slice(0, 1000)}*`,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Severity:* ${alert.severity}` },
          { type: "mrkdwn", text: `*Rule:* ${alert.source}` },
          {
            type: "mrkdwn",
            text: `*Triggered:* <!date^${Math.floor(alert.createdAt)}^{date_short_pretty} {time}|${new Date(alert.createdAt * 1000).toISOString()}>`,
          },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "View in CodePulse" },
            url: "https://codepulse.app/alerts",
          },
        ],
      },
    ],
  };
}

// ============================================================
// INTERNAL QUERIES — notification config helpers
// ============================================================

export const getNotificationChannels = internalQuery({
  args: {},
  handler: async (ctx) => {
    const discordRow = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", "webhook-discord-url"))
      .first();
    const slackRow = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", "webhook-slack-url"))
      .first();
    return {
      discordUrl: (discordRow?.value as string) ?? null,
      slackUrl: (slackRow?.value as string) ?? null,
    };
  },
});

export const getNotificationPreferences = internalQuery({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", "notification-preferences"))
      .first();
    return (
      (row?.value as Record<string, string>) ?? {
        critical: "always",
        error: "always",
        warning: "digest",
        info: "dashboard_only",
      }
    );
  },
});

export const getDigestInterval = internalQuery({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", "digest-interval"))
      .first();
    return (row?.value as string) ?? "1h";
  },
});

// ============================================================
// INTERNAL MUTATIONS — logging
// ============================================================

export const logDeliveryAttempt = internalMutation({
  args: {
    alertId: v.id("alerts"),
    channel: v.string(),
    attempt: v.float64(),
    status: v.string(),
    statusCode: v.optional(v.float64()),
    errorMessage: v.optional(v.string()),
    sentAt: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("webhookDeliveryLog", {
      alertId: args.alertId,
      channel: args.channel,
      attempt: args.attempt,
      status: args.status,
      statusCode: args.statusCode,
      errorMessage: args.errorMessage,
      sentAt: args.sentAt,
    });
  },
});

// ============================================================
// RETRY DELAYS
// ============================================================

const RETRY_DELAYS = [5000, 30000, 120000];

// ============================================================
// SEND ALERT WEBHOOK — internalAction (per D-07, D-08)
// ============================================================

export const sendAlertWebhook = internalAction({
  args: {
    alertId: v.id("alerts"),
    attempt: v.float64(),
  },
  handler: async (ctx, args) => {
    // 1. Load alert
    const alert = await ctx.runQuery(internal.alerts.getById, {
      id: args.alertId,
    });
    if (!alert) return;

    // 2. Load channels
    const channels = await ctx.runQuery(
      internal.webhookDelivery.getNotificationChannels,
      {}
    );

    // 3. Load preferences
    const prefs = await ctx.runQuery(
      internal.webhookDelivery.getNotificationPreferences,
      {}
    );

    // 4. Check mute
    const muted = await ctx.runQuery(internal.alertMutes.isTargetMuted, {
      targetType: "alert",
      targetId: args.alertId,
    });
    if (muted) return;

    // 5. Check delivery mode
    const mode = prefs[alert.severity] ?? "always";
    if (mode === "dashboard_only" || mode === "disabled" || mode === "digest") {
      return;
    }

    const sentAt = Date.now() / 1000;
    let deliveryError: string | undefined;
    let success = false;

    try {
      // Send to Discord
      if (channels.discordUrl) {
        // T-06-05: Validate URL is HTTPS before sending
        if (!channels.discordUrl.startsWith("https://")) {
          throw new Error("Discord webhook URL must use HTTPS");
        }
        const discordPayload = buildDiscordPayload({
          message: alert.message,
          severity: alert.severity,
          source: alert.source,
          createdAt: alert.createdAt,
        });
        const discordRes = await fetch(channels.discordUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(discordPayload),
        });
        await ctx.runMutation(internal.webhookDelivery.logDeliveryAttempt, {
          alertId: args.alertId,
          channel: "discord",
          attempt: args.attempt,
          status: discordRes.ok ? "delivered" : "failed",
          statusCode: discordRes.status,
          sentAt,
        });
        if (!discordRes.ok) {
          throw new Error(`Discord responded with ${discordRes.status}`);
        }
      }

      // Send to Slack
      if (channels.slackUrl) {
        // T-06-05: Validate URL is HTTPS before sending
        if (!channels.slackUrl.startsWith("https://")) {
          throw new Error("Slack webhook URL must use HTTPS");
        }
        const slackPayload = buildSlackPayload({
          message: alert.message,
          severity: alert.severity,
          source: alert.source,
          createdAt: alert.createdAt,
        });
        const slackRes = await fetch(channels.slackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(slackPayload),
        });
        await ctx.runMutation(internal.webhookDelivery.logDeliveryAttempt, {
          alertId: args.alertId,
          channel: "slack",
          attempt: args.attempt,
          status: slackRes.ok ? "delivered" : "failed",
          statusCode: slackRes.status,
          sentAt,
        });
        if (!slackRes.ok) {
          throw new Error(`Slack responded with ${slackRes.status}`);
        }
      }

      success = true;
    } catch (e: any) {
      deliveryError = e.message ?? String(e);
    }

    if (success) {
      await ctx.runMutation(internal.alerts.updateWebhookStatus, {
        id: args.alertId,
        status: "delivered",
        deliveredAt: sentAt,
      });
    } else {
      // Retry or mark failed
      if (args.attempt < 3) {
        await ctx.scheduler.runAfter(
          RETRY_DELAYS[args.attempt - 1],
          internal.webhookDelivery.sendAlertWebhook,
          { alertId: args.alertId, attempt: args.attempt + 1 }
        );
      } else {
        await ctx.runMutation(internal.alerts.updateWebhookStatus, {
          id: args.alertId,
          status: "failed",
          attempts: args.attempt,
        });
      }
      // Log final error
      await ctx.runMutation(internal.webhookDelivery.logDeliveryAttempt, {
        alertId: args.alertId,
        channel: "error",
        attempt: args.attempt,
        status: "failed",
        errorMessage: deliveryError,
        sentAt,
      });
    }
  },
});

// ============================================================
// SEND DIGEST — internalAction (per D-15)
// ============================================================

export const sendDigest = internalAction({
  args: {},
  handler: async (ctx) => {
    const channels = await ctx.runQuery(
      internal.webhookDelivery.getNotificationChannels,
      {}
    );
    if (!channels.discordUrl && !channels.slackUrl) return;

    const prefs = await ctx.runQuery(
      internal.webhookDelivery.getNotificationPreferences,
      {}
    );
    const interval = await ctx.runQuery(
      internal.webhookDelivery.getDigestInterval,
      {}
    );

    // Check alignment: cron runs hourly, but digest fires only at matching interval
    const nowUtc = new Date();
    const hourUtc = nowUtc.getUTCHours();
    if (interval === "4h" && hourUtc % 4 !== 0) return;
    if (interval === "daily" && hourUtc !== 0) return;
    // "1h" fires every hour — always proceed

    // Determine lookback window based on interval
    const intervalSeconds: Record<string, number> = {
      "1h": 3600,
      "4h": 14400,
      daily: 86400,
    };
    const windowSeconds = intervalSeconds[interval] ?? 3600;
    const since = Date.now() / 1000 - windowSeconds;

    // Query alerts in the digest window
    const allAlerts = await ctx.runQuery(internal.webhookDelivery.getDigestAlerts, {
      since,
    });

    // Filter to digest-mode severities only
    const digestSeverities = Object.entries(prefs)
      .filter(([, mode]) => mode === "digest")
      .map(([sev]) => sev);

    const digestAlerts = allAlerts.filter((a) =>
      digestSeverities.includes(a.severity)
    );

    if (digestAlerts.length === 0) return;

    // Group by severity, cap at 20 total
    const capped = digestAlerts.slice(0, 20);
    const grouped: Record<string, typeof capped> = {};
    for (const a of capped) {
      if (!grouped[a.severity]) grouped[a.severity] = [];
      grouped[a.severity].push(a);
    }

    // Build Discord digest embed
    if (channels.discordUrl && channels.discordUrl.startsWith("https://")) {
      const fields = Object.entries(grouped).flatMap(([sev, alerts]) =>
        alerts.map((a) => ({
          name: `[${sev.toUpperCase()}] ${a.source}`,
          value: a.message.slice(0, 1000),
          inline: false,
        }))
      );

      const discordPayload = {
        embeds: [
          {
            title: `CodePulse Alert Digest — ${capped.length} alerts`,
            color: 5592575,
            fields,
            footer: { text: `Digest interval: ${interval}` },
            timestamp: new Date().toISOString(),
          },
        ],
      };

      await fetch(channels.discordUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(discordPayload),
      });
    }

    // Build Slack digest
    if (channels.slackUrl && channels.slackUrl.startsWith("https://")) {
      const textLines = Object.entries(grouped).flatMap(([sev, alerts]) =>
        alerts.map(
          (a) => `• *[${sev.toUpperCase()}]* ${a.source}: ${a.message.slice(0, 1000)}`
        )
      );

      const slackPayload = {
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*CodePulse Alert Digest — ${capped.length} alerts*\n${textLines.join("\n")}`,
            },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: { type: "plain_text", text: "View All Alerts" },
                url: "https://codepulse.app/alerts",
              },
            ],
          },
        ],
      };

      await fetch(channels.slackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slackPayload),
      });
    }

    // Update last-digest-at
    await ctx.runMutation(internal.webhookDelivery.updateLastDigestAt, {
      timestamp: Date.now() / 1000,
    });
  },
});

// ============================================================
// DIGEST HELPERS — internalQuery + internalMutation
// ============================================================

export const getDigestAlerts = internalQuery({
  args: {
    since: v.float64(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("alerts")
      .withIndex("by_acknowledged", (q) => q.eq("acknowledged", false))
      .filter((q) => q.gte(q.field("createdAt"), args.since))
      .order("desc")
      .take(100);
  },
});

export const updateLastDigestAt = internalMutation({
  args: { timestamp: v.float64() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", "last-digest-at"))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { value: args.timestamp });
    } else {
      await ctx.db.insert("agentConfigs", {
        configKey: "last-digest-at",
        value: args.timestamp,
        updatedAt: args.timestamp,
      });
    }
  },
});
