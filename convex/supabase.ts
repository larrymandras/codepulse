import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const recordHealth = mutation({
  args: {
    projectRef: v.optional(v.string()),
    service: v.string(),
    status: v.string(),
    responseTimeMs: v.optional(v.float64()),
    details: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("supabaseHealth", {
      projectRef: args.projectRef,
      service: args.service,
      status: args.status,
      responseTimeMs: args.responseTimeMs,
      details: args.details,
      checkedAt: Date.now() / 1000,
    });
  },
});

export const currentHealth = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("supabaseHealth").collect();
    // Dedupe by service, keeping the latest checkedAt
    const byService = new Map<string, (typeof all)[0]>();
    for (const record of all) {
      const existing = byService.get(record.service);
      if (!existing || record.checkedAt > existing.checkedAt) {
        byService.set(record.service, record);
      }
    }
    return Array.from(byService.values());
  },
});

export const pollHealth = internalMutation({
  args: {},
  handler: async (_ctx) => {
    // Stub: real polling comes from scanner or external triggers
    return { status: "ok" };
  },
});
