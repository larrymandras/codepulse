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
