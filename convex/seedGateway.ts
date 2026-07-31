import { internalMutation, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { GATEWAY_PROVIDERS } from "./lib/providers";

// NOT the product's spend cap — that lives in convex/costBudgets.ts (D-12/
// D-19). These are a one-time seed for the "SDK Spend Guard" alertRuleCustom
// row below, a static threshold rule evaluated only by
// AlertRulesEngine.tsx's client-side `api.alerts.evaluate` call while an
// operator has the Alerts page open — its own cron evaluator
// (internal.alerts.evaluateInternal) has been disabled since 2026-07-14
// (see convex/crons.ts). Renamed off DAILY_CAP/ALERT_THRESHOLD so this repo's
// one-cap-source grep gate (104-08's Task 3) has exactly one legitimate,
// classified exemption here instead of a second, indistinguishable cap
// source.
const LEGACY_SEED_DAILY_CAP = 5.00;
const LEGACY_SEED_ALERT_THRESHOLD = 0.8;

const GATEWAY_PROFILES = [
  { profileId: "claude-cli",  name: "Claude CLI",  model: "claude-opus-4-8",   displayName: "Claude CLI -- Subscription" },
  { profileId: "codex",       name: "Codex CLI",   model: "gpt-4o",            displayName: "Codex CLI -- Subscription" },
  { profileId: "antigravity", name: "Antigravity", model: "gpt-4o",            displayName: "Antigravity CLI -- Subscription" },
  { profileId: "claude-sdk",  name: "Claude SDK",  model: "claude-sonnet-4-6", displayName: "Claude SDK -- API" },
];

/** Seeds the SDK Spend Guard alert rule. Idempotent — safe to run multiple times. */
export const seedSDKSpendAlert = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("alertRuleCustom")
      .filter((q) => q.eq(q.field("name"), "SDK Spend Guard"))
      .first();
    if (existing) return { seeded: false, message: "SDK Spend Guard rule already exists" };

    const now = Date.now() / 1000;
    await ctx.db.insert("alertRuleCustom", {
      name: "SDK Spend Guard",
      severity: "warning",
      enabled: true,
      conditions: [{
        metric: "sdk_spend_usd_today",
        operator: "gte",
        threshold: LEGACY_SEED_DAILY_CAP * LEGACY_SEED_ALERT_THRESHOLD,
        lookbackWindow: "24h",
      }],
      conditionLogic: "AND",
      messageTemplate: "SDK API spend has reached 80% of the daily $5.00 cap",
      createdAt: now,
      updatedAt: now,
    });
    return { seeded: true };
  },
});

/** Seeds gateway agent profiles. Idempotent — skips profiles that already exist. */
export const seedGatewayProfiles = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now() / 1000;
    let count = 0;
    for (const agent of GATEWAY_PROFILES) {
      const existing = await ctx.db
        .query("agentProfiles")
        .withIndex("by_profileId", (q) => q.eq("profileId", agent.profileId))
        .first();
      if (existing) continue;
      await ctx.db.insert("agentProfiles", {
        profileId: agent.profileId,
        name: agent.name,
        displayName: agent.displayName,
        model: agent.model,
        createdAt: now,
        updatedAt: now,
      });
      count++;
    }
    return { seeded: count };
  },
});

/** Seeds providerConfig rows for all gateway providers. Idempotent. */
export const seedProviderConfigs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now() / 1000;
    let count = 0;
    for (let i = 0; i < GATEWAY_PROVIDERS.length; i++) {
      const provider = GATEWAY_PROVIDERS[i];
      const existing = await ctx.db
        .query("providerConfig")
        .filter((q) => q.eq(q.field("provider"), provider))
        .first();
      if (existing) continue;
      await ctx.db.insert("providerConfig", {
        provider,
        enabled: true,
        priority: i + 1,
        updatedAt: now,
      });
      count++;
    }
    return { seeded: count };
  },
});

/** Public mutation callable from the Settings "Seed Gateway Defaults" button.
 *  Schedules both internal seed mutations. Idempotent — safe to run multiple times. */
export const runSeed = mutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.seedGateway.seedSDKSpendAlert, {});
    await ctx.scheduler.runAfter(0, internal.seedGateway.seedGatewayProfiles, {});
    await ctx.scheduler.runAfter(0, internal.seedGateway.seedProviderConfigs, {});
    return { scheduled: true };
  },
});
