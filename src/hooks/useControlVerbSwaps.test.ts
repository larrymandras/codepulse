/**
 * useControlVerbSwaps.test.ts — pure-function tests only (Task 1, 108-06-PLAN.md).
 *
 * `useControlVerbSwaps` itself (the `useQuery` wrapper) is exercised indirectly through
 * `GlobalSwapModal.test.tsx`, which mocks it directly the way `BrainHeaderBadge.test.tsx` mocks
 * `useActiveEngine` — a real React-hook-in-a-component test belongs there, not here. This file
 * covers `filterBrainSwaps` and `describeSwapOutcome`, both PURE and independent of any Convex
 * runtime or React tree, so no mocking is needed to import them directly.
 *
 * The four `describeSwapOutcome` fixtures below are shaped after the four `swap_model.py` emit
 * sites D-13 names (`swap_model.py:444` restore, `:472` unresolved, `:483` affinity-refused,
 * `:495` success) rather than invented shapes, per 108-06-PLAN.md's explicit instruction.
 */

import { describe, expect, it } from "vitest";
import {
  describeSwapOutcome,
  filterBrainSwaps,
  SWAP_HISTORY_CAP,
  type SwapHistoryRow,
} from "./useControlVerbSwaps";
import { SWAP_HISTORY_CAP as CONVEX_SWAP_HISTORY_CAP } from "../../convex/controlVerbSwaps";

// ─── Fixtures — one row per real swap_model.py emit site (D-13) ──────────────────────────────

/** swap_model.py:444 — a revert/restore back to the prior model. */
const RESTORE_ROW: SwapHistoryRow = {
  _id: "row-restore",
  verb: "swap_model",
  target: "anthropic-haiku-4-5",
  resolved: "anthropic-haiku-4-5",
  path: "restore",
  channel: "chat",
  timestamp: 1754530000,
};

/** swap_model.py:472 — the resolver could not settle on a model; `resolved` stays unset. */
const UNRESOLVED_ROW: SwapHistoryRow = {
  _id: "row-unresolved",
  verb: "swap_model",
  target: "anthropic-opus-4-8",
  path: "swap",
  channel: "chat",
  timestamp: 1754530100,
};

/** swap_model.py:483 — the affinity guard refused the swap outright. */
const REFUSED_ROW: SwapHistoryRow = {
  _id: "row-refused",
  verb: "swap_model",
  target: "anthropic-opus-4-8",
  path: "refused",
  reason: "affinity_guard",
  channel: "chat",
  timestamp: 1754530200,
};

/** swap_model.py:495 — a real successful swap. */
const SUCCESS_ROW: SwapHistoryRow = {
  _id: "row-success",
  verb: "swap_model",
  target: "anthropic-sonnet-5",
  resolved: "anthropic-sonnet-5",
  path: "claude-native",
  channel: "chat",
  timestamp: 1754530300,
};

/** A `swap_voice` row — must never survive `filterBrainSwaps` (D-15 is brain-only). */
const VOICE_ROW: SwapHistoryRow = {
  _id: "row-voice",
  verb: "swap_voice",
  voiceId: "voice-warm",
  resolved: "voice-warm",
  path: "claude-native",
  channel: "voice",
  timestamp: 1754530400,
};

// ─── SWAP_HISTORY_CAP re-export ────────────────────────────────────────────────────────────────

describe("SWAP_HISTORY_CAP", () => {
  it("re-exports the exact same value convex/controlVerbSwaps.ts's query is bounded by, never a duplicated literal", () => {
    expect(SWAP_HISTORY_CAP).toBe(CONVEX_SWAP_HISTORY_CAP);
    expect(SWAP_HISTORY_CAP).toBe(20);
  });
});

// ─── filterBrainSwaps ───────────────────────────────────────────────────────────────────────

describe("filterBrainSwaps", () => {
  it("returns [] for empty input, asserted explicitly (never undefined)", () => {
    const result = filterBrainSwaps([]);
    expect(result).toEqual([]);
    expect(result).not.toBeUndefined();
  });

  it("keeps swap_model rows and drops swap_voice rows from a mixed array", () => {
    const result = filterBrainSwaps([SUCCESS_ROW, VOICE_ROW, REFUSED_ROW]);
    expect(result).toEqual([SUCCESS_ROW, REFUSED_ROW]);
  });

  it("returns [] when every row is a swap_voice row — brain-only filter guard (D-15)", () => {
    expect(filterBrainSwaps([VOICE_ROW])).toEqual([]);
  });
});

// ─── describeSwapOutcome — one input row per real swap_model.py emit site (D-13) ──────────────

describe("describeSwapOutcome", () => {
  it("maps a restore row (swap_model.py:444) to kind:'restore'", () => {
    expect(describeSwapOutcome(RESTORE_ROW)).toEqual({ kind: "restore", label: "Restored" });
  });

  it("maps an unresolved row (swap_model.py:472 — resolved:undefined, a non-refused path) to kind:'unresolved'", () => {
    expect(describeSwapOutcome(UNRESOLVED_ROW)).toEqual({
      kind: "unresolved",
      label: "Unresolved",
    });
  });

  it("maps a null-resolved row to kind:'unresolved' too (resolved:null, not just resolved:undefined)", () => {
    expect(describeSwapOutcome({ path: "swap", resolved: null })).toEqual({
      kind: "unresolved",
      label: "Unresolved",
    });
  });

  it("maps a refused row WITH a reason (swap_model.py:483) to kind:'refused', surfacing the reason in the label", () => {
    expect(describeSwapOutcome(REFUSED_ROW)).toEqual({
      kind: "refused",
      label: "Refused — affinity_guard",
    });
  });

  it("maps a refused row with no reason to kind:'refused' with a plain label — never fabricates a reason", () => {
    expect(describeSwapOutcome({ path: "refused" })).toEqual({
      kind: "refused",
      label: "Refused",
    });
  });

  it("maps a success row (swap_model.py:495) to kind:'success'", () => {
    expect(describeSwapOutcome(SUCCESS_ROW)).toEqual({ kind: "success", label: "Switched" });
  });

  it("never mistakes a restore for a refusal even though both are checked from the same 'path' field", () => {
    // Regression guard: if the restore/refused branch order were ever reversed, this would fail.
    expect(describeSwapOutcome(RESTORE_ROW).kind).not.toBe("refused");
  });
});
