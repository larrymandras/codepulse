import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { SWAP_HISTORY_CAP } from "./controlVerbSwapsFilters";

// ============================================================
// CONTROL VERB SWAPS — Phase 108 (TELE-02, D-13/D-14)
// ============================================================
//
// The per-profile swap-history audit trail. astridr/engine/control_verbs/
// swap_model.py and swap_voice.py emit one `control_verb_swap` event per
// swap attempt (restore/unresolved/affinity-refused/success) — this table
// stores every one, discriminated by `verb`, so a refusal is queryable
// rather than only a spoken/toast-only notice (D-13). One table holds
// brain AND voice swaps (D-14) — the D-15 readout (GlobalSwapModal) filters
// to verb:"swap_model" for its history section; voice rows are captured
// but not yet surfaced (deferred, not dropped).
//
// SWAP_HISTORY_CAP and isBrainSwap moved to `controlVerbSwapsFilters.ts`
// (2026-08-07, bundling defect fix — see 108-REVIEW.md): this file imports
// `internalMutation`/`query` from `./_generated/server`, so any browser code
// that value-imported either constant/predicate directly from here pulled
// the whole Convex server runtime into the client bundle. Not re-exported
// here on purpose — a re-export would keep the old `./controlVerbSwaps`
// import path resolving for browser code and let the same defect return
// silently; `isBrainSwap`/`SWAP_HISTORY_CAP` now have exactly one import
// path (`./controlVerbSwapsFilters`), used by both this file and
// `src/hooks/useControlVerbSwaps.ts`.

/**
 * record — Append-only insert of one control_verb_swap row. Never patches or
 * deletes an existing row.
 *
 * D-13: this mutation is the ONLY write path for the swap-history axis, and
 * it is reachable ONLY from the astridr `control_verb_swap` telemetry ingest
 * case (convex/runtimeIngest.ts, plan 108-03). The UI must NEVER call this
 * directly to assert a swap happened.
 *
 * ENFORCED (CR-01 rule, same as activeEngine.ts's recordRouting): declared
 * as an `internalMutation`, so it does not exist in the client-callable
 * `api.` namespace at all. This closes the devtools-forgeable write path a
 * plain `mutation` would leave open — any holder of the shipped
 * VITE_CONVEX_URL could otherwise call `api.controlVerbSwaps.record`
 * directly and insert a fabricated "server-confirmed" swap-history row that
 * the D-15 GlobalSwapModal history section would render as truth.
 */
export const record = internalMutation({
  args: {
    verb: v.string(),
    target: v.optional(v.string()),
    resolved: v.optional(v.string()),
    // 108-07 gap closure (second round): the emitter always sends a real
    // JSON array (list[str]) — see schema.ts's providerAffinity comment and
    // runtimeIngest.ts's isOptionalStringArray.
    providerAffinity: v.optional(v.array(v.string())),
    voiceId: v.optional(v.string()),
    path: v.string(),
    reason: v.optional(v.string()),
    scope: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    channel: v.string(),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("controlVerbSwaps", { ...args });
  },
});

/**
 * listByScope — Returns the most recent swap-history rows for one profile
 * scope, newest first. A `query`, not an `internalMutation`, because D-15's
 * modal legitimately reads it from the client. Bounded by SWAP_HISTORY_CAP
 * over the by_scope index — never an unbounded collect on this append-only table
 * (T-108-12): an unbounded read on a growing table is exactly what breached
 * the 16 MiB limit in Phase 88.
 */
export const listByScope = query({
  args: {
    profileId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("controlVerbSwaps")
      .withIndex("by_scope", (q) => q.eq("scope", args.profileId))
      .order("desc")
      .take(SWAP_HISTORY_CAP);
  },
});
