import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/** Returns all provider configs ordered by priority (lower = higher priority). */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("providerConfig")
      .withIndex("by_priority")
      .collect();
  },
});

/** Enable or disable a provider. Creates the config row if it doesn't exist. */
export const setEnabled = mutation({
  args: { provider: v.string(), enabled: v.boolean() },
  handler: async (ctx, { provider, enabled }) => {
    const existing = await ctx.db
      .query("providerConfig")
      .withIndex("by_provider", (q) => q.eq("provider", provider))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { enabled, updatedAt: Date.now() / 1000 });
    } else {
      await ctx.db.insert("providerConfig", {
        provider,
        enabled,
        priority: 999,
        updatedAt: Date.now() / 1000,
      });
    }
  },
});

/** Set priority order for all providers. Providers are ordered by their position in the array. */
export const setPriority = mutation({
  args: { providers: v.array(v.string()) },
  handler: async (ctx, { providers }) => {
    for (let index = 0; index < providers.length; index++) {
      const provider = providers[index];
      const existing = await ctx.db
        .query("providerConfig")
        .withIndex("by_provider", (q) => q.eq("provider", provider))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, { priority: index, updatedAt: Date.now() / 1000 });
      } else {
        await ctx.db.insert("providerConfig", {
          provider,
          enabled: true,
          priority: index,
          updatedAt: Date.now() / 1000,
        });
      }
    }
  },
});
