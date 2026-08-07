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
 */

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { isBrainSwap, SWAP_HISTORY_CAP } from "../../convex/controlVerbSwaps";

export { SWAP_HISTORY_CAP };

/** Mirrors `listByScope`'s row shape (convex/controlVerbSwaps.ts / 108-06-PLAN.md's
 * `<interfaces>` block) verbatim. */
export type SwapHistoryRow = {
  _id: string;
  verb: string;
  target?: string;
  resolved?: string;
  providerAffinity?: string;
  voiceId?: string;
  path: string;
  reason?: string;
  scope?: string;
  sessionId?: string;
  channel: string;
  timestamp: number;
};

const EMPTY_ROWS: SwapHistoryRow[] = [];

/**
 * useControlVerbSwaps — the most recent (up to `SWAP_HISTORY_CAP`) swap-history rows for one
 * profile scope, newest first. `undefined` when no `profileId` is supplied never fabricates a
 * read (see header comment) — it skips the query and returns the same honest-empty `[]` as a
 * real profile with zero rows so far.
 */
export function useControlVerbSwaps(profileId: string | undefined): SwapHistoryRow[] {
  return (
    (useQuery(
      api.controlVerbSwaps.listByScope,
      profileId ? { profileId } : "skip"
    ) as SwapHistoryRow[] | undefined) ?? EMPTY_ROWS
  );
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
