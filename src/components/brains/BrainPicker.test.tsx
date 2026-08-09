/**
 * BrainPicker.test.tsx — 103-05-T2, extended 103-08 for the scope-aware catalogue fix, rewritten
 * under Phase 109 Plan 03 (D-01/D-02) for the D-16 seam retirement.
 *
 * `@/hooks/useBrainCatalogue` is mocked directly (controllable `entries`/`error`/a `refetch` spy) —
 * this file tests BrainPicker's OWN composition of the hook (fetch-on-open via `refetch()`,
 * loading/error/empty states, normalization into grouped rows), not the hook's own fetch/generation
 * -guard behavior (covered directly by `useBrainCatalogue.test.ts`). `@/hooks/useCommandDispatch` is
 * mocked directly (a `mockDispatch` spy) — both the "This profile" branch's `swap.set` dispatch AND
 * (for the "real GlobalSwapModal" describe blocks below) `GlobalSwapModal`'s own global-axis
 * dispatch share this SAME mock, since both now go through the one `useCommandDispatch()` sender.
 *
 * `convex/react` + the generated Convex API module are mocked only because `BrainPickerRow` (reused
 * verbatim, per plan) transitively calls the real `useProviderHealth()` hook — same mocking idiom
 * `BrainPickerRow.test.tsx` already established for this exact reason.
 *
 * `@/hooks/useResolvedBrain`'s `useGlobalBrainOverride` is mocked directly (103-12, WR-02) — a
 * plain mutable `mockGlobalOverride` object the picker reads for the "All profiles" scope's row
 * highlight.
 *
 * D-02 REALITY CHECK, read before extending this file: `normalizeCatalogueEntry` (`BrainPicker.tsx`)
 * flattens every live catalogue entry to `group: "api"`, `costTier: "normal"` regardless of vendor
 * — this is the SAME flattening the pre-Phase-109 "All profiles" scope already applied, now shared
 * by both scopes. Two direct consequences, both already documented in `109-CONTEXT.md` D-09/D-13 as
 * an accepted, deferred gap (plan 109-07's job, out of THIS plan's scope):
 *   1. Only the "API" group heading is reachable through the picker's live catalogue today —
 *      Subscription/Local are structurally unreachable (D-13).
 *   2. `needsCostConfirm` (which gates on `costTier !== "normal"`) can never fire through the
 *      picker's live catalogue either — the expensive/unknown-tier inline-confirm branch is fully
 *      covered directly against hand-built fixtures in `BrainPickerRow.test.tsx` instead.
 * Both are asserted directly below (not silently dropped) so a future re-introduction of real
 * grouping/cost-tier data is caught by an assertion that no longer holds, not by nothing at all.
 *
 * 103-16 (CR-01): `GlobalSwapModal`'s own mock (below) is why the reselect-same-brain defect
 * shipped invisibly in the first place — every test in this file that exercised the global-swap
 * open path asserted on the MOCK's props (`data-target-id`, `data-open`), never on the real
 * component's internal `phase`/`outcome` state, so nothing here could have caught a reset guard
 * that only clears on a `target.id` change. The mock now supports a module-level
 * `globalSwapModalMode` toggle ("mock" | "real") so a handful of tests can render the ACTUAL
 * `GlobalSwapModal` against this file's already-mocked `useCommandDispatch`/`useGlobalBrainOverride`/
 * `sonner` seams — see the "BrainPicker + real GlobalSwapModal" describe block.
 *
 * 103-18 (WR-01): `BrainPicker` no longer mounts/owns a `GlobalSwapModal` at all — it requests one
 * through `useGlobalSwap()`, so every render in this file must be wrapped in a real
 * `GlobalSwapProvider` (unmocked — it's the unit under test alongside `BrainPicker` itself). The
 * `GlobalSwapModal` module-level mock below is still what the provider actually renders (same
 * import path), so every existing `data-testid="global-swap-modal"` assertion in this file keeps
 * working unchanged.
 */

import { useState } from "react";
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GlobalSwapProvider } from "@/contexts/GlobalSwapContext";
import type { BrainCatalogueEntry } from "@/hooks/useBrainCatalogue";
import { BrainPicker } from "./BrainPicker";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Bare id/name/vendor — the real shape `swap.catalogue` returns. Two entries deliberately share a
 * display name ("Sonnet 5") with distinct ids — the cmdk value-keyed duplicate-selection regression
 * guard (Pitfall 3). */
const TEST_ENTRIES: BrainCatalogueEntry[] = [
  { id: "codex-cli", name: "Codex CLI", vendor: "codex" },
  { id: "antigravity-cli", name: "Antigravity CLI", vendor: "antigravity" },
  { id: "anthropic-sonnet-5", name: "Sonnet 5", vendor: "anthropic" },
  { id: "openrouter-sonnet-5-dup", name: "Sonnet 5", vendor: "openrouter" },
];

// ─── Mocks ────────────────────────────────────────────────────────────────────

let mockCatalogueEntries: BrainCatalogueEntry[] | null = TEST_ENTRIES;
let mockCatalogueError = false;
const mockRefetch = vi.fn();
vi.mock("@/hooks/useBrainCatalogue", () => ({
  useBrainCatalogue: () => ({
    entries: mockCatalogueEntries,
    defaultProfileId: "assistant-default",
    error: mockCatalogueError,
    refetch: mockRefetch,
  }),
}));

const mockDispatch = vi.fn();
vi.mock("@/hooks/useCommandDispatch", () => ({
  useCommandDispatch: () => ({
    dispatch: (...args: unknown[]) => mockDispatch(...args),
    isConnected: true,
  }),
}));

let mockGlobalOverride: { modelOverride: string | null; voiceOverride: string | null } = {
  modelOverride: null,
  voiceOverride: null,
};
vi.mock("@/hooks/useResolvedBrain", () => ({
  useGlobalBrainOverride: () => mockGlobalOverride,
}));

// `let`, not `const` (103-17): a handful of OBS-8 tests below reassign these per-test to exercise
// the live 2026-07-29 checkpoint shape (zero telemetry rows, configured `modelPreferences`) —
// reset to these defaults in `beforeEach` so no reassignment leaks across tests.
let mockActiveEngines: Record<
  string,
  { profileId: string; model: string; mode: "session" | "pinned" | "inherited"; selectionPath: string; timestamp: number } | null
> = {
  "assistant-default": {
    profileId: "assistant-default",
    model: "anthropic-sonnet-5",
    mode: "pinned",
    selectionPath: "codepulse-default",
    timestamp: Date.now(),
  },
};

vi.mock("@/hooks/useActiveEngine", () => ({
  useActiveEngine: () => mockActiveEngines,
}));

let mockProfileConfigs: Array<{
  profileId: string;
  modelPreferences?: { primary?: string; fallback?: string };
}> = [{ profileId: "assistant-default" }, { profileId: "consulting" }];

