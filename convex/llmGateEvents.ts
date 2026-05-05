import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * llmGateEvents — Convex module for LLM Gate state persistence.
 *
 * Records llm_gate_changed events from Astridr and serves the latest
 * gate state to the LlmGateCard dashboard component.
 *
 * Phase 099 Plan 04 (ROUTE-05).
 */

export const record = mutation({
  args: {
    enabled: v.boolean(),
    reason: v.string(),
    queuedCount: v.optional(v.number()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("llmGateEvents", args);
  },
});

export const latest = query({
  args: {},
  handler: async (ctx) => {
    const event = await ctx.db
      .query("llmGateEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .first();
    return event;
  },
});
