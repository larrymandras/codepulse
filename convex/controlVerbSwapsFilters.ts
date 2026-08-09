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

/**
 * mergeSwapHistory — Phase 109 (TELE-02, D-11). Combines one profile's
 * scoped swap-history rows with the global swap-history rows into a single,
 * bounded, deterministically-ordered list, for D-10's Settings-hosted
 * per-profile history readout.
 *
 * Lives here, not in `controlVerbSwaps.ts` or inline in the hook, for the
 * same WR-02 reason `isBrainSwap`/`SWAP_HISTORY_CAP` do (see file docstring
 * above): it must stay importable from browser code with zero risk of
 * dragging in `_generated/server` or `convex/values` — no import of either
 * is added here.
 *
 * D-11's reason for combining rather than showing the scoped list alone: a
 * global swap genuinely DOES change an unpinned profile's engine (D-04's
 * precedence — a global override outranks an absent per-profile one), so a
 * scoped-only history claims nothing happened at a moment the profile's
 * engine actually changed. Showing only scoped rows would be a silent
 * omission, not a smaller-but-honest view.
 *
 * `SWAP_HISTORY_CAP` is reused as the combined DISPLAY cap. Each input array
 * already arrives capped at `SWAP_HISTORY_CAP` from its own query
 * (`listByScope`/`listGlobal`), so a scoped+global merge can reach 2x cap —
 * this function re-caps the merged list and returns the true pre-truncation
 * count so the UI can state truncation on screen rather than silently
 * dropping rows (this repo's standing bound-every-read-and-state-truncation
 * rule, Phase 105 D-11/D-12).
 *
 * Does NOT filter by `verb` — `filterBrainSwaps` (useControlVerbSwaps.ts)
 * already owns that, applied by the consumer after merging. Keeping the two
 * concerns separate preserves both functions' single responsibility.
 */
export function mergeSwapHistory<T extends { _id: string; timestamp: number }>(
  scoped: T[],
  global: T[]
): { rows: (T & { origin: "scoped" | "global" })[]; totalCount: number } {
  const tagged: (T & { origin: "scoped" | "global" })[] = [
    ...scoped.map((row) => ({ ...row, origin: "scoped" as const })),
    ...global.map((row) => ({ ...row, origin: "global" as const })),
  ];

  // Deterministic tie-break by `_id` so ordering is stable across renders
  // and independent of input order, even when two rows share a timestamp
  // (e.g. a scoped pin and a global swap emitted in the same batch).
  tagged.sort((a, b) => {
    if (b.timestamp !== a.timestamp) {
      return b.timestamp - a.timestamp;
    }
    return a._id < b._id ? -1 : a._id > b._id ? 1 : 0;
  });

  return {
    rows: tagged.slice(0, SWAP_HISTORY_CAP),
    totalCount: tagged.length,
  };
}
