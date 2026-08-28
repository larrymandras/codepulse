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
