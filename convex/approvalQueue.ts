import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsert = mutation({
  args: {
    requestId: v.string(),
    agentName: v.string(),
    agentId: v.string(),
    catalogEntryId: v.optional(v.string()),
    tier: v.string(),
    budgetFraction: v.optional(v.number()),
    status: v.string(),
    configSnapshot: v.optional(v.any()),
    requestedAt: v.number(),
    decidedAt: v.optional(v.number()),
    decidedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("approvalQueue")
      .withIndex("by_requestId", (q) => q.eq("requestId", args.requestId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        agentName: args.agentName,
        agentId: args.agentId,
        catalogEntryId: args.catalogEntryId,
        tier: args.tier,
        budgetFraction: args.budgetFraction,
        status: args.status,
        configSnapshot: args.configSnapshot,
        requestedAt: args.requestedAt,
        decidedAt: args.decidedAt,
        decidedBy: args.decidedBy,
      });
      return existing._id;
    }
    return await ctx.db.insert("approvalQueue", {
      requestId: args.requestId,
      agentName: args.agentName,
      agentId: args.agentId,
      catalogEntryId: args.catalogEntryId,
      tier: args.tier,
      budgetFraction: args.budgetFraction,
      status: args.status,
      configSnapshot: args.configSnapshot,
      requestedAt: args.requestedAt,
      decidedAt: args.decidedAt,
      decidedBy: args.decidedBy,
    });
  },
});

export const list = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("approvalQueue")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    }
    return await ctx.db.query("approvalQueue").collect();
  },
});

export const get = query({
  args: { id: v.id("approvalQueue") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("approvalQueue"),
    status: v.string(),
    decidedAt: v.optional(v.number()),
    decidedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      decidedAt: args.decidedAt,
      decidedBy: args.decidedBy,
    });
  },
});
