import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { GOVERNOR_DECISION_CAP } from "./governorDecisionsFilters";

// ============================================================
// GOVERNOR DECISIONS — Phase 112 (TELE-03, D-04)
// ============================================================
//
// The governor_decision audit trail. astridr's governor emits one
// governor_decision event per gate evaluation — whether it spoke, and if
// held, why. This table stores every one, discriminated by `spoke`, so a
// held decision is queryable rather than only a silent no-op (D-04). No
// `profileId` exists on this kind (see schema.ts's governorDecisions
// comment) — this is a global, not a per-profile, axis.
//
// GOVERNOR_DECISION_CAP lives in `governorDecisionsFilters.ts` (not here),
// same reason `controlVerbSwapsFilters.ts` split out of `controlVerbSwaps.ts`
// (108-06 bundling defect): this file imports `internalMutation`/`query`
// from `./_generated/server`, so any browser code that value-imported the
// cap directly from here would pull the whole Convex server runtime into
// the client bundle.

/**
 * record — Append-only insert of one governor_decision row. Never patches or
 * deletes an existing row.
 *
 * D-04: this mutation is the ONLY write path for the governor-decision axis,
 * and it is reachable ONLY from the astridr `governor_decision` telemetry
 * ingest case (convex/runtimeIngest.ts, plan 112-04). The UI must NEVER call
 * this directly to assert a decision happened.
 *
 * ENFORCED (CR-01 rule, same as controlVerbSwaps.ts's record): declared as
 * an `internalMutation`, so it does not exist in the client-callable `api.`
 * namespace at all. This closes the devtools-forgeable write path a plain
 * `mutation` would leave open — any holder of the shipped VITE_CONVEX_URL
 * could otherwise call `api.governorDecisions.record` directly and insert a
 * fabricated "server-confirmed" governor decision that plan 05's surface
 * would render as truth.
 */
export const record = internalMutation({
  args: {
    emitter: v.string(),
    priority: v.string(),
    spoke: v.boolean(),
    heldReason: v.optional(v.string()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("governorDecisions", { ...args });
  },
});

/**
 * listRecent — Returns the most recent governor-decision rows, newest
 * first, bounded by GOVERNOR_DECISION_CAP over the by_timestamp index —
 * never an unbounded collect on this append-only table (T-112-02): an
 * unbounded read on a growing table is exactly what breached the 16 MiB
 * limit in Phase 88.
 */
export const listRecent = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("governorDecisions")
      .withIndex("by_timestamp")
      .order("desc")
      .take(GOVERNOR_DECISION_CAP);
  },
});
