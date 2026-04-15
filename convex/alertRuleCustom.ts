import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

const conditionValidator = v.object({
  metric: v.string(),
  operator: v.string(),
  threshold: v.float64(),
  lookbackWindow: v.string(),
});

const conditionGroupValidator = v.object({
  conditions: v.array(conditionValidator),
  logic: v.string(),
});

// ============================================================
// CUSTOM RULE CRUD
// ============================================================

export const create = mutation({
  args: {
    name: v.string(),
    severity: v.string(),
    conditions: v.array(conditionValidator),
    conditionLogic: v.string(),
    conditionGroups: v.optional(v.array(conditionGroupValidator)),
    messageTemplate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // CPHLTH-01: Require authenticated Clerk identity.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");

    const now = Date.now() / 1000;
    return await ctx.db.insert("alertRuleCustom", {
      name: args.name,
      severity: args.severity,
      conditions: args.conditions,
      conditionLogic: args.conditionLogic,
      conditionGroups: args.conditionGroups,
      messageTemplate: args.messageTemplate,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("alertRuleCustom"),
    name: v.optional(v.string()),
    severity: v.optional(v.string()),
    conditions: v.optional(v.array(conditionValidator)),
    conditionLogic: v.optional(v.string()),
    conditionGroups: v.optional(v.array(conditionGroupValidator)),
    messageTemplate: v.optional(v.string()),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // CPHLTH-01: Require authenticated Clerk identity.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");

    const { id, ...rest } = args;
    await ctx.db.patch(id, {
      ...rest,
      updatedAt: Date.now() / 1000,
    });
  },
});

export const remove = mutation({
  args: {
    id: v.id("alertRuleCustom"),
  },
  handler: async (ctx, args) => {
    // CPHLTH-01: Require authenticated Clerk identity.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");

    await ctx.db.delete(args.id);
  },
});

export const list = query({
  args: {
    enabled: v.optional(v.boolean()),
    severity: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let rules;
    if (args.enabled !== undefined) {
      rules = await ctx.db
        .query("alertRuleCustom")
        .withIndex("by_enabled", (q) => q.eq("enabled", args.enabled!))
        .collect();
    } else {
      rules = await ctx.db.query("alertRuleCustom").collect();
    }

    if (args.severity !== undefined) {
      rules = rules.filter((r) => r.severity === args.severity);
    }

    return rules;
  },
});

export const get = query({
  args: {
    id: v.id("alertRuleCustom"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// ============================================================
// THRESHOLD OVERRIDES — stored in agentConfigs
// ============================================================

export const setThresholdOverride = mutation({
  args: {
    ruleId: v.string(),
    threshold: v.float64(),
    lookbackWindow: v.string(),
  },
  handler: async (ctx, args) => {
    // CPHLTH-01: Require authenticated Clerk identity.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");

    const configKey = `alert-rule-override:${args.ruleId}`;
    const existing = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", configKey))
      .first();

    const value = { threshold: args.threshold, lookbackWindow: args.lookbackWindow };
    const now = Date.now() / 1000;

    if (existing) {
      await ctx.db.patch(existing._id, { value, updatedAt: now });
    } else {
      await ctx.db.insert("agentConfigs", {
        configKey,
        value,
        source: "dashboard",
        updatedAt: now,
      });
    }
  },
});

export const getThresholdOverride = query({
  args: {
    ruleId: v.string(),
  },
  handler: async (ctx, args) => {
    const configKey = `alert-rule-override:${args.ruleId}`;
    const config = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", configKey))
      .first();
    return config ? (config.value as { threshold: number; lookbackWindow: string }) : null;
  },
});

export const listThresholdOverrides = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("agentConfigs").collect();
    return all.filter((c) => c.configKey.startsWith("alert-rule-override:")).map((c) => ({
      ruleId: c.configKey.replace("alert-rule-override:", ""),
      ...(c.value as { threshold: number; lookbackWindow: string }),
      updatedAt: c.updatedAt,
    }));
  },
});