vi.mock("@/hooks/useProfileConfigs", () => ({
  useProfileConfigs: () => mockProfileConfigs,
}));

// 103-12/CR-03: renders regardless of `open` — MOUNT and VISIBILITY are asserted separately via
// `data-open`, mirroring the real component's own decoupling. `mock-close`/`mock-reopen` let a
// test drive `onOpenChange` from outside exactly as GlobalSwapModal's own Done/Revert-toast flow
// would, without needing to un-mock the real component. `data-selection-nonce` (103-16) exposes the
// nonce BrainPicker passes through so a mock-mode test can assert it changes without needing the
// real component's internal reset effect.
//
// 103-16 (CR-01): `globalSwapModalMode` lets specific tests render the REAL `GlobalSwapModal`
// instead of this mock — set to "real" (and restored to "mock" in that test's own cleanup) for the
// "BrainPicker + real GlobalSwapModal" describe block below. Picking between `<actual.GlobalSwapModal>`
// and `<MockGlobalSwapModal>` via JSX (not a plain function call) keeps each on its own fiber so
// React's hook rules stay intact even though the two are never both mounted at once.
let globalSwapModalMode: "mock" | "real" = "mock";
vi.mock("@/components/brains/GlobalSwapModal", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/brains/GlobalSwapModal")>();
  function MockGlobalSwapModal(props: {
    open: boolean;
    target?: { id: string; name: string };
    profiles: unknown[];
    onOpenChange: (next: boolean) => void;
    selectionNonce?: number;
  }) {
    return (
      <div
        data-testid="global-swap-modal"
        data-target-id={props.target?.id}
        data-open={props.open ? "true" : "false"}
        data-selection-nonce={props.selectionNonce}
      >
        Global swap modal for {props.target?.name} ({props.profiles.length} profiles)
        <button type="button" onClick={() => props.onOpenChange(false)}>
          mock-close
        </button>
        <button type="button" onClick={() => props.onOpenChange(true)}>
          mock-reopen
        </button>
      </div>
    );
  }
  return {
    ...actual,
    GlobalSwapModal: (props: React.ComponentProps<typeof actual.GlobalSwapModal>) =>
      globalSwapModalMode === "real" ? (
        <actual.GlobalSwapModal {...props} />
      ) : (
        <MockGlobalSwapModal {...props} />
      ),
  };
});

const mockToastFn = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign((...args: unknown[]) => mockToastFn(...args), {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  }),
}));

const mockUseQuery = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));
vi.mock("../../../convex/_generated/api", () => ({
  api: { providerHealth: { latest: "providerHealth:latest" } },
}));

function okAck(overrides: Record<string, unknown> = {}) {
  return { type: "ack", request_id: "", status: "ok", ...overrides };
}

