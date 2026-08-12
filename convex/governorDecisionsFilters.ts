/**
 * governorDecisionsFilters.ts — the shared, dependency-free constant for the
 * governor-decision axis (Phase 112, TELE-03, D-04).
 *
 * Split out from `convex/governorDecisions.ts` for the same reason
 * `controlVerbSwapsFilters.ts` was split from `controlVerbSwaps.ts` (108-06
 * runtime bundling defect, see 108-REVIEW.md): `governorDecisions.ts`
 * imports `internalMutation`/`query` from `./_generated/server`, so any
 * browser code that value-imported `GOVERNOR_DECISION_CAP` directly from
 * that file would pull the whole Convex server runtime into the client
 * bundle. This file is deliberately dependency-free — no `convex/values`,
 * no `./_generated/*`, no React — so both the Convex server bundle and the
 * plan 05 browser component can import it without either pulling in the
 * other's runtime.
 */

/** Row cap for the governor-decision read. Exported so plan 05's component
 * truncation caption and the server query's `.take()` cannot drift apart —
 * mirrors `controlVerbSwapsFilters.ts`'s `SWAP_HISTORY_CAP` discipline. 50
 * is sized for a full-width page section (vs. `SWAP_HISTORY_CAP`'s 20 for a
 * modal history strip); at the measured 83.3 rows/day it covers roughly the
 * last 14 hours. */
export const GOVERNOR_DECISION_CAP = 50;
