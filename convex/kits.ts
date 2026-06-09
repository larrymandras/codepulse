import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ============================================================
// KITS — capability bundles (tool kits) from Ástríðr (Phase 72)
// ============================================================
//
// Populated by the `kits_snapshot` runtime event. Idempotent by `name`:
// the `tools` array is REPLACED on each snapshot so a kit always reflects
// its latest membership.

export const upsertKit = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    tools: v.array(v.string()),
    updatedAt: v.float64(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("kits")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        description: args.description,
        tools: args.tools,
        updatedAt: args.updatedAt,
      });
    } else {
      await ctx.db.insert("kits", {
        name: args.name,
        description: args.description,
        tools: args.tools,
        updatedAt: args.updatedAt,
      });
    }
  },
});

export const listKits = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("kits").withIndex("by_name").collect();
  },
});
