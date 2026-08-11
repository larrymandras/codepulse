/**
 * useControlVerbSwaps.ts — D-15's swap-history read hook (Phase 108 Plan 06, TELE-02).
 *
 * Wraps `api.controlVerbSwaps.listByScope` (108-02) following `useToolPolicyEvents.ts`'s
 * "collapse loading and empty into one honest-empty default" convention (NOT
 * `useToolPolicyLastReceived`'s deliberate `undefined`-preserving exception): there is no
 * D-07-style distinction to protect here — "no history yet" and "still loading" are both
 * correctly, honestly rendered as an empty history section by `GlobalSwapModal`'s
 * `SwapHistorySection`, so nothing downstream needs to tell them apart. Coalescing at the
 * query boundary also means this hook can never return `undefined` itself, matching
 * `useActiveEngine.ts`'s "must never blank the caller" discipline.
 *
 * `profileId` is `string | undefined` because `GlobalSwapModal` (D-15's host) is the
 * ALL-PROFILES swap axis (103-CONTRACT.md §8) — it has no single profile to scope by. Per
 * 108-06-PLAN.md's own stated fallback, passing `undefined` skips the query outright
 * (`useQuery(..., "skip")`) rather than inventing a profile id to query with — that is the
 * honest-absent state, not a loading state and not an error.
 *
 * Phase 109 (D-10/D-11, TELE-02's surfaced half): `useCombinedSwapHistory` below adds a SECOND
 * read, combining this profile's own scoped rows with the global (fleet-wide) swap rows via
 * `mergeSwapHistory` (convex/controlVerbSwapsFilters.ts). It exists because D-04's corrected
 * precedence means a global swap genuinely CAN change an unpinned profile's engine — a
 * scoped-only history (this hook, unchanged, still the ALL-PROFILES-axis's own read) would claim
 * nothing happened at a moment the profile's engine actually did change. Each of
 * `listByScope`/`listGlobal` is independently bounded at `SWAP_HISTORY_CAP` server-side, so a
 * naive concatenation could reach 2x cap — `mergeSwapHistory` re-caps the merged list and reports
 * the true pre-truncation `totalCount` separately, so a consumer can render both a bounded list
 * and an honest on-screen truncation statement (this repo's standing Phase 105 D-11/D-12 rule)
 * instead of silently dropping rows.
 */

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { isBrainSwap, mergeSwapHistory, SWAP_HISTORY_CAP } from "../../convex/controlVerbSwapsFilters";

export { SWAP_HISTORY_CAP };

/** Mirrors `listByScope`'s row shape (convex/controlVerbSwaps.ts / 108-06-PLAN.md's
 * `<interfaces>` block) verbatim. */
export type SwapHistoryRow = {
  _id: string;
  verb: string;
  target?: string;
  resolved?: string;
  providerAffinity?: string[];
  voiceId?: string;
  path: string;
  reason?: string;
  scope?: string;
  sessionId?: string;
  channel: string;
  timestamp: number;
};

const EMPTY_ROWS: SwapHistoryRow[] = [];

// `useControlVerbSwaps()` — the SCOPED-ONLY read — was removed 2026-08-11 by the
// v14.0 audit (INT-06). It had zero non-test call sites: Phase 109 D-11 replaced
// it everywhere with `useCombinedSwapHistory` below, because a global swap
// genuinely CAN change an unpinned profile's engine, so a scoped-only history
// silently omitted rows the operator needed to see. `EMPTY_ROWS` is retained —
// `useCombinedSwapHistory` uses it for the same honest-empty guarantee.

/** A merged row, tagged with which query it came from (D-11/D-12) — the ONLY signal that
 * distinguishes "this profile's own swap" (`origin: "scoped"`, no badge) from "a fleet-wide swap"
 * (`origin: "global"`, GLOBAL badge) at render time. */
export type CombinedSwapHistoryRow = SwapHistoryRow & { origin: "scoped" | "global" };

export interface CombinedSwapHistory {
  rows: CombinedSwapHistoryRow[];
  /** True pre-truncation count of BRAIN swaps across both sources — never the capped
   * `rows.length` — so a consumer's count badge can state the honest total even when it exceeds
   * the display cap (UI-SPEC §H: "Swap history (37)" alongside a 20-row truncation caption). */
  totalCount: number;
  /** `rows.length >= SWAP_HISTORY_CAP` — the merged list is genuinely at the display cap. */
  atCap: boolean;
}

