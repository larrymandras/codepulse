import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Record a KG-vs-vector benchmark run (Phase 180, KG-BENCH-02, D-09).
 * Called from the runtime-ingest handler when eventType === "kg_benchmark".
 * Insert-only: one immutable row per run. Field shape mirrors
 * docs/astridr-contract.md §2.33.
 */
export const recordRun = mutation({
  args: {
    runTag: v.string(),
    verdict: v.string(), // "pass" | "fail" | "error"
    categories: v.any(), // nested per-category scores (suite-driven shape)
    suiteSize: v.float64(),
    durationMs: v.float64(),
    workflowRunUrl: v.optional(v.string()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("kgBenchmarkRuns", args);
  },
});

/**
 * Return the 10 most recent benchmark runs, ordered by timestamp desc.
 */
export const latestRuns = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("kgBenchmarkRuns")
      .withIndex("by_timestamp")
      .order("desc")
      .take(10);
  },
});
