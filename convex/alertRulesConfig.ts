import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

const CONFIG_KEY = "alert-rules-disabled";

export const getDisabledRules = query({
  args: {},
  handler: async (ctx) => {
    const config = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", CONFIG_KEY))
      .first();
    return (config?.value as string[]) ?? [];
  },
});

export const toggleRule = mutation({
  args: {
    ruleId: v.string(),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    // CPHLTH-01: Require authenticated Clerk identity — this mutation enables/disables alert rules.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");

    const config = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", CONFIG_KEY))
      .first();

    const current: string[] = (config?.value as string[]) ?? [];
    let updated: string[];

    if (args.enabled) {
      updated = current.filter((id) => id !== args.ruleId);
    } else {
      updated = current.includes(args.ruleId) ? current : [...current, args.ruleId];
    }

    if (config) {
      await ctx.db.patch(config._id, { value: updated, updatedAt: Date.now() / 1000 });
    } else {
      await ctx.db.insert("agentConfigs", {
        configKey: CONFIG_KEY,
        value: updated,
        source: "dashboard",
        updatedAt: Date.now() / 1000,
      });
    }

    return { disabledRules: updated };
  },
});
