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

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  describeSwapOutcome,
  filterBrainSwaps,
  SWAP_HISTORY_CAP,
  useCombinedSwapHistory,
  type SwapHistoryRow,
} from "./useControlVerbSwaps";
import { SWAP_HISTORY_CAP as SHARED_SWAP_HISTORY_CAP } from "../../convex/controlVerbSwapsFilters";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Mocks (Task 1, Phase 109 D-11) — `useCombinedSwapHistory` hook-level coverage ────────────
//
// Follows this repo's established hook-test idiom (src/hooks/useActiveEngine.test.ts): mock
// `convex/react`'s `useQuery` directly and a minimal `api` shape, rather than a real Convex
// runtime. The pure-function tests below this block do not touch either mock.

const mockUseQuery = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    controlVerbSwaps: {
      listByScope: "controlVerbSwaps:listByScope",
      listGlobal: "controlVerbSwaps:listGlobal",
    },
  },
}));

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

// ─── useCombinedSwapHistory (Task 1, Phase 109 D-11) ──────────────────────────────────────────

function makeBrainRow(id: string, timestamp: number): SwapHistoryRow {
  return {
    _id: id,
    verb: "swap_model",
    target: "anthropic-sonnet-5",
    resolved: "anthropic-sonnet-5",
    path: "claude-native",
    channel: "chat",
    timestamp,
  };
}

function makeVoiceRow(id: string, timestamp: number): SwapHistoryRow {
  return {
    _id: id,
    verb: "swap_voice",
    voiceId: "voice-warm",
    resolved: "voice-warm",
    path: "claude-native",
    channel: "voice",
    timestamp,
  };
}

function makeBrainRows(count: number, prefix: string, startTimestamp: number): SwapHistoryRow[] {
  return Array.from({ length: count }, (_, i) => makeBrainRow(`${prefix}-${i}`, startTimestamp + i));
}

describe("useCombinedSwapHistory", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
  });

  it("skips BOTH queries and returns the honest-absent default when profileId is undefined — never a loading state, never an error", () => {
    mockUseQuery.mockReturnValue(undefined);

    const { result } = renderHook(() => useCombinedSwapHistory(undefined));

    expect(mockUseQuery).toHaveBeenCalledWith("controlVerbSwaps:listByScope", "skip");
    expect(mockUseQuery).toHaveBeenCalledWith("controlVerbSwaps:listGlobal", "skip");
    expect(result.current).toEqual({ rows: [], totalCount: 0, atCap: false });
  });

  it("calls listByScope with {profileId} and listGlobal with {} when a real profileId is supplied", () => {
    mockUseQuery.mockImplementation((queryRef: unknown) => {
      if (queryRef === "controlVerbSwaps:listByScope") return [];
      if (queryRef === "controlVerbSwaps:listGlobal") return [];
      return undefined;
    });

    renderHook(() => useCombinedSwapHistory("personal"));

    expect(mockUseQuery).toHaveBeenCalledWith("controlVerbSwaps:listByScope", {
      profileId: "personal",
    });
    expect(mockUseQuery).toHaveBeenCalledWith("controlVerbSwaps:listGlobal", {});
  });

  it("caps the merged list at SWAP_HISTORY_CAP and reports the true pre-truncation totalCount (20 scoped + 20 global -> 20 rows, totalCount 40, atCap true)", () => {
    const scoped = makeBrainRows(20, "scoped", 1000);
    const global = makeBrainRows(20, "global", 2000);
    mockUseQuery.mockImplementation((queryRef: unknown) => {
      if (queryRef === "controlVerbSwaps:listByScope") return scoped;
      if (queryRef === "controlVerbSwaps:listGlobal") return global;
      return undefined;
    });

    const { result } = renderHook(() => useCombinedSwapHistory("personal"));

    expect(result.current.rows).toHaveLength(SWAP_HISTORY_CAP);
    expect(result.current.totalCount).toBe(40);
    expect(result.current.atCap).toBe(true);
  });

  it("CONTROL: a combined list under the cap is not truncated and atCap is false (3 scoped + 2 global -> 5 rows, totalCount 5, atCap false)", () => {
    const scoped = makeBrainRows(3, "scoped", 1000);
    const global = makeBrainRows(2, "global", 2000);
    mockUseQuery.mockImplementation((queryRef: unknown) => {
      if (queryRef === "controlVerbSwaps:listByScope") return scoped;
      if (queryRef === "controlVerbSwaps:listGlobal") return global;
      return undefined;
    });

    const { result } = renderHook(() => useCombinedSwapHistory("personal"));

    expect(result.current.rows).toHaveLength(5);
    expect(result.current.totalCount).toBe(5);
    expect(result.current.atCap).toBe(false);
  });

  it("a voice swap present in either source appears in NEITHER rows NOR totalCount — filtering happens before the merge", () => {
    const scoped = [makeBrainRow("scoped-brain", 1000), makeVoiceRow("scoped-voice", 1001)];
    const global = [makeBrainRow("global-brain", 2000), makeVoiceRow("global-voice", 2001)];
    mockUseQuery.mockImplementation((queryRef: unknown) => {
      if (queryRef === "controlVerbSwaps:listByScope") return scoped;
      if (queryRef === "controlVerbSwaps:listGlobal") return global;
      return undefined;
    });

    const { result } = renderHook(() => useCombinedSwapHistory("personal"));

    expect(result.current.totalCount).toBe(2);
    expect(result.current.rows.map((r) => r._id).sort()).toEqual(
      ["global-brain", "scoped-brain"].sort()
    );
    expect(result.current.rows.some((r) => r._id.includes("voice"))).toBe(false);
  });

  it("each row carries an origin discriminant matching which query it came from", () => {
    const scoped = [makeBrainRow("scoped-a", 1000)];
    const global = [makeBrainRow("global-a", 2000)];
    mockUseQuery.mockImplementation((queryRef: unknown) => {
      if (queryRef === "controlVerbSwaps:listByScope") return scoped;
      if (queryRef === "controlVerbSwaps:listGlobal") return global;
      return undefined;
    });

    const { result } = renderHook(() => useCombinedSwapHistory("personal"));

    const byId = Object.fromEntries(result.current.rows.map((r) => [r._id, r.origin]));
    expect(byId["scoped-a"]).toBe("scoped");
    expect(byId["global-a"]).toBe("global");
  });
});

