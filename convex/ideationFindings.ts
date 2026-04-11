/**
 * ideationFindings.ts — Convex query/mutation functions for the ideationFindings table.
 *
 * Phase 56 Plan 05: CPCC-06 / SCAN-05 — security scan visibility in Agents page.
 *
 * Exports:
 *   list       — all findings, optionally filtered by scanType and dismissed
 *   byLocation — active findings grouped by location (tool name)
 *   dismiss    — mark a single finding as dismissed
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/** List all findings, optionally filtered by scanType and/or dismissed status. */
export const list = query({
  args: {
    scanType: v.optional(v.string()),
    dismissed: v.optional(v.boolean()),
  },
  handler: async (ctx, { scanType, dismissed }) => {
    if (scanType) {
      const results = await ctx.db
        .query("ideationFindings")
        .withIndex("by_scan_type", (idx) => idx.eq("scanType", scanType))
        .order("desc")
        .collect();
      if (dismissed !== undefined) {
        return results.filter((r) => r.dismissed === dismissed);
      }
      return results;
    }

    const results = await ctx.db
      .query("ideationFindings")
      .order("desc")
      .collect();

    if (dismissed !== undefined) {
      return results.filter((r) => r.dismissed === dismissed);
    }
    return results;
  },
});

/** Return active (non-dismissed) findings grouped by location (tool name). */
export const byLocation = query({
  args: {},
  handler: async (ctx) => {
    const findings = await ctx.db
      .query("ideationFindings")
      .withIndex("by_dismissed", (q) => q.eq("dismissed", false))
      .collect();

    const grouped: Record<
      string,
      Array<(typeof findings)[number]>
    > = {};

    for (const f of findings) {
      if (!grouped[f.location]) grouped[f.location] = [];
      grouped[f.location].push(f);
    }

    return grouped;
  },
});

/** Mark a single finding as dismissed. Dismissed findings remain in the DB for audit. */
export const dismiss = mutation({
  args: { id: v.id("ideationFindings") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, {
      dismissed: true,
      dismissedAt: Date.now() / 1000,
    });
  },
});