beforeAll(() => {
  if (typeof window.ResizeObserver === "undefined") {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  // jsdom does not implement scrollIntoView -- cmdk calls it on every ArrowDown-driven selection
  // change (103-11's keyboard-activation tests are the first in this file to exercise that path).
  if (typeof Element.prototype.scrollIntoView !== "function") {
    Element.prototype.scrollIntoView = () => {};
  }
});

beforeEach(() => {
  mockCatalogueEntries = TEST_ENTRIES;
  mockCatalogueError = false;
  mockRefetch.mockReset();
  mockDispatch.mockReset();
  mockDispatch.mockResolvedValue(okAck());
  mockToastFn.mockReset();
  mockToastSuccess.mockReset();
  mockToastError.mockReset();
  mockUseQuery.mockReset();
  mockUseQuery.mockReturnValue({});
  mockGlobalOverride = { modelOverride: null, voiceOverride: null };
  // 103-17: reset the two config/telemetry seams to their file-wide defaults so the OBS-8
  // describe block's per-test reassignments never leak into any other test in this file.
  mockActiveEngines = {
    "assistant-default": {
      profileId: "assistant-default",
      model: "anthropic-sonnet-5",
      mode: "pinned",
      selectionPath: "codepulse-default",
      timestamp: Date.now(),
    },
  };
  mockProfileConfigs = [{ profileId: "assistant-default" }, { profileId: "consulting" }];
  // 103-16: every test defaults to the lightweight mock; only the "BrainPicker + real
  // GlobalSwapModal" describe block below opts into "real" for its own tests and restores "mock"
  // in its own afterEach so this default never leaks into any other describe block in the file.
  globalSwapModalMode = "mock";
});

function renderPicker(props: Partial<React.ComponentProps<typeof BrainPicker>> = {}) {
  return render(
    <TooltipProvider>
      <GlobalSwapProvider>
        <BrainPicker profileId="assistant-default" {...props} />
      </GlobalSwapProvider>
    </TooltipProvider>
  );
}

function openPicker() {
  fireEvent.click(screen.getByRole("button", { name: /Active brain/ }));
}

// ---------------------------------------------------------------------------

describe("BrainPicker — catalogue fetch (D-02: the one shared catalogue)", () => {
  it("re-fetches (via useBrainCatalogue's refetch()) every time the popover opens, never caching client-side", async () => {
    renderPicker();

    openPicker();
    await waitFor(() => expect(mockRefetch).toHaveBeenCalledTimes(1));
    await screen.findByText("Codex CLI");

    openPicker(); // close
    openPicker(); // reopen

    await waitFor(() => expect(mockRefetch).toHaveBeenCalledTimes(2));
  });

  it("shows a loading skeleton while entries is null, then an error state when the hook reports error:true", async () => {
    mockCatalogueEntries = null;
    mockCatalogueError = false;
    const { rerender } = renderPicker();

    openPicker();
    expect(screen.getByLabelText("Loading brain catalogue")).toBeInTheDocument();

    mockCatalogueEntries = null;
    mockCatalogueError = true;
    rerender(
      <TooltipProvider>
        <GlobalSwapProvider>
          <BrainPicker profileId="assistant-default" />
        </GlobalSwapProvider>
      </TooltipProvider>
    );

    expect(
      await screen.findByText("Couldn't load the brain catalogue — try again in a moment.")
    ).toBeInTheDocument();
  });

  it("uses the SAME error copy for both scopes — the scope-specific 'not available yet' copy is gone (UI-SPEC §E collapse)", async () => {
    mockCatalogueEntries = null;
    mockCatalogueError = true;
    renderPicker();

    openPicker();
    expect(
      await screen.findByText("Couldn't load the brain catalogue — try again in a moment.")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "All profiles" }));
    expect(
      screen.getByText("Couldn't load the brain catalogue — try again in a moment.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/isn't available yet/)).not.toBeInTheDocument();
  });

  it("renders the honest 'No brains reachable' empty state for a genuinely empty (not null, not error) catalogue", async () => {
    mockCatalogueEntries = [];
    renderPicker();

    openPicker();
    expect(await screen.findByText("No brains reachable")).toBeInTheDocument();
  });
});

describe("BrainPicker — scope selector reset (D-08)", () => {
  it('reads "This profile" on every open, including after being moved to "All profiles"', async () => {
    renderPicker();

    openPicker();
    await screen.findByText("Codex CLI");
    expect(screen.getByRole("radio", { name: "This profile" })).toHaveAttribute(
      "aria-checked",
      "true"
    );

    fireEvent.click(screen.getByRole("radio", { name: "All profiles" }));
    expect(screen.getByRole("radio", { name: "All profiles" })).toHaveAttribute(
      "aria-checked",
      "true"
    );

    openPicker(); // close
    openPicker(); // reopen
    await screen.findByText("Codex CLI");

    expect(screen.getByRole("radio", { name: "This profile" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it('opens on "All profiles" once when entryScope="global" is supplied, and resets on the next open', async () => {
    renderPicker({ entryScope: "global" });

    openPicker();
    await screen.findByText("Codex CLI");
    expect(screen.getByRole("radio", { name: "All profiles" })).toHaveAttribute(
      "aria-checked",
      "true"
    );

    openPicker(); // close
    openPicker(); // reopen — the contextual default is one-time only
    await screen.findByText("Codex CLI");

    expect(screen.getByRole("radio", { name: "This profile" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("toggling scope after open issues NO additional refetch — the catalogue is scope-independent (D-02)", async () => {
    renderPicker();

    openPicker();
    await screen.findByText("Codex CLI");
    await waitFor(() => expect(mockRefetch).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("radio", { name: "All profiles" }));
    fireEvent.click(screen.getByRole("radio", { name: "This profile" }));

    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });
});

describe("BrainPicker — dispatch branch separation (D-01)", () => {
  it('dispatches exactly one real swap.set with profile_id for a "This profile" scope selection', async () => {
    renderPicker();

    openPicker();
    const row = await screen.findByText("Codex CLI");
    fireEvent.click(row);

    await waitFor(() => expect(mockDispatch).toHaveBeenCalledTimes(1));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: "swap.set",
      target: "brain",
      value: "codex-cli",
      restore: false,
      profile_id: "assistant-default",
    });
  });

  it('opens GlobalSwapModal and dispatches nothing until it confirms, in "All profiles" scope', async () => {
    renderPicker();

    openPicker();
    await screen.findByText("Codex CLI");
    fireEvent.click(screen.getByRole("radio", { name: "All profiles" }));
    await screen.findByText("Codex CLI");

    fireEvent.click(screen.getByText("Codex CLI"));

    const modal = await screen.findByTestId("global-swap-modal");
    expect(modal).toHaveAttribute("data-target-id", "codex-cli");
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("settles a never-resolving dispatch as an error within the bounded timeout instead of hanging the popover (T-109-08)", async () => {
    mockDispatch.mockImplementation(() => new Promise(() => {})); // never resolves
    renderPicker();

    // Open and locate the row on REAL timers first — testing-library's async queries poll via
    // `setTimeout`, which fake timers would otherwise freeze and hang forever (the exact failure
    // mode this ordering avoids; matches GlobalSwapModal.test.tsx's own working idiom for the
    // analogous GLOBAL_SWAP_DISPATCH_TIMEOUT_MS case).
    openPicker();
    const row = await screen.findByText("Codex CLI");

    vi.useFakeTimers();
    try {
      await act(async () => {
        fireEvent.click(row);
      });

      expect(mockDispatch).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("brain-picker-pending-suffix")).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(15000 + 100);
      });

      expect(mockToastError).toHaveBeenCalled();
      expect(mockToastError.mock.calls[0][0]).toMatch(/never delivered|Couldn't switch/);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("BrainPicker — pending never lies (D-15)", () => {
  it("keeps the base label byte-identical and shows a switching-to suffix while a dispatch is in flight", async () => {
    let resolveDispatch: (value: unknown) => void = () => {};
    mockDispatch.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDispatch = resolve;
        })
    );
    renderPicker();

    const baseLabelBefore = screen.getByTestId("brain-picker-base-label").textContent;
    expect(baseLabelBefore).toBe("anthropic-sonnet-5");

    openPicker();
    fireEvent.click(await screen.findByText("Codex CLI"));

    expect(await screen.findByTestId("brain-picker-pending-suffix")).toHaveTextContent(
      "switching to Codex CLI"
    );
    expect(screen.getByTestId("brain-picker-base-label").textContent).toBe(baseLabelBefore);

    resolveDispatch(okAck());
    await waitFor(() => expect(mockDispatch).toHaveBeenCalledTimes(1));
  });

  it("drops the switching-to suffix and keeps the original base label after an error ack, with no error styling on the trigger", async () => {
    mockDispatch.mockResolvedValue({
      type: "ack",
      request_id: "",
      status: "error",
      error: "No credentials configured",
    });
    renderPicker();

    const baseLabelBefore = screen.getByTestId("brain-picker-base-label").textContent;

    openPicker();
    fireEvent.click(await screen.findByText("Codex CLI"));

    await waitFor(() =>
      expect(screen.queryByTestId("brain-picker-pending-suffix")).not.toBeInTheDocument()
    );
    expect(screen.getByTestId("brain-picker-base-label").textContent).toBe(baseLabelBefore);

    const trigger = screen.getByRole("button", { name: /Active brain/ });
    expect(trigger.className).not.toMatch(/destructive|--status-error/);
    expect(mockToastError).toHaveBeenCalled();
  });
});

describe("BrainPicker — cmdk duplicate-value guard", () => {
  it("renders two same-name catalogue entries as independently selectable items with distinct values", async () => {
    renderPicker();

    openPicker();
    const items = await screen.findAllByText("Sonnet 5");
    expect(items).toHaveLength(2);

    const values = items.map((el) => el.closest("[cmdk-item]")?.getAttribute("data-value"));
    expect(values[0]).toBeTruthy();
    expect(values[1]).toBeTruthy();
    expect(values[0]).not.toBe(values[1]);

    fireEvent.click(items[1]); // openrouter-sonnet-5-dup
    await waitFor(() =>
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({ value: "openrouter-sonnet-5-dup" })
      )
    );
  });
});

// D-02 REALITY: only the "API" group is reachable through the picker's live catalogue today — see
// this file's top-of-file docstring. This replaces the pre-109 three-group-order test, which relied
// on stub fixture entries pre-tagged with `group: "subscription"`/`"local"` that a live catalogue
// entry can never carry (D-13).
describe("BrainPicker — group rendering (D-02/D-13: only 'API' is reachable live)", () => {
  it("renders every live catalogue entry under a single 'API' group heading", async () => {
    renderPicker();

    openPicker();
    await screen.findByText("Codex CLI");

    const headings = Array.from(document.querySelectorAll("[cmdk-group-heading]"));
    expect(headings.map((h) => h.textContent)).toEqual(["API"]);
  });
});

describe("BrainPicker — no stub chrome anywhere (D-01)", () => {
  it("never renders a build-time-stub indicator on the trigger or in the popover, under any condition", async () => {
    renderPicker();

    // The old D-16 chip's own testid — kept as a belt-and-suspenders check even though the
    // component no longer renders it under any prop combination.
    expect(screen.queryByTestId("brain-picker-trigger-stub-chip")).not.toBeInTheDocument();
    // Structural completeness: the default trigger button renders exactly its two designed
    // children (base label, optional pending suffix) and nothing else — this catches ANY
    // unexpected extra chip/badge appearing on the trigger, not just one spelled a specific way.
    const trigger = screen.getByRole("button", { name: /Active brain/ });
    expect(trigger.children).toHaveLength(1); // base label only; no pending suffix, no chip

    openPicker();
    await screen.findByText("Codex CLI");
    expect(screen.queryByText(/stub brain data/i)).not.toBeInTheDocument();
  });
});

describe("BrainPicker — composition API (103-06)", () => {
  it("renders a custom `trigger` in place of its own default trigger, and clicking it opens the popover", async () => {
    render(
      <TooltipProvider>
        <GlobalSwapProvider>
          <BrainPicker
            profileId="assistant-default"
            trigger={<button type="button">custom trigger</button>}
          />
        </GlobalSwapProvider>
      </TooltipProvider>
    );

    // The picker's own default trigger button (base label, pending suffix) never renders at all
    // when a custom `trigger` is supplied -- there is exactly one trigger element.
    expect(screen.queryByTestId("brain-picker-base-label")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "custom trigger" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "custom trigger" }));
    await screen.findByText("Codex CLI");
  });

  it("fires onPendingChange with the same formatted switching-to label the default trigger renders", async () => {
    let resolveDispatch: (value: unknown) => void = () => {};
    mockDispatch.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDispatch = resolve;
        })
    );
    const onPendingChange = vi.fn();
    render(
      <TooltipProvider>
        <GlobalSwapProvider>
          <BrainPicker profileId="assistant-default" onPendingChange={onPendingChange} />
        </GlobalSwapProvider>
      </TooltipProvider>
    );

    // Idle on mount -- matches the default trigger, which renders no pending suffix at all yet.
    expect(onPendingChange).toHaveBeenCalledWith(null);

    openPicker();
    fireEvent.click(await screen.findByText("Codex CLI"));

    await waitFor(() =>
      expect(onPendingChange).toHaveBeenCalledWith("· switching to Codex CLI…")
    );

    resolveDispatch(okAck());
    await waitFor(() => expect(mockDispatch).toHaveBeenCalledTimes(1));
  });

  it("drops the pending callback to null on a failed dispatch, matching the default trigger's own drop-suffix behavior", async () => {
    mockDispatch.mockResolvedValue({
      type: "ack",
      request_id: "",
      status: "error",
      error: "No credentials configured",
    });
    const onPendingChange = vi.fn();
    render(
      <TooltipProvider>
        <GlobalSwapProvider>
          <BrainPicker profileId="assistant-default" onPendingChange={onPendingChange} />
        </GlobalSwapProvider>
      </TooltipProvider>
    );

    openPicker();
    fireEvent.click(await screen.findByText("Codex CLI"));

    await waitFor(() => expect(onPendingChange).toHaveBeenLastCalledWith(null));
  });

  it("supports controlled open/onOpenChange while every other test in this file (which omits both) proves the default uncontrolled behavior is unchanged", async () => {
    const onOpenChange = vi.fn();

    function Controlled() {
      const [open, setOpen] = useState(false);
      return (
        <BrainPicker
          profileId="assistant-default"
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            onOpenChange(next);
          }}
        />
      );
    }

    render(
      <TooltipProvider>
        <GlobalSwapProvider>
          <Controlled />
        </GlobalSwapProvider>
      </TooltipProvider>
    );

    openPicker();
    expect(onOpenChange).toHaveBeenCalledWith(true);
    await screen.findByText("Codex CLI");
  });
});

describe("BrainPicker — never-truncates regression guard", () => {
  it("renders a long catalogue entry name without a truncate class on the row", async () => {
    mockCatalogueEntries = [
      {
        ...TEST_ENTRIES[0],
        name: "A Very Long Engine Name That Would Previously Have Been Truncated",
      },
    ];
    renderPicker();

    openPicker();
    const nameEl = await screen.findByText(
      "A Very Long Engine Name That Would Previously Have Been Truncated"
    );
    const row = nameEl.closest("button")!;
    expect(row.className).toContain("whitespace-normal");
    expect(row.className).toContain("break-words");
    expect(row.className).not.toContain("truncate");
  });
});

// ── 103-11: keyboard activation (CR-02) ────────────────────────────────────────
//
// CR-02 found the picker's cmdk CommandItems never wired `onSelect`, so the component's own
// designed primary interaction (search -> arrow-navigate -> Enter) was completely non-functional
// -- only a literal mouse click on the row's nested button worked. These tests drive the real,
// unmocked cmdk `Command` via keyboard events on the `CommandInput` (never `.click()`) to prove
// the keyboard path now dispatches through the exact same branch the mouse path uses. Every live
// catalogue entry normalizes to `costTier: "normal"` (D-02 reality, see top-of-file docstring), so
// only the no-confirm dispatch path is reachable here — the expensive/unknown-tier inline-confirm
// keyboard leg is covered directly against hand-built fixtures in `BrainPickerRow.test.tsx`.

describe("BrainPicker — keyboard activation (103-11, CR-02)", () => {
  it("profile scope, normal-tier row: ArrowDown + Enter dispatches the exact swap.set payload", async () => {
    renderPicker();

    openPicker();
    await screen.findByText("Codex CLI");

    const search = screen.getByPlaceholderText("Search brains…");
    fireEvent.change(search, { target: { value: "Codex" } });
    await screen.findByText("Codex CLI");
    expect(screen.queryByText("Antigravity CLI")).not.toBeInTheDocument();

    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Enter" });

    await waitFor(() => expect(mockDispatch).toHaveBeenCalledTimes(1));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: "swap.set",
      target: "brain",
      value: "codex-cli",
      restore: false,
      profile_id: "assistant-default",
    });
  });

  it("global scope, any row: Enter opens GlobalSwapModal and dispatches zero swap.set frames from the picker itself (D-15 confirm-gate regression guard)", async () => {
    renderPicker();

    openPicker();
    await screen.findByText("Codex CLI");
    fireEvent.click(screen.getByRole("radio", { name: "All profiles" }));
    await screen.findByText("Codex CLI");

    const search = screen.getByPlaceholderText("Search brains…");
    fireEvent.change(search, { target: { value: "Codex" } });
    await screen.findByText("Codex CLI");
    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Enter" });

    const modal = await screen.findByTestId("global-swap-modal");
    expect(modal).toHaveAttribute("data-target-id", "codex-cli");
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});

// ── 103-12: GlobalSwapModal mount lifecycle survives close (CR-03) ────────────
//
// Before this fix, `{globalTarget && <GlobalSwapModal onOpenChange={next => { if (!next)
// setGlobalTarget(null); }} />}` unmounted the modal the moment it closed (Cancel or Done), so a
// later "Revert global swap" toast click fired real WS commands into a dead component instance
// with zero visible feedback. The fix decouples MOUNT (`globalTarget`, only replaced by a new
// selection) from VISIBILITY (`globalDialogOpen`, a plain boolean `onOpenChange` maps onto
// directly in both directions).

describe("BrainPicker — GlobalSwapModal mount lifecycle (103-12, CR-03)", () => {
  it("keeps the modal instance mounted after onOpenChange(false); a later onOpenChange(true) makes it visible again", async () => {
    renderPicker();

    openPicker();
    await screen.findByText("Codex CLI");
    fireEvent.click(screen.getByRole("radio", { name: "All profiles" }));
    await screen.findByText("Codex CLI");
    fireEvent.click(screen.getByText("Codex CLI"));

    const modal = await screen.findByTestId("global-swap-modal");
    expect(modal).toHaveAttribute("data-open", "true");

    fireEvent.click(screen.getByRole("button", { name: "mock-close" }));

    // CR-03: still present in the tree (mounted) — only its visibility changed.
    expect(screen.getByTestId("global-swap-modal")).toBeInTheDocument();
    expect(screen.getByTestId("global-swap-modal")).toHaveAttribute("data-open", "false");

    fireEvent.click(screen.getByRole("button", { name: "mock-reopen" }));
    expect(screen.getByTestId("global-swap-modal")).toHaveAttribute("data-open", "true");
    // The target survived the close/reopen cycle too — the same instance, not a fresh one.
    expect(screen.getByTestId("global-swap-modal")).toHaveAttribute("data-target-id", "codex-cli");
  });

  it("replaces the mounted instance's target only when a genuinely new selection is made", async () => {
    renderPicker();

    openPicker();
    await screen.findByText("Codex CLI");
    fireEvent.click(screen.getByRole("radio", { name: "All profiles" }));
    await screen.findByText("Codex CLI");
    fireEvent.click(screen.getByText("Codex CLI"));

    await screen.findByTestId("global-swap-modal");
    fireEvent.click(screen.getByRole("button", { name: "mock-close" }));
    expect(screen.getByTestId("global-swap-modal")).toHaveAttribute("data-open", "false");

    // Reopening the picker and picking the SAME entry again re-mounts with the same target id —
    // proves the mount guard is driven by `globalTarget`, not some separate "was it ever closed"
    // flag that would force an unwanted remount.
    openPicker();
    await screen.findByText("Codex CLI");
    fireEvent.click(screen.getByRole("radio", { name: "All profiles" }));
    await screen.findByText("Codex CLI");
    fireEvent.click(screen.getByText("Codex CLI"));

    expect(screen.getByTestId("global-swap-modal")).toHaveAttribute("data-target-id", "codex-cli");
    expect(screen.getByTestId("global-swap-modal")).toHaveAttribute("data-open", "true");
  });
});

// ── 103-12: row highlight is scope-aware (WR-02) ───────────────────────────────
//
// Before this fix, `isCurrent={activeEngine?.model === entry.id}` compared every row — in BOTH
// "This profile" and "All profiles" scope — against the per-profile engine, so the "All profiles"
// view could never highlight the row that actually matches the live global override.

describe("BrainPicker — row highlight is scope-aware (103-12, WR-02)", () => {
  it("tracks the global override in 'All profiles' scope, not the per-profile engine", async () => {
    mockGlobalOverride = { modelOverride: "codex-cli", voiceOverride: null };
    renderPicker();

    openPicker();
    await screen.findByText("Codex CLI");
    // "This profile" scope: the mocked active engine is "anthropic-sonnet-5", not "codex-cli" —
    // no highlight even though the global override happens to match this row's id.
    const profileRow = screen.getByText("Codex CLI").closest(".rounded-md.border");
    expect(profileRow?.className ?? "").not.toContain("bg-primary/10");

    fireEvent.click(screen.getByRole("radio", { name: "All profiles" }));
    await screen.findByText("Codex CLI");

    const globalRow = screen.getByText("Codex CLI").closest(".rounded-md.border");
    expect(globalRow?.className ?? "").toContain("bg-primary/10");
  });
});

// ── 103-16: selectionNonce bumps on every activation, including a repeat (CR-01) ──
//
// Cheap, mock-mode check that BrainPicker's own wiring bumps the nonce it threads through to
// GlobalSwapModal on every global-scope activation -- including a reselection of the exact same
// catalogue entry, which is the one case the pre-103-16 `target.id`-keyed guard could never see.

describe("BrainPicker — global-swap selection nonce bumps on every activation (103-16, CR-01)", () => {
  it("increments selectionNonce on a repeat activation of the same brain, not just a different one", async () => {
    renderPicker();

    openPicker();
    await screen.findByText("Codex CLI");
    fireEvent.click(screen.getByRole("radio", { name: "All profiles" }));
    await screen.findByText("Codex CLI");
    fireEvent.click(screen.getByText("Codex CLI"));

    const firstNonce = screen.getByTestId("global-swap-modal").getAttribute("data-selection-nonce");
    expect(firstNonce).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "mock-close" }));

    openPicker();
    await screen.findByText("Codex CLI");
    fireEvent.click(screen.getByRole("radio", { name: "All profiles" }));
    await screen.findByText("Codex CLI");
    fireEvent.click(screen.getByText("Codex CLI")); // reselect the SAME entry

    const modal = screen.getByTestId("global-swap-modal");
    // Same target id, but the nonce still changed -- this is the exact distinction the old
    // `target.id`-keyed reset guard could never make.
    expect(modal).toHaveAttribute("data-target-id", "codex-cli");
    expect(modal.getAttribute("data-selection-nonce")).not.toBe(firstNonce);
  });
});

