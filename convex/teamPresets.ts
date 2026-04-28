import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    agentIds: v.array(v.string()),
    createdBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const now = Date.now() / 1000;
    return await ctx.db.insert("teamPresets", {
      name: args.name,
      description: args.description,
      agentIds: args.agentIds,
      createdBy: args.createdBy,
      createdAt: now,
      updatedAt: now,
      warRoomCount: 0,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("teamPresets"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    agentIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const { id, ...fields } = args;
    const updates: Record<string, any> = { updatedAt: Date.now() / 1000 };
    if (fields.name !== undefined) updates.name = fields.name;
    if (fields.description !== undefined) updates.description = fields.description;
    if (fields.agentIds !== undefined) updates.agentIds = fields.agentIds;
    await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("teamPresets") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    await ctx.db.delete(args.id);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("teamPresets").collect();
  },
});

export const get = query({
  args: { id: v.id("teamPresets") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const incrementUsage = mutation({
  args: { id: v.id("teamPresets") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const preset = await ctx.db.get(args.id);
    if (!preset) return;
    await ctx.db.patch(args.id, {
      warRoomCount: (preset.warRoomCount ?? 0) + 1,
      lastUsedAt: Date.now() / 1000,
    });
  },
});
