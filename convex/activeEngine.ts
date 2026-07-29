import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { isUnresolvedRouting } from "./activeEngineFilters";

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
 *
 * ENFORCED by the builder (CR-01 fix): declared as an `internalMutation`, so
 * it does not exist in the client-callable `api.` namespace at all — the
 * same precedent `convex/gatewayQuota.ts`'s `insertSnapshot` already
 * follows. This closes the devtools-forgeable write path a plain `mutation`
 * left open (any holder of the shipped `VITE_CONVEX_URL` could otherwise
 * call `api.activeEngine.recordRouting` directly and insert a fabricated
 * "server-confirmed" row that `BrainHeaderBadge` would render with its
 * confirmed-live pulse dot).
 */
export const recordRouting = internalMutation({
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

/**
 * pruneUnresolved — deletes rows that carry no usable profile or engine identity, i.e. the
 * `{profileId:"unknown", model:"unknown"}` sentinels the pre-2026-07-29 `model_routing` case used to
 * write (see `activeEngineFilters.ts` for the full chain and why they were never a reading).
 *
 * The ingest guard stops NEW ones; this cleans up the ones already stored. Once run, it should
 * normally be a no-op forever.
 *
 * BATCH-CAPPED on purpose, per this repo's self-hosted-Convex rules (CLAUDE.md): the production
 * backend is a single-node SQLite instance whose MVCC tombstone GC cannot absorb mass deletes while
 * serving load — an unbounded sweep here is exactly the shape that took the dashboard down for days
 * on 2026-07-21/22. Reads a bounded window, deletes at most `limit` rows, and reports whether more
 * remain so the caller can decide to run it again rather than this function looping.
 *
 * `internalMutation` (never a public `mutation`), for the same CR-01 reason `recordRouting` is: a
 * client-callable delete path on a telemetry table is not something the browser should ever hold.
 * Invoke it deliberately from the CLI with an admin key.
 */
export const pruneUnresolved = internalMutation({
  args: {
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 50, 200);

    // Bounded scan, mirroring latestByProfile's take() discipline — never .collect() on this
    // append-only table.
    const rows = await ctx.db
      .query("activeEngineSnapshots")
      .withIndex("by_timestamp")
      .order("desc")
      .take(500);

    const unresolved = rows.filter((row) => isUnresolvedRouting(row));
    const batch = unresolved.slice(0, limit);

    for (const row of batch) {
      await ctx.db.delete(row._id);
    }

    return {
      scanned: rows.length,
      unresolvedFound: unresolved.length,
      deleted: batch.length,
      moreRemaining: unresolved.length > batch.length,
    };
  },
});
