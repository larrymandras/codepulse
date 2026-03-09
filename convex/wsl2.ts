import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsertStatus = mutation({
  args: {
    distro: v.string(),
    status: v.string(),
    memoryMb: v.optional(v.float64()),
    cpuPercent: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const now = Date.now() / 1000;
    const existing = await ctx.db
      .query("wsl2Status")
      .withIndex("by_distro", (q) => q.eq("distro", args.distro))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        memoryMb: args.memoryMb,
        cpuPercent: args.cpuPercent,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("wsl2Status", {
        distro: args.distro,
        status: args.status,
        memoryMb: args.memoryMb,
        cpuPercent: args.cpuPercent,
        updatedAt: now,
      });
    }
  },
});

export const getByDistro = query({
  args: { distro: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("wsl2Status")
      .withIndex("by_distro", (q) => q.eq("distro", args.distro))
      .first();
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("wsl2Status").collect();
  },
});
