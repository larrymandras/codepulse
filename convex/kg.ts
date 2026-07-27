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

// ============================================================
// KG ANSWER SYNC — galaxy answer-sync latest source-node set (Phase 187, GLXY-01)
// ============================================================
//
// Fed by the `kg_answer_sync` runtime telemetry event emitted by Ástríðr's
// agent loop success-path return (Phase 187 Plan 02, docs/astridr-contract.md
// §2.41). Single-row, latest-wins semantics — mirrors kgSummary/upsertSummary
// exactly: the table holds exactly one row, upserted on every event, so
// /knowledge-graph's 3D galaxy can subscribe with useQuery and replay the
// last sync on open (D-04/D-05), with no per-session scoping.

export interface UpsertAnswerSyncArgs {
  turnId: string;
  sourceNodeIds: string[];
  primaryEntityName?: string;
  updatedAt: number;
}

interface KgAnswerSyncDb {
  query: (table: string) => { first: () => Promise<any> };
  patch: (id: any, doc: any) => Promise<void>;
  insert: (table: string, doc: any) => Promise<any>;
}

/**
 * Core upsert logic, extracted so it can be unit-tested against a minimal
 * fake `ctx.db` without convex-test (not installed in this repo — see
 * convex/evalScores.ts's storeEvalScoreHandler for the precedent). Single-row
 * upsert: patches the existing row if present, else inserts — mirrors
 * upsertSummary's `.first()` + patch/insert shape exactly (never per-session
 * scoped, latest-writer-wins, D-04/D-05).
 */
export async function upsertAnswerSyncHandler(
  ctx: { db: KgAnswerSyncDb } | any,
  args: UpsertAnswerSyncArgs,
): Promise<void> {
  const existing = await ctx.db.query("kgAnswerSync").first();
  const doc = {
    turnId: args.turnId,
    sourceNodeIds: args.sourceNodeIds,
    primaryEntityName: args.primaryEntityName,
    updatedAt: args.updatedAt,
  };
  if (existing) {
    await ctx.db.patch(existing._id, doc);
  } else {
    await ctx.db.insert("kgAnswerSync", doc);
  }
}

export const upsertAnswerSync = mutation({
  args: {
    turnId: v.string(),
    sourceNodeIds: v.array(v.string()),
    primaryEntityName: v.optional(v.string()),
    updatedAt: v.float64(),
  },
  // Inline arrow (not `handler: upsertAnswerSyncHandler` directly) — passing
  // the extracted handler by reference breaks `mutation()`'s public
  // FunctionReference args-type inference (collapses to `never` at every
  // ctx.runMutation call site). Delegating from an inline arrow keeps the
  // handler logic unit-testable while letting `mutation()` infer args from
  // the validators above, as designed.
  handler: async (ctx, args) => upsertAnswerSyncHandler(ctx, args),
});

/**
 * Core read logic for latestAnswerSync, extracted for the same fake-db
 * testability as upsertAnswerSyncHandler.
 */
export async function latestAnswerSyncHandler(
  ctx: { db: KgAnswerSyncDb } | any,
): Promise<any> {
  return await ctx.db.query("kgAnswerSync").first();
}

/** Latest answer-sync source-node set, or null before any telemetry has arrived. */
export const latestAnswerSync = query({
  args: {},
  // Inline arrow for the same reason as upsertAnswerSync above — avoids the
  // by-reference handler args-type inference collapse.
  handler: async (ctx) => latestAnswerSyncHandler(ctx),
});
