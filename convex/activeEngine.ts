import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ============================================================
// ACTIVE ENGINE SNAPSHOTS — Phase 103 (BSC-01, D-14)
// ============================================================
//
// The per-profile live-resolved brain-swap axis. This table holds ONLY the
// live resolved engine reported by Ástríðr telemetry (103-CONTRACT.md §4,
// the `model_routing` event) — it is NOT the persisted default (that stays
// Ástríðr-owned per D-03, mirrored in profileConfigs.modelPreferences).
//
// D-14: the UI must read the active engine ONLY from this table (fed by
// server-reported telemetry). It must NEVER call `recordRouting` to assert
// an engine from a client action or an ack payload.

/**
 * deduplicateByProfile — Pure helper for latestByProfile query.
 * Exported for unit testing in activeEngine.test.ts.
 * Given rows ordered newest-first (by timestamp descending), returns the
 * first (most recent) row per profileId — i.e. latest-per-profile.
 */
export function deduplicateByProfile<
  T extends { profileId: string; timestamp: number }
>(rows: T[]): T[] {
  const byProfile = new Map<string, T>();
  for (const row of rows) {
    if (!byProfile.has(row.profileId)) {
      byProfile.set(row.profileId, row);
    }
  }
  return Array.from(byProfile.values());
}

/**
 * latestByProfile — Returns the most recent active-engine snapshot for each
 * profile that has ever reported. Current-only (no history), mirroring
 * gatewayQuota.ts's latestByProvider (D-05 precedent). Bounded read over the
 * by_timestamp descending index — never .collect() on this append-only
 * table (T-103-06).
 *
 * 200 rather than gatewayQuota's 100 — per-profile cardinality is higher
 * than per-provider cardinality.
 */
export const latestByProfile = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("activeEngineSnapshots")
      .withIndex("by_timestamp")
      .order("desc")
      .take(200);

    return deduplicateByProfile(rows);
  },
});

/**
 * recordRouting — Append-only insert of one active-engine snapshot row.
 * Never patches or deletes an existing row (this table has no update path,
 * only latest-wins-on-read).
 *
 * D-14: this mutation is the ONLY write path for the active-engine axis, and
 * it is reachable ONLY from the astridr `model_routing` telemetry ingest
 * case (convex/runtimeIngest.ts). The UI must NEVER call this directly to
 * assert an engine — doing so would reintroduce exactly the client-asserted
 * stale-read failure BSC-01 exists to kill.
 */
export const recordRouting = mutation({
  args: {
    profileId: v.string(),
    model: v.string(),
    mode: v.string(),
    selectionPath: v.optional(v.string()),
    expiresAt: v.optional(v.float64()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("activeEngineSnapshots", { ...args });
  },
});
