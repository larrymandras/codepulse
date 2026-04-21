import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const save = mutation({
  args: {
    viewMode: v.string(),
    sortBy: v.optional(v.string()),
    filters: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("rosterViewPrefs").first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        viewMode: args.viewMode,
        sortBy: args.sortBy,
        filters: args.filters,
      });
      return existing._id;
    }
    return await ctx.db.insert("rosterViewPrefs", {
      viewMode: args.viewMode,
      sortBy: args.sortBy,
      filters: args.filters,
    });
  },
});

export const get = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("rosterViewPrefs").first();
  },
});
