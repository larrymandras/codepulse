/**
 * SwapHistoryList.test.tsx — Phase 109 (TELE-02, D-10/D-11/D-12).
 *
 * Mocks `useCombinedSwapHistory` (the useQuery-backed combined read) and
 * `useProfileBrainOverrides` (the live pin-state source) directly — the same pattern
 * `GlobalSwapModal.test.tsx` uses for `useControlVerbSwaps` and `Settings.test.tsx` uses for
 * `useResolvedBrain`'s override hooks. `describeSwapOutcome` stays REAL (via `importOriginal`) so
 * these tests exercise the real outcome-vocabulary logic together with the real render, not a
 * hand-copied mirror of it.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SWAP_HISTORY_CAP,
  type CombinedSwapHistoryRow,
} from "@/hooks/useControlVerbSwaps";
import { SwapHistoryList } from "./SwapHistoryList";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockUseCombinedSwapHistory = vi.fn<
  (profileId: string | undefined) => { rows: CombinedSwapHistoryRow[]; totalCount: number; atCap: boolean }
>();
vi.mock("@/hooks/useControlVerbSwaps", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useControlVerbSwaps")>();
  return {
    ...actual,
    useCombinedSwapHistory: (profileId: string | undefined) =>
      mockUseCombinedSwapHistory(profileId),
  };
});

let mockProfileOverrides: Record<string, { model: string; source: string | null }> = {};
vi.mock("@/hooks/useResolvedBrain", () => ({
  useProfileBrainOverrides: () => mockProfileOverrides,
}));

beforeEach(() => {
  mockUseCombinedSwapHistory.mockReset();
  mockUseCombinedSwapHistory.mockReturnValue({ rows: [], totalCount: 0, atCap: false });
  mockProfileOverrides = {};
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SCOPED_SUCCESS_ROW: CombinedSwapHistoryRow = {
  _id: "row-scoped-success",
  verb: "swap_model",
  target: "anthropic-sonnet-5",
  resolved: "anthropic-sonnet-5",
  path: "claude-native",
  channel: "chat",
  timestamp: 1754530300,
  origin: "scoped",
};

const GLOBAL_SUCCESS_ROW: CombinedSwapHistoryRow = {
  _id: "row-global-success",
  verb: "swap_model",
  target: "anthropic-opus-4-8",
  resolved: "anthropic-opus-4-8",
  path: "claude-native",
  channel: "chat",
  timestamp: 1754530200,
  origin: "global",
};

const SCOPED_REFUSED_ROW: CombinedSwapHistoryRow = {
  _id: "row-scoped-refused",
  verb: "swap_model",
  target: "anthropic-opus-4-8",
  path: "refused",
  reason: "affinity_guard",
  channel: "chat",
  timestamp: 1754530100,
  origin: "scoped",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("SwapHistoryList — honest render-nothing gate", () => {
  it("renders nothing when profileId is undefined, even when the hook has rows to show", () => {
    mockUseCombinedSwapHistory.mockReturnValue({
      rows: [SCOPED_SUCCESS_ROW, GLOBAL_SUCCESS_ROW],
      totalCount: 2,
      atCap: false,
    });

    const { container } = render(<SwapHistoryList profileId={undefined} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("still calls the hook with the given profileId — only the render is gated (Rules of Hooks)", () => {
    render(<SwapHistoryList profileId={undefined} />);
    expect(mockUseCombinedSwapHistory).toHaveBeenCalledWith(undefined);
  });
});

describe("SwapHistoryList — GLOBAL badge (D-12)", () => {
  it("renders the GLOBAL badge on a global-origin row, paired with a control asserting a scoped-origin row in the SAME list renders no badge", () => {
    mockUseCombinedSwapHistory.mockReturnValue({
      rows: [GLOBAL_SUCCESS_ROW, SCOPED_SUCCESS_ROW],
      totalCount: 2,
      atCap: false,
    });

    render(<SwapHistoryList profileId="personal" />);

    const globalRow = screen.getByText("anthropic-opus-4-8 → anthropic-opus-4-8").closest("div");
    const scopedRow = screen.getByText("anthropic-sonnet-5 → anthropic-sonnet-5").closest("div");
    expect(globalRow).not.toBeNull();
    expect(scopedRow).not.toBeNull();

    expect(globalRow!.textContent).toContain("Global");
    expect(scopedRow!.textContent).not.toContain("Global");
  });
});

describe("SwapHistoryList — pinned note (D-12, live-state-derived)", () => {
  it("renders the pinned note when the profile holds a live override, paired with a control asserting it does NOT render for a profile absent from the override map even when that profile's history contains a prior scoped set — proving the note is live-derived, not reconstructed", () => {
    mockUseCombinedSwapHistory.mockReturnValue({
      rows: [SCOPED_SUCCESS_ROW],
      totalCount: 1,
      atCap: false,
    });

    // CONTROL first: no live override for "personal", even though history has a prior scoped
    // set row — the note must NOT render.
    mockProfileOverrides = {};
    const { unmount } = render(<SwapHistoryList profileId="personal" />);
    expect(
      screen.queryByText("This profile is pinned — global swaps below did not change its engine.")
    ).not.toBeInTheDocument();
    unmount();

    // Now with a live override present for the SAME profile and the SAME history rows.
    mockProfileOverrides = { personal: { model: "claude-opus-4-8", source: "operator" } };
    render(<SwapHistoryList profileId="personal" />);
    expect(
      screen.getByText("This profile is pinned — global swaps below did not change its engine.")
    ).toBeInTheDocument();
  });
});

describe("SwapHistoryList — empty state and truncation captions", () => {
  it("renders the section-H empty-state string when there are zero rows", () => {
    mockUseCombinedSwapHistory.mockReturnValue({ rows: [], totalCount: 0, atCap: false });
    render(<SwapHistoryList profileId="personal" />);

    expect(
      screen.getByText(
        "No swaps recorded yet for this profile — includes both direct swaps and global overrides."
      )
    ).toBeInTheDocument();
  });

  it("renders the at-cap truncation caption when atCap is true", () => {
    const capRows: CombinedSwapHistoryRow[] = Array.from(
      { length: SWAP_HISTORY_CAP },
      (_, i) => ({ ...SCOPED_SUCCESS_ROW, _id: `cap-row-${i}`, timestamp: 1000 + i })
    );
    mockUseCombinedSwapHistory.mockReturnValue({ rows: capRows, totalCount: 37, atCap: true });
    render(<SwapHistoryList profileId="personal" />);

    expect(
      screen.getByText(
        `Showing the last ${SWAP_HISTORY_CAP} combined swaps (per-profile + global) — earlier swaps may exist.`
      )
    ).toBeInTheDocument();
  });

  it("renders the singular under-cap caption for exactly one row", () => {
    mockUseCombinedSwapHistory.mockReturnValue({
      rows: [SCOPED_SUCCESS_ROW],
      totalCount: 1,
      atCap: false,
    });
    render(<SwapHistoryList profileId="personal" />);

    expect(screen.getByText("Showing 1 swap (per-profile + global).")).toBeInTheDocument();
  });

  it("renders the plural under-cap caption for more than one row", () => {
    mockUseCombinedSwapHistory.mockReturnValue({
      rows: [SCOPED_SUCCESS_ROW, GLOBAL_SUCCESS_ROW, SCOPED_REFUSED_ROW],
      totalCount: 3,
      atCap: false,
    });
    render(<SwapHistoryList profileId="personal" />);

    expect(screen.getByText("Showing 3 swaps (per-profile + global).")).toBeInTheDocument();
  });
});

describe("SwapHistoryList — outcome rendering reuses the existing four-way vocabulary", () => {
  it("renders a refusal as a refusal (T-108-24), asserted on rendered text, not a prop", () => {
    mockUseCombinedSwapHistory.mockReturnValue({
      rows: [SCOPED_REFUSED_ROW],
      totalCount: 1,
      atCap: false,
    });
    render(<SwapHistoryList profileId="personal" />);

    expect(screen.getByText("Refused — affinity_guard")).toBeInTheDocument();
  });

  it("renders a success as Switched", () => {
    mockUseCombinedSwapHistory.mockReturnValue({
      rows: [SCOPED_SUCCESS_ROW],
      totalCount: 1,
      atCap: false,
    });
    render(<SwapHistoryList profileId="personal" />);

    expect(screen.getByText("Switched")).toBeInTheDocument();
  });
});
