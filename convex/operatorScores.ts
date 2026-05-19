import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Insert a new operator score record from telemetry event.
 * Called by runtimeIngest.ts for operator_score events.
 */
export const insert = mutation({
  args: {
    score: v.float64(),
    memoryFreshness: v.float64(),
    skillRoi: v.float64(),
    activityLevel: v.float64(),
    uptime: v.float64(),
    trendDay: v.optional(v.string()),
    trend7d: v.optional(v.string()),
    computedAt: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("operatorScores", args);
  },
});

/**
 * Get the most recent operator score.
 */
export const latest = query({
  args: {},
  handler: async (ctx) => {
    const scores = await ctx.db
      .query("operatorScores")
      .withIndex("by_computedAt")
      .order("desc")
      .take(1);
    return scores[0] ?? null;
  },
});

/**
 * Get the last N operator scores for sparkline/trending.
 * Returns oldest-first for sparkline rendering.
 */
export const last30 = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 30, 90);
    const scores = await ctx.db
      .query("operatorScores")
      .withIndex("by_computedAt")
      .order("desc")
      .take(limit);
    // Reverse to oldest-first for sparkline
    return scores.reverse();
  },
});

/**
 * Backfill missing operator scores from Supabase REST API (D-14).
 * Called when CodePulse loads and Convex has no recent scores
 * (WebSocket may have been down when score was computed).
 *
 * Fetches from GET /api/operator-scores on the Astridr backend,
 * then inserts any scores not already present in Convex.
 *
 * Authentication: uses VITE_ASTRIDR_API_KEY passed from the client
 * (Astridr web channel rejects unauthenticated /api/* requests with 401).
 */
export const backfillFromSupabase = action({
  args: {
    astridrUrl: v.string(),
    apiKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get the most recent score in Convex to know our cutoff
    const existing = await ctx.runQuery(api.operatorScores.latest);
    const cutoffMs = existing?.computedAt ?? 0;

    try {
      const headers: Record<string, string> = {};
      if (args.apiKey) {
        headers["Authorization"] = `Bearer ${args.apiKey}`;
      }

      const resp = await fetch(
        `${args.astridrUrl}/api/operator-scores?limit=30`,
        { headers },
      );
      if (!resp.ok) return { inserted: 0, error: `HTTP ${resp.status}` };
      const body = await resp.json();
      const scores = body.scores ?? [];

      let inserted = 0;
      for (const row of scores) {
        // Parse computed_at to ms timestamp
        const computedAtMs = new Date(row.computed_at).getTime();
        // Skip if we already have this score (within 1-minute tolerance)
        if (computedAtMs <= cutoffMs + 60000) continue;

        await ctx.runMutation(api.operatorScores.insert, {
          score: row.score ?? 0,
          memoryFreshness: row.memory_freshness ?? 0,
          skillRoi: row.skill_roi ?? 0,
          activityLevel: row.activity_level ?? 0,
          uptime: row.uptime ?? 0,
          // Backfill data doesn't have trend fields (computed at emission time)
          computedAt: computedAtMs,
        });
        inserted++;
      }
      return { inserted, total: scores.length };
    } catch (err: any) {
      return { inserted: 0, error: err.message ?? "Unknown error" };
    }
  },
});
