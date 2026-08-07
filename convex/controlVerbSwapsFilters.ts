/**
 * controlVerbSwapsFilters.ts — the shared, dependency-free constant + predicate for the
 * control-verb-swap axis (Phase 108, TELE-02, D-13/D-14).
 *
 * Split out of `convex/controlVerbSwaps.ts` (bundling defect found at RUNTIME after 108-06 shipped,
 * see 108-REVIEW.md): `controlVerbSwaps.ts` imports `internalMutation`/`query` from
 * `./_generated/server` to define `record`/`listByScope`, so any browser code that value-imported
 * `SWAP_HISTORY_CAP`/`isBrainSwap` directly from that file pulled the whole Convex server runtime
 * into the client bundle — exactly the "Convex functions should not be imported in the browser"
 * warning. Mirrors `activeEngineFilters.ts`'s precedent for the active-engine axis: deliberately
 * dependency-free — no `convex/values`, no `./_generated/*`, no React — so the Convex server bundle
 * and the browser bundle can both import it without either pulling in the other's runtime.
 */

/** Row cap for the per-scope swap-history read. Exported so the D-15 UI's
 * on-screen truncation caption and the server query's `.take()` cannot drift
 * apart — mirrors `activeEngine.ts`'s bounded-read discipline, sized for a
 * modal history section (vs. `latestByProfile`'s 200 for a dashboard-wide
 * read). */
export const SWAP_HISTORY_CAP = 20;

/**
 * isBrainSwap — Pure helper: true when a controlVerbSwaps row is a brain
 * (swap_model) swap rather than a voice (swap_voice) swap. Exported so it
 * can be unit-tested directly and reused by a future D-15 readout, following
 * `deduplicateByProfile`'s precedent (activeEngine.ts) of exporting a pure
 * predicate solely for testability.
 */
export function isBrainSwap<T extends { verb: string }>(row: T): boolean {
  return row.verb === "swap_model";
}
