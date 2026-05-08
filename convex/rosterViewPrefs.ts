import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";

export const save = mutation({
  args: {
    viewMode: v.string(),
    sortBy: v.optional(v.string()),
    filters: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity!.subject;
    const existing = await ctx.db
      .query("rosterViewPrefs")
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        viewMode: args.viewMode,
        sortBy: args.sortBy,
        filters: args.filters,
      });
      return existing._id;
    }
    return await ctx.db.insert("rosterViewPrefs", {
      userId,
      viewMode: args.viewMode,
      sortBy: args.sortBy,
      filters: args.filters,
    });
  },
});

export const get = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db
      .query("rosterViewPrefs")
      .filter((q) => q.eq(q.field("userId"), identity.subject))
      .first();
  },
});