const EMPTY_COMBINED: CombinedSwapHistory = { rows: [], totalCount: 0, atCap: false };

/**
 * useCombinedSwapHistory — Phase 109 (D-10/D-11, TELE-02's surfaced half). Combines
 * `listByScope(profileId)` with the new `listGlobal()` (109-02) into one bounded,
 * newest-first, brain-swap-only list for D-10's Settings-hosted per-profile history section.
 *
 * `profileId === undefined` skips BOTH underlying queries (`useQuery(..., "skip")`) and returns
 * the same honest-absent `{ rows: [], totalCount: 0, atCap: false }` this file's other hook
 * already establishes for "no profile to scope by" — never a loading state, never an error.
 *
 * Filtering (`filterBrainSwaps`) is applied to EACH source before merging, not after, so
 * `totalCount` reports the number of BRAIN swaps the operator could actually see rather than a
 * raw row count that silently includes voice rows — otherwise the on-screen count badge would
 * claim history the list deliberately never shows. A voice swap can never be per-profile anyway
 * (Ástríðr rejects `profile_id` for `target='voice'`), but filtering before merging makes that
 * structural here rather than incidental.
 */
export function useCombinedSwapHistory(profileId: string | undefined): CombinedSwapHistory {
  const scopedRaw = useQuery(
    api.controlVerbSwaps.listByScope,
    profileId ? { profileId } : "skip"
  ) as SwapHistoryRow[] | undefined;
  const globalRaw = useQuery(
    api.controlVerbSwaps.listGlobal,
    profileId ? {} : "skip"
  ) as SwapHistoryRow[] | undefined;

  if (profileId === undefined) {
    return EMPTY_COMBINED;
  }

  const scoped = filterBrainSwaps(scopedRaw ?? EMPTY_ROWS);
  const global = filterBrainSwaps(globalRaw ?? EMPTY_ROWS);
  const { rows, totalCount } = mergeSwapHistory(scoped, global);

  return { rows, totalCount, atCap: rows.length >= SWAP_HISTORY_CAP };
}

/**
 * filterBrainSwaps — PURE, exported for direct unit testing (mirrors `deduplicateByProfile`'s
 * precedent in convex/activeEngine.ts). Delegates to `convex/controlVerbSwaps.ts`'s own
 * `isBrainSwap` predicate rather than re-testing the brain verb string here, so the ingest-side
 * and UI-side definitions of "a brain swap" cannot drift apart into two subtly different
 * predicates. `isBrainSwap` itself matches the brain verb POSITIVELY rather than excluding the
 * voice verb by name, so a future third verb defaults to excluded, not accidentally surfaced.
 */
export function filterBrainSwaps(rows: SwapHistoryRow[]): SwapHistoryRow[] {
  return rows.filter(isBrainSwap);
}

export type SwapOutcomeKind = "success" | "refused" | "unresolved" | "restore";

export interface SwapOutcomePresentation {
  kind: SwapOutcomeKind;
  label: string;
}

/**
 * describeSwapOutcome — PURE, exported. Derives the outcome vocabulary ONCE so every render
 * site (today's `GlobalSwapModal`, any future one) reads the same four-way split instead of
 * each re-deriving its own — the drift `useToolPolicyEvents.ts`'s `policyKindPresentation`
 * exists to prevent for policy kinds, applied here to swap outcomes (T-108-24: a refusal or an
 * unresolved swap must never render as though it succeeded).
 *
 * Order matters: `path === "restore"` is checked before `path === "refused"` — a restore is
 * never itself a refusal, so restore must win first even though both are checked against the
 * same field.
 */
export function describeSwapOutcome(row: {
  path: string;
  resolved?: string | null;
  reason?: string;
}): SwapOutcomePresentation {
  if (row.path === "restore") {
    return { kind: "restore", label: "Restored" };
  }
  if (row.path === "refused") {
    return {
      kind: "refused",
      label: row.reason ? `Refused — ${row.reason}` : "Refused",
    };
  }
  if (row.resolved == null) {
    return { kind: "unresolved", label: "Unresolved" };
  }
  return { kind: "success", label: "Switched" };
}
