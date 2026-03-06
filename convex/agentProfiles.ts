import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    profileId: v.string(),
    name: v.string(),
    model: v.optional(v.string()),
    avatarId: v.optional(v.id("avatars")),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now() / 1000;
    return await ctx.db.insert("agentProfiles", {
      profileId: args.profileId,
      name: args.name,
      model: args.model,
      avatarId: args.avatarId,
      displayName: args.displayName,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("agentProfiles"),
    name: v.optional(v.string()),
    model: v.optional(v.string()),
    avatarId: v.optional(v.id("avatars")),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const updates: Record<string, any> = { updatedAt: Date.now() / 1000 };
    if (fields.name !== undefined) updates.name = fields.name;
    if (fields.model !== undefined) updates.model = fields.model;
    if (fields.avatarId !== undefined) updates.avatarId = fields.avatarId;
    if (fields.displayName !== undefined) updates.displayName = fields.displayName;
    await ctx.db.patch(id, updates);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("agentProfiles").order("desc").collect();
  },
});

export const getByProfileId = query({
  args: { profileId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentProfiles")
      .withIndex("by_profileId", (q) => q.eq("profileId", args.profileId))
      .first();
  },
});

export const remove = mutation({
  args: { id: v.id("agentProfiles") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
