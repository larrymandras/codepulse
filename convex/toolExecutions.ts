import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ---- D-12 (Phase 105) bounded reads ---------------------------------------
//
// This table backs public, unauthenticated Convex queries on a single-node
// self-hosted SQLite backend (CLAUDE.md "Self-Hosted Convex — Operational
// Rules"). Every read here used to be an unbounded full-table read (the
// "collect every row" shape); that caused the 2026-07-21/22 outage and the
// 2026-08-02 Analytics blackout class of defect. Each query below is now
// bounded by an explicit exported cap constant and reports `truncated`
// rather than silently undercounting.
export const SESSION_TOOLS_READ_CAP = 1000;
export const TOOL_WINDOW_READ_CAP = 4000;
export const RECENT_SCAN_CAP = 500;

/**
 * Removes rows whose `provider` strictly equals `excludeProvider`. A row
 * with `provider === undefined` is NEVER excluded — that is the whole point
 * (see 105-01-PLAN.md finding F1): an INCLUDE-filter on `provider ===
 * "claude-cli"` would drop every Claude Code tool-failure row (they never
 * set `provider`, convex/ingest.ts:168) and every gateway row, so this
 * project deliberately uses an EXCLUDE filter instead. When `excludeProvider`
 * is undefined, rows are returned unchanged (today's behaviour, unmodified).
 */
export function excludeByProvider<T extends { provider?: string }>(
  rows: T[],
  excludeProvider?: string
): T[] {
  if (excludeProvider === undefined) return rows;
  return rows.filter((row) => row.provider !== excludeProvider);
}

export const insert = mutation({
  args: {
    sessionId: v.string(),
    toolName: v.string(),
    durationMs: v.optional(v.float64()),
    success: v.boolean(),
    decision: v.optional(v.string()),
    decisionSource: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    provider: v.optional(v.string()),
    timestamp: v.float64(),
    traceId: v.optional(v.string()), // Phase 105 D-03
    round: v.optional(v.float64()),  // Phase 105 D-10
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("toolExecutions", args);
  },
});

/**
 * Bounded scan of the most recent RECENT_SCAN_CAP rows, optionally excluding
 * a provider, then sliced to `limit`. The scan itself is capped by
 * construction: if excluded rows dominate the most-recent window, the caller
 * may receive fewer than `limit` rows. That is intended bounded-by-
 * construction behaviour (T-105-03), not a bug — it guarantees a filter that
 * matches nothing can never walk the whole table.
 */
export const recentExecutions = query({
  args: {
    excludeProvider: v.optional(v.string()),
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const scanned = await ctx.db
      .query("toolExecutions")
      .withIndex("by_timestamp")
      .order("desc")
      .take(RECENT_SCAN_CAP);
    const filtered = excludeByProvider(scanned, args.excludeProvider);
    return filtered.slice(0, args.limit ?? 100);
  },
});

export const successRate = query({
  args: {
    excludeProvider: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cutoff = Date.now() / 1000 - 86400;
    const rawRows = await ctx.db
      .query("toolExecutions")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", cutoff))
      .take(TOOL_WINDOW_READ_CAP);

    // Truncation is computed from the RAW read count, before the provider
    // filter — the cap was hit at the read, not after filtering (105-01
    // acceptance criteria point 5).
    const truncated = rawRows.length >= TOOL_WINDOW_READ_CAP;
    const recent = excludeByProvider(rawRows, args.excludeProvider);

    const byTool: Record<string, { success: number; failure: number }> = {};
    for (const exec of recent) {
      if (!byTool[exec.toolName]) {
        byTool[exec.toolName] = { success: 0, failure: 0 };
      }
      if (exec.success) {
        byTool[exec.toolName].success++;
      } else {
        byTool[exec.toolName].failure++;
      }
    }

    const tools = Object.entries(byTool).map(([toolName, counts]) => ({
      toolName,
      ...counts,
      total: counts.success + counts.failure,
      rate: counts.success / (counts.success + counts.failure),
    }));

    return { tools, truncated, cap: TOOL_WINDOW_READ_CAP };
  },
});

/**
 * Zero live consumers as of Phase 105 (grepped across src/ and convex/ — see
 * 105-01-PLAN.md finding F4). Bounded anyway: D-12's extended clause names
 * this query explicitly, and a dead public query is still a live DoS surface
 * on an unauthenticated Convex deployment. Left deployed (not deleted) per
 * the 104-08 `getBudgetConfig` deploy-order precedent; flagged in
 * 105-01-SUMMARY.md as a Phase-106 dead-code candidate.
 */
export const avgDuration = query({
  args: {
    excludeProvider: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cutoff = Date.now() / 1000 - 86400;
    const rawRows = await ctx.db
      .query("toolExecutions")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", cutoff))
      .take(TOOL_WINDOW_READ_CAP);

    const truncated = rawRows.length >= TOOL_WINDOW_READ_CAP;
    const filtered = excludeByProvider(rawRows, args.excludeProvider);
    const recent = filtered.filter((e) => e.durationMs != null);

    const byTool: Record<string, { total: number; count: number }> = {};
    for (const exec of recent) {
      if (!byTool[exec.toolName]) {
        byTool[exec.toolName] = { total: 0, count: 0 };
      }
      byTool[exec.toolName].total += exec.durationMs!;
      byTool[exec.toolName].count++;
    }

    const tools = Object.entries(byTool).map(([toolName, data]) => ({
      toolName,
      avgDurationMs: data.total / data.count,
      count: data.count,
    }));

    return { tools, truncated, cap: TOOL_WINDOW_READ_CAP };
  },
});

/**
 * Returns the most recent SESSION_TOOLS_READ_CAP tool-execution rows for a
 * session, in ascending timestamp order (matching the pre-Phase-105
 * contract). Bounded by reading in DESCENDING order first (so a cap hit
 * keeps the newest rows, not the oldest — the plan's literal "keep
 * `.order("asc")`" snippet was verified live to invert this: capping an
 * ascending scan drops the newest rows first, which contradicts both
 * 105-UI-SPEC.md's "Showing the most recent {cap}" truncation copy and D-12's
 * honesty goal), then reversing back to ascending for the caller.
 */
export const listBySession = query({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const descRows = await ctx.db
      .query("toolExecutions")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .order("desc")
      .take(SESSION_TOOLS_READ_CAP);

    const truncated = descRows.length >= SESSION_TOOLS_READ_CAP;
    const rows = descRows.slice().reverse();

    return { rows, truncated, cap: SESSION_TOOLS_READ_CAP };
  },
});
