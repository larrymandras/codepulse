import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const save = mutation({
  args: {
    id: v.optional(v.id("wizardDrafts")),
    catalogEntryId: v.optional(v.string()),
    currentStep: v.number(),
    formData: v.object({
      identity: v.optional(v.any()),
      personality: v.optional(v.any()),
      tools: v.optional(v.any()),
      deployment: v.optional(v.any()),
    }),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now() / 1000;
    if (args.id) {
      await ctx.db.patch(args.id, {
        catalogEntryId: args.catalogEntryId,
        currentStep: args.currentStep,
        formData: args.formData,
        status: args.status,
        updatedAt: now,
      });
      return args.id;
    }
    return await ctx.db.insert("wizardDrafts", {
      catalogEntryId: args.catalogEntryId,
      currentStep: args.currentStep,
      formData: args.formData,
      status: args.status,
      createdAt: now,
      updatedAt: now,
    });
  },
});
