import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    name: v.string(),
    emoji: v.optional(v.string()),
    color: v.optional(v.string()),
    description: v.optional(v.string()),
    capabilities: v.optional(v.array(v.string())),
    imageStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("avatars", {
      name: args.name,
      emoji: args.emoji,
      color: args.color,
      description: args.description,
      capabilities: args.capabilities,
      imageStorageId: args.imageStorageId,
      createdAt: Date.now() / 1000,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("avatars"),
    name: v.optional(v.string()),
    emoji: v.optional(v.string()),
    color: v.optional(v.string()),
    description: v.optional(v.string()),
    capabilities: v.optional(v.array(v.string())),
    imageStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const updates: Record<string, string | string[] | undefined> = {};
    if (fields.name !== undefined) updates.name = fields.name;
    if (fields.emoji !== undefined) updates.emoji = fields.emoji;
    if (fields.color !== undefined) updates.color = fields.color;
    if (fields.description !== undefined) updates.description = fields.description;
    if (fields.capabilities !== undefined) updates.capabilities = fields.capabilities;
    if (fields.imageStorageId !== undefined) updates.imageStorageId = fields.imageStorageId as unknown as string;
    await ctx.db.patch(id, updates);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("avatars").order("desc").collect();
  },
});

export const getById = query({
  args: { id: v.id("avatars") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveImage = mutation({
  args: {
    id: v.id("avatars"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { imageStorageId: args.storageId });
  },
});

export const getImageUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});
