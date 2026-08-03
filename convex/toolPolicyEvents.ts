import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Phase 105 D-05/D-06 — Ástríðr's `tool_policy_event` runtime event.
 *
 * `record` is an internalMutation, not a public `mutation`, by design (the
 * WR-06 convention this repo already follows for kgBenchmarkRuns.recordRun):
 * the only write path must be the already-Bearer-gated `runtimeIngest`
 * httpAction (case "tool_policy_event"). As a public mutation this table
 * would be directly writable by anyone holding the deployment URL, with no
 * auth check at all — T-105-10 in 105-03-PLAN.md's threat register.
 */
export const record = internalMutation({
  args: {
    event: v.string(),
    tool: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    agentId: v.optional(v.string()),
    taskCategory: v.optional(v.string()),
    toolWasOffered: v.optional(v.boolean()),
    toolsOfferedCount: v.optional(v.float64()),
    round: v.optional(v.float64()),
    field: v.optional(v.string()),
    error: v.optional(v.string()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("toolPolicyEvents", args);
  },
});

/** Hard cap on any single read of this table — never an unbounded scan. */
export const POLICY_FEED_READ_CAP = 200;

/**
 * Most recent policy events, optionally filtered to one kind. Default read
 * size is 100, callers may request up to POLICY_FEED_READ_CAP.
 */
export const recent = query({
  args: {
    limit: v.optional(v.float64()),
    event: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 100, POLICY_FEED_READ_CAP);
    const rows = args.event
      ? await ctx.db
          .query("toolPolicyEvents")
          .withIndex("by_event", (q) => q.eq("event", args.event!))
          .order("desc")
          .take(limit)
      : await ctx.db
          .query("toolPolicyEvents")
          .withIndex("by_timestamp")
          .order("desc")
          .take(limit);

    return { rows, truncated: rows.length >= limit, cap: POLICY_FEED_READ_CAP };
  },
});

/**
 * D-07 — the last time CodePulse received ANY tool-policy event. Returns
 * `{ timestamp: null }` when the table has never had a row, which is a
 * different claim from "there were none recently" (a real but old
 * timestamp) — this must never be collapsed into `0` or `Date.now()`, both
 * of which would destroy that distinction and make a dead ingest pipe
 * indistinguishable from a healthy quiet one.
 */
export const lastReceivedAt = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("toolPolicyEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .take(1);
    return { timestamp: rows[0]?.timestamp ?? null };
  },
});

const TOOL_POLICY_EVENT_KINDS = [
  "malformed_policy_boot",
  "malformed_policy_reload_rejected",
  "execution_denied",
  "tool_call_leaked_as_text",
] as const;

/**
 * Per-kind counts over a trailing window (default 7 days), for the feed's
 * summary line. Every one of the four kinds appears as a key with value `0`
 * when absent — the UI never has to guess whether a missing key means zero
 * or means unknown.
 */
export const countsByKind = query({
  args: {
    sinceSeconds: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const windowSeconds = args.sinceSeconds ?? 7 * 86400;
    const cutoff = Date.now() / 1000 - windowSeconds;
    const rawRows = await ctx.db
      .query("toolPolicyEvents")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", cutoff))
      .take(POLICY_FEED_READ_CAP * 5);

    const truncated = rawRows.length >= POLICY_FEED_READ_CAP * 5;
    const counts: Record<string, number> = {};
    for (const kind of TOOL_POLICY_EVENT_KINDS) counts[kind] = 0;
    for (const row of rawRows) {
      counts[row.event] = (counts[row.event] ?? 0) + 1;
    }

    return { counts, truncated, windowSeconds };
  },
});
