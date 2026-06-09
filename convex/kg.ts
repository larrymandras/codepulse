import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ============================================================
// KG SUMMARY — temporal knowledge-graph snapshot (Phase 74, KG-01)
// ============================================================
//
// Fed by the `kg_summary` runtime telemetry event emitted by Ástríðr's Phase
// 135 KG read API (`emit_kg_summary`). Single-row, latest-wins semantics: the
// table holds exactly one snapshot which is upserted on every event. The KG
// Explorer summary cards read this (NOT the interactive /api/kg fetch) so they
// render even when Ástríðr is offline.
//
// Event field names mirror the LIVE emitter (camelCase):
//   entitiesByType, currentTripleCount, historicalTripleCount,
//   contradictionCount, lastExtractionAt.
// `totalEntities` is derived here from entitiesByType (the emitter does not send
// it) so the cards have a top-line count.

export const upsertSummary = mutation({
  args: {
    entitiesByType: v.record(v.string(), v.float64()),
    currentTripleCount: v.float64(),
    historicalTripleCount: v.float64(),
    contradictionCount: v.float64(),
    lastExtractionAt: v.optional(v.string()),
    updatedAt: v.float64(),
  },
  handler: async (ctx, args) => {
    const totalEntities = Object.values(args.entitiesByType).reduce(
      (sum, n) => sum + n,
      0,
    );
    const existing = await ctx.db.query("kgSummary").first();
    const doc = {
      entitiesByType: args.entitiesByType,
      totalEntities,
      currentTripleCount: args.currentTripleCount,
      historicalTripleCount: args.historicalTripleCount,
      contradictionCount: args.contradictionCount,
      lastExtractionAt: args.lastExtractionAt,
      updatedAt: args.updatedAt,
    };
    if (existing) {
      await ctx.db.patch(existing._id, doc);
    } else {
      await ctx.db.insert("kgSummary", doc);
    }
  },
});

/** Latest KG summary snapshot, or null before any telemetry has arrived. */
export const latestSummary = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("kgSummary").first();
  },
});