// ─── SWAP_HISTORY_CAP re-export ────────────────────────────────────────────────────────────────
//
// Restructured (2026-08-07, bundling defect fix — see 108-REVIEW.md): the hook and this test now
// both import SWAP_HISTORY_CAP from the same pure `controlVerbSwapsFilters.ts` module (previously
// the hook re-exported a value it imported from `convex/controlVerbSwaps.ts`, which is why THIS
// test used to import its comparison value from that same file). Comparing the hook's re-export to
// a second import of the identical binding is now tautological (`x === x`), so the second test
// below reads convex/controlVerbSwaps.ts's own SOURCE and asserts its `.take()` call still
// references the shared symbolic constant rather than a hardcoded literal — the real place drift
// could still be reintroduced (e.g. someone hardcodes `.take(30)` in the server query without
// touching the shared module or this hook).

describe("SWAP_HISTORY_CAP", () => {
  it("re-exports the same shared constant imported from convex/controlVerbSwapsFilters.ts", () => {
    expect(SWAP_HISTORY_CAP).toBe(SHARED_SWAP_HISTORY_CAP);
    expect(SWAP_HISTORY_CAP).toBe(20);
  });

  it("the server query (convex/controlVerbSwaps.ts) actually consumes the shared constant in its .take(), not a hardcoded literal — genuine drift guard, since the assertion above alone would now pass even if the server file stopped importing the shared constant", () => {
    const controlVerbSwapsPath = path.resolve(__dirname, "../../convex/controlVerbSwaps.ts");
    const source = readFileSync(controlVerbSwapsPath, "utf-8");
    expect(source).toMatch(
      /import\s*\{[^}]*SWAP_HISTORY_CAP[^}]*\}\s*from\s*["']\.\/controlVerbSwapsFilters["']/
    );
    expect(source).toMatch(/\.take\(SWAP_HISTORY_CAP\)/);
    expect(source).not.toMatch(/\.take\(\s*20\s*\)/);
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
