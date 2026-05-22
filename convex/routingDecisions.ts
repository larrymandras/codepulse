import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

// ============================================================
// ROUTING DECISIONS — Phase 68 observability data layer
// ============================================================

/**
 * insert — Record a gateway routing decision, including all score fields
 * and whether a fallback provider was used.
 *
 * T-68-03: v.optional(v.float64()) rejects non-numeric score values;
 *          v.boolean() for fallbackUsed prevents string "true" storage.
 */
export const insert = mutation({
  args: {
    taskId: v.string(),
    requestedProvider: v.string(),
    selectedProvider: v.string(),
    quotaScore: v.optional(v.float64()),
    latencyScore: v.optional(v.float64()),
    costScore: v.optional(v.float64()),
    finalScore: v.optional(v.float64()),
    fallbackUsed: v.boolean(),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("routingDecisions", { ...args });
  },
});

/**
 * listPaginated — Paginated list of routing decisions ordered by most recent first.
 * Optional fallbackOnly filter returns only decisions where a fallback was used.
 */
export const listPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
    fallbackOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("routingDecisions")
      .withIndex("by_timestamp")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