// ── 103-16: real GlobalSwapModal against BrainPicker's wiring (CR-01) ─────────────
//
// `GlobalSwapModal` is fully mocked everywhere else in this file (see the top-of-file docstring
// note on why that let the original CR-01 defect ship invisibly). These tests flip
// `globalSwapModalMode` to "real" so the ACTUAL component's `phase`/`outcome` state is exercised
// through BrainPicker's real `handleSelect` -> `selectionNonce` wiring, against this file's
// already-mocked `useCommandDispatch`/`useGlobalBrainOverride`/`sonner` seams -- no new mocking
// surface needed, since `GlobalSwapModal` now shares the SAME `useCommandDispatch()` mock this file
// already wires for the per-profile branch. Covers all four scenarios from 103-16-PLAN.md's Task 2
// action text.

// Module-scope (103-17) so the OBS-8/D-14 describe block below can reuse it without duplicating
// the open -> switch-scope -> select sequence.
async function openGlobalPickerAndSelect(entryName: string) {
  openPicker();
  await screen.findByPlaceholderText("Search brains…");
  fireEvent.click(screen.getByRole("radio", { name: "All profiles" }));
  await screen.findByText(entryName);
  fireEvent.click(screen.getByText(entryName));
}

describe("BrainPicker + real GlobalSwapModal — reselect resets stale state (103-16, CR-01)", () => {
  beforeEach(() => {
    globalSwapModalMode = "real";
    renderPicker();
  });

  it("(a) reselecting the same brain after a completed swap opens a fresh confirm prompt, not the stale result", async () => {
    await openGlobalPickerAndSelect("Codex CLI");

    fireEvent.click(
      await screen.findByRole("button", { name: "Swap all profiles to Codex CLI" })
    );
    // Simulate the server-pushed swap.state readback landing.
    mockGlobalOverride = { modelOverride: "codex-cli", voiceOverride: null };
    expect(await screen.findByText("Switched to Codex CLI.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    // Reselecting the SAME brain -- pre-103-16 this reopened directly into the stale "Switched to
    // Codex CLI." result screen with no confirm button and no new command dispatched.
    await openGlobalPickerAndSelect("Codex CLI");

    expect(
      await screen.findByRole("button", { name: "Swap all profiles to Codex CLI" })
    ).toBeInTheDocument();
    expect(screen.queryByText("Switched to Codex CLI.")).not.toBeInTheDocument();
  });

  it("(b) reselecting the same brain after a failed swap restores the retry path, not a dead Done", async () => {
    mockDispatch.mockImplementation(async (cmd: unknown) => {
      const type = (cmd as { type?: string }).type;
      if (type === "swap.set") {
        return { type: "ack", request_id: "", status: "error", error: "backend unreachable" };
      }
      return okAck();
    });

    await openGlobalPickerAndSelect("Codex CLI");

    fireEvent.click(
      await screen.findByRole("button", { name: "Swap all profiles to Codex CLI" })
    );

    const errorRow = await screen.findByText(/Failed — backend unreachable/);
    expect(errorRow.textContent).toContain("Every profile is still on its prior engine");
    // The failed-swap result phase itself offers only Done -- no retry affordance in that phase.
    expect(
      screen.queryByRole("button", { name: "Swap all profiles to Codex CLI" })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    // Reselecting the SAME brain must restore the retry path -- pre-103-16 this reopened showing
    // the identical stale error with no way to dispatch again short of picking a different brain
    // first.
    await openGlobalPickerAndSelect("Codex CLI");

    expect(
      await screen.findByRole("button", { name: "Swap all profiles to Codex CLI" })
    ).toBeInTheDocument();
    expect(screen.queryByText(/Failed — backend unreachable/)).not.toBeInTheDocument();
  });

  it("(c) a toast revert with no new selection still renders a real result on the surviving instance (CR-03 not regressed)", async () => {
    await openGlobalPickerAndSelect("Codex CLI");

    fireEvent.click(
      await screen.findByRole("button", { name: "Swap all profiles to Codex CLI" })
    );
    mockGlobalOverride = { modelOverride: "codex-cli", voiceOverride: null };
    expect(await screen.findByText("Switched to Codex CLI.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(mockToastFn).toHaveBeenCalledWith(
      "All profiles switched to Codex CLI.",
      expect.objectContaining({
        action: expect.objectContaining({ label: "Revert global swap" }),
      })
    );
    const [, toastOptions] = mockToastFn.mock.calls[mockToastFn.mock.calls.length - 1] as [
      string,
      { action: { label: string; onClick: () => void } },
    ];

    // No new selection is made here -- this is the toast-revert path CR-03 protects, not a fresh
    // BrainPicker.handleSelect activation, so `selectionNonce` never changes and the reset effect
    // must not fire.
    toastOptions.action.onClick();
    mockGlobalOverride = { modelOverride: null, voiceOverride: null };

    expect(
      await screen.findByText("Global override cleared — profiles are back on their own defaults.")
    ).toBeInTheDocument();
    // Never regresses into a fresh confirm prompt on the reopen a revert depends on.
    expect(screen.queryByText("Swap all profiles to Codex CLI?")).not.toBeInTheDocument();
  });

  it("(d) selecting a different brain after Done still opens a fresh confirm prompt (pre-existing target.id path still works)", async () => {
    mockCatalogueEntries = [
      { id: "codex-cli", name: "Codex CLI", vendor: "codex" },
      { id: "x-ai/grok-4.5", name: "Grok Live", vendor: "x-ai" },
    ];

    await openGlobalPickerAndSelect("Codex CLI");
    fireEvent.click(
      await screen.findByRole("button", { name: "Swap all profiles to Codex CLI" })
    );
    mockGlobalOverride = { modelOverride: "codex-cli", voiceOverride: null };
    expect(await screen.findByText("Switched to Codex CLI.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    await openGlobalPickerAndSelect("Grok Live");

    expect(
      await screen.findByRole("button", { name: "Swap all profiles to Grok Live" })
    ).toBeInTheDocument();
    expect(screen.queryByText("Switched to Codex CLI.")).not.toBeInTheDocument();
  });
});

// ── 103-18: exactly one GlobalSwapModal instance app-wide, regardless of host count ──────────
//
// WR-01's fix is ownership: `GlobalSwapProvider` (mounted once in `DashboardLayout`, above the
// router outlet) now owns the single `GlobalSwapModal` instance every `BrainPicker` host requests
// through `useGlobalSwap()`. This test proves the "exactly one modal" half of that guarantee with
// TWO real `BrainPicker` instances mounted at once -- the literal shape of `BrainHeaderBadge` (one
// host) and the Chat composer pill (a second, page-scoped host) both rendering the same component.

describe("BrainPicker + GlobalSwapProvider — exactly one GlobalSwapModal instance app-wide (103-18, WR-01)", () => {
  it("renders exactly one GlobalSwapModal even with two BrainPicker hosts mounted under the same provider", async () => {
    render(
      <TooltipProvider>
        <GlobalSwapProvider>
          <BrainPicker profileId="assistant-default" />
          <BrainPicker profileId="assistant-default" />
        </GlobalSwapProvider>
      </TooltipProvider>
    );

    // No swap requested yet -- the provider mounts nothing.
    expect(screen.queryByTestId("global-swap-modal")).not.toBeInTheDocument();

    // Open the SECOND host (standing in for the page-scoped Chat pill) and request a global swap.
    const triggers = screen.getAllByRole("button", { name: /Active brain/ });
    fireEvent.click(triggers[1]);
    await screen.findByText("Codex CLI");
    fireEvent.click(screen.getByRole("radio", { name: "All profiles" }));
    await screen.findByText("Codex CLI");
    fireEvent.click(screen.getByText("Codex CLI"));

    // Exactly one modal instance exists app-wide, regardless of how many BrainPicker hosts are
    // mounted -- 103-CONTRACT.md §8's "no second dispatch path, no second modal" holds structurally.
    expect(screen.getAllByTestId("global-swap-modal")).toHaveLength(1);
    expect(screen.getByTestId("global-swap-modal")).toHaveAttribute("data-open", "true");
    expect(screen.getByTestId("global-swap-modal")).toHaveAttribute("data-target-id", "codex-cli");
  });
});

// ── 103-18: WR-01 itself -- revert survives navigating away from the requesting picker ────────
//
// The exact reproduction 103-18-PLAN.md names: start a global swap from a page-scoped picker,
// click Done, navigate away (unmount that picker -- `GlobalSwapProvider` itself does not, mirroring
// how `DashboardLayout` is never remounted by a child-route navigation), then click "Revert global
// swap" in the still-visible toast. Before this plan, the modal instance -- and the `runRevert`
// closure the toast action calls -- lived inside the now-unmounted `BrainPicker`, so this fired a
// real `swap.set` into a dead component with zero visible feedback.

describe("BrainPicker + GlobalSwapProvider — WR-01: revert survives the requesting picker unmounting (route-change simulation)", () => {
  it("a toast revert fired after the requesting BrainPicker unmounts still renders a visible result and dispatches for real", async () => {
    globalSwapModalMode = "real";

    function Harness({ showPicker }: { showPicker: boolean }) {
      return (
        <TooltipProvider>
          <GlobalSwapProvider>{showPicker && <BrainPicker profileId="assistant-default" />}</GlobalSwapProvider>
        </TooltipProvider>
      );
    }

    const { rerender } = render(<Harness showPicker={true} />);

    await openGlobalPickerAndSelect("Codex CLI");
    fireEvent.click(
      await screen.findByRole("button", { name: "Swap all profiles to Codex CLI" })
    );
    mockGlobalOverride = { modelOverride: "codex-cli", voiceOverride: null };
    expect(await screen.findByText("Switched to Codex CLI.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    const [, toastOptions] = mockToastFn.mock.calls[mockToastFn.mock.calls.length - 1] as [
      string,
      { action: { label: string; onClick: () => void } },
    ];

    // Simulate the route change: unmount ONLY the requesting picker. `GlobalSwapProvider` stays --
    // React reconciles it as the same element at the same tree position across this rerender,
    // exactly as it does across a real nested-route navigation under `DashboardLayout` (the actual
    // mount point, which is never remounted by a child route swapping under its <Outlet/>).
    rerender(<Harness showPicker={false} />);
    expect(screen.queryByRole("button", { name: /Active brain/ })).not.toBeInTheDocument();

    // The revert toast action fires well after the requesting component is gone -- must still
    // render a REAL, visible result surface and dispatch a real command, never fire silently.
    toastOptions.action.onClick();
    mockGlobalOverride = { modelOverride: null, voiceOverride: null };

    expect(
      await screen.findByText("Global override cleared — profiles are back on their own defaults.")
    ).toBeInTheDocument();
    expect(mockDispatch).toHaveBeenCalledWith({
      type: "swap.set",
      target: "brain",
      restore: true,
    });
  });
});

// ── 103-18: 103-14 stays closed through the hoisted architecture -- revert restores, not clears ──
//
// 103-14's restore-to-prior fix lives entirely inside GlobalSwapModal.tsx, untouched by this plan.
// This proves it still works end-to-end through BrainPicker's real handleSelect -> openGlobalSwap
// wiring and the now-hoisted modal instance -- not just against GlobalSwapModal.test.tsx's directly
// mocked useCommandDispatch.

describe("BrainPicker + real GlobalSwapModal — 103-14 stays closed: revert restores the prior override, not a clear", () => {
  it("restores the exact prior global override instead of clearing it when one was in force before the swap", async () => {
    globalSwapModalMode = "real";
    // A global override is already in force (matching the default mocked active engine's model,
    // so the pre-swap snapshot resolves a readable display name for it) BEFORE this swap starts.
    mockGlobalOverride = { modelOverride: "anthropic-sonnet-5", voiceOverride: null };
    renderPicker();

    await openGlobalPickerAndSelect("Codex CLI");
    fireEvent.click(
      await screen.findByRole("button", { name: "Swap all profiles to Codex CLI" })
    );

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "swap.set",
      target: "brain",
      value: "codex-cli",
      restore: false,
    });

    mockGlobalOverride = { modelOverride: "codex-cli", voiceOverride: null };
    expect(await screen.findByText("Switched to Codex CLI.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    const [, toastOptions] = mockToastFn.mock.calls[mockToastFn.mock.calls.length - 1] as [
      string,
      { action: { label: string; onClick: () => void } },
    ];
    toastOptions.action.onClick();

    // Restores to the PRIOR override ("anthropic-sonnet-5"), never a plain clear -- `restore:
    // false` with the captured prior value, exactly as a fresh swap to that engine would dispatch.
    expect(mockDispatch).toHaveBeenCalledWith({
      type: "swap.set",
      target: "brain",
      value: "anthropic-sonnet-5",
      restore: false,
    });

    mockGlobalOverride = { modelOverride: "anthropic-sonnet-5", voiceOverride: null };
    // Unlike the OBS-8 vendor-prefixed case above, this catalogue entry's id matches the override
    // value EXACTLY ("anthropic-sonnet-5"), so resolveModelDisplayName resolves it to the
    // catalogue's real display name ("Sonnet 5") rather than falling back to the raw id.
    expect(await screen.findByText("Reverted to Sonnet 5.")).toBeInTheDocument();
  });
});

// ── 103-17: pinned-default count from config + the D-14 boundary it must never trade away ──────
//
// OBS 8 (live-confirmed 2026-07-29): `useProfileConfigs()` already returns `modelPreferences` for
// every profile (verified live: consulting/business/personal each carry `primary:
// "anthropic/claude-sonnet-5"`), but `globalSwapProfiles` never read it -- so with zero
// `activeEngineSnapshots` rows (also verified live) the confirm modal reported a pinned-default
// count of 0. These tests exercise BrainPicker's REAL `globalSwapProfiles` derivation (through the
// real `GlobalSwapModal`) against exactly that live shape, and pin the boundary the fix must not
// cross: the current-engine column stays "Auto" -- never back-filled from `modelPreferences.primary`
// (the v9.0 VitalsRail trap `useActiveEngine.ts`'s docstring names explicitly, and the trap
// 103-17-PLAN.md's objective calls out as "the obvious fix is wrong").

describe("BrainPicker + real GlobalSwapModal — pinned-default count from config, D-14 boundary (103-17, OBS 8)", () => {
  beforeEach(() => {
    globalSwapModalMode = "real";
  });

  it("reports a pinned-default count of 3 and names the shadowed default when all three real profiles carry a configured primary and zero telemetry rows have reported (live OBS 8 shape)", async () => {
    // Exactly the live 2026-07-29 checkpoint shape: `activeEngine:latestByProfile` had zero rows
    // for the real profiles, `profiles:listConfigs` had all three carrying the same configured
    // primary.
    mockActiveEngines = {};
    mockProfileConfigs = [
      {
        profileId: "consulting",
        modelPreferences: { primary: "anthropic/claude-sonnet-5", fallback: "qwen2.5:7b" },
      },
      {
        profileId: "business",
        modelPreferences: { primary: "anthropic/claude-sonnet-5", fallback: "qwen2.5:7b" },
      },
      {
        profileId: "personal",
        modelPreferences: { primary: "anthropic/claude-sonnet-5", fallback: "qwen2.5:7b" },
      },
    ];
    renderPicker();

    await openGlobalPickerAndSelect("Codex CLI");

    expect(
      await screen.findByText(
        "3 profiles have a pinned default (anthropic/claude-sonnet-5) that will be shadowed while this global override is in force."
      )
    ).toBeInTheDocument();
  });

  it("does not count a profile with no configured primary as pinned", async () => {
    mockActiveEngines = {};
    mockProfileConfigs = [
      {
        profileId: "consulting",
        modelPreferences: { primary: "anthropic/claude-sonnet-5", fallback: "qwen2.5:7b" },
      },
      { profileId: "business" }, // no modelPreferences at all
    ];
    renderPicker();

    await openGlobalPickerAndSelect("Codex CLI");

    expect(
      await screen.findByText(
        "1 profile has a pinned default (anthropic/claude-sonnet-5) that will be shadowed while this global override is in force."
      )
    ).toBeInTheDocument();
  });

  it("D-14 REGRESSION GUARD: the current-engine column stays 'Auto' -- never back-filled from modelPreferences.primary -- even though a configured default exists and telemetry is silent", async () => {
    // The risk 103-17-PLAN.md names explicitly: a later change "helpfully" back-filling the
    // current-engine column from `modelPreferences` would re-open the exact v9.0 VitalsRail
    // active-profile trap BSC-01 exists to remove (see useActiveEngine.ts's own docstring). This
    // test fails if that ever happens.
    mockActiveEngines = {};
    mockProfileConfigs = [
      {
        profileId: "consulting",
        modelPreferences: { primary: "anthropic/claude-sonnet-5", fallback: "qwen2.5:7b" },
      },
    ];
    renderPicker();

    await openGlobalPickerAndSelect("Codex CLI");

    // The pinned-default warning proves the CONFIG signal reached the modal...
    await screen.findByText(
      "1 profile has a pinned default (anthropic/claude-sonnet-5) that will be shadowed while this global override is in force."
    );
    // ...but "consulting"'s own current -> new row must still show the honest unreported reading,
    // never the configured primary.
    const row = screen.getByText("consulting").closest("div");
    expect(row).not.toBeNull();
    expect(row!.textContent).toContain("Auto");
    expect(row!.textContent).not.toContain("anthropic/claude-sonnet-5");
  });

  it("D-14 REGRESSION GUARD: the base trigger label for the picker's own profile also stays telemetry-only when that profile has a configured default but no reported engine", async () => {
    mockActiveEngines = {};
    mockProfileConfigs = [
      {
        profileId: "assistant-default",
        modelPreferences: { primary: "anthropic/claude-sonnet-5", fallback: "qwen2.5:7b" },
      },
    ];
    renderPicker();

    // No telemetry row for "assistant-default" -- the trigger's base label (BrainPicker.tsx's
    // `activeEngine?.model ?? "Auto"`) must read "Auto", never the configured primary, even though
    // this exact profile now has a configured default.
    expect(screen.getByTestId("brain-picker-base-label").textContent).toBe("Auto");
  });
});

// ── UAT gap (2026-07-29): the picker must be safe from a host with NO TooltipProvider ─────────
//
// Live UAT found the picker CRASHING from two of its three entry points. `BrainPickerRow` wraps
// each row's button in a Radix `<Tooltip>` (103-11's own WR-03 fix). Radix context follows the
// REACT tree, not the DOM, so a portaled `PopoverContent` inherits its HOST's providers:
//   - `BrainHeaderBadge` sits inside `DashboardLayout`'s `<TooltipProvider>` (DashboardLayout.tsx
//     :588-603) and worked -- 331 live rows, zero errors.
//   - the Chat composer pill (`Chat.tsx`) and Settings' `AgentProfileRows` (`Settings.tsx`) are
//     rendered inside the routed `<Outlet/>`, which NEITHER DashboardLayout TooltipProvider wraps
//     -- the exact boundary already documented verbatim at SkillLifecycleMenu.tsx:186-190. There,
//     the popover was destroyed the moment rows rendered: "`Tooltip` must be used within
//     `TooltipProvider`", ErrorBoundary trip, "went wrong" fallback.
//
// Every other test in this file wraps its render in a `TooltipProvider` (see `renderPicker`), which
// is precisely why a 2815-test suite could not catch it. This test deliberately does NOT, so the
// provider-boundary regression is caught at the unit level from now on.

describe("BrainPicker — renders catalogue rows with no TooltipProvider ancestor (UAT blocker)", () => {
  it("renders rows from a routed host that supplies no TooltipProvider, instead of throwing", async () => {
    // NOTE: no <TooltipProvider> -- this is the Chat-pill / Settings-row host shape.
    render(
      <GlobalSwapProvider>
        <BrainPicker profileId="assistant-default" />
      </GlobalSwapProvider>
    );

    openPicker();

    // Rows render (each one containing BrainPickerRow's Radix Tooltip) without a provider ancestor.
    expect(await screen.findByText("Codex CLI")).toBeInTheDocument();
    // The health dot's tooltip trigger is the specific element that threw.
    expect(screen.getAllByTestId("health-dot").length).toBeGreaterThan(0);
  });

  it("still renders rows with no TooltipProvider after switching to the global scope", async () => {
    render(
      <GlobalSwapProvider>
        <BrainPicker profileId="assistant-default" />
      </GlobalSwapProvider>
    );

    openPicker();
    await screen.findByText("Codex CLI");

    // This is the exact live repro: the crash fired on the "All profiles" toggle, because that
    // re-fetch re-rendered the row list.
    fireEvent.click(screen.getByRole("radio", { name: "All profiles" }));

    expect(await screen.findByText("Codex CLI")).toBeInTheDocument();
  });
});
