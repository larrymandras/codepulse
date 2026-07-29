/**
 * BrainPicker.test.tsx — 103-05-T2, extended 103-08 for the scope-aware catalogue fix.
 *
 * Structured after `BrainControl.test.tsx` (module-level `vi.mock`, exact
 * `toHaveBeenCalledWith` command-shape assertions, the never-truncates and
 * re-fetches-on-every-open regression tests). `brainsApi`, `useActiveEngine`,
 * `useProfileConfigs`, and `GlobalSwapModal` are mocked directly so every dispatched
 * command shape and every open branch can be asserted exactly — a render-without-error
 * smoke test would prove none of D-08/D-14/D-15/D-16.
 *
 * `convex/react` + the generated Convex API module are mocked only because
 * `BrainPickerRow` (reused verbatim, per plan) transitively calls the real
 * `useProviderHealth()` hook — same mocking idiom `BrainPickerRow.test.tsx` already
 * established for this exact reason.
 *
 * `@/contexts/AstridrWSContext` is mocked (103-08) the same way `BrainControl.test.tsx`
 * mocks it, because the picker's "global" scope branch now reads the live catalogue via
 * `useAstridrWS().sendCommand` exactly as `BrainControl.tsx` does — every "profile"-scope
 * test in this file supplies a `mockSendCommand` that is never asserted against, proving
 * those tests stay entirely on the `brainsApi.getCatalogue()` seam.
 *
 * `@/hooks/useResolvedBrain`'s `useGlobalBrainOverride` is mocked directly (103-12, WR-02) —
 * a plain mutable `mockGlobalOverride` object the picker reads for the "All profiles" scope's row
 * highlight. Mocked at the hook level (not by driving `mockSendCommand`'s `swap.get_state` reply)
 * so this file's existing WR-01 staleness test — which relies on `mockSendCommand.mockImplementationOnce`
 * resolving exactly the NEXT `sendCommand` call — is not disturbed by an unrelated hydration call
 * this hook would otherwise make on mount.
 *
 * 103-16 (CR-01): `GlobalSwapModal`'s own mock (below) is why the reselect-same-brain defect
 * shipped invisibly in the first place — every test in this file that exercised the global-swap
 * open path asserted on the MOCK's props (`data-target-id`, `data-open`), never on the real
 * component's internal `phase`/`outcome` state, so nothing here could have caught a reset guard
 * that only clears on a `target.id` change. The mock now supports a module-level
 * `globalSwapModalMode` toggle ("mock" | "real") so a handful of tests can render the ACTUAL
 * `GlobalSwapModal` against this file's already-mocked `useAstridrWS`/`useGlobalBrainOverride`/
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
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GlobalSwapProvider } from "@/contexts/GlobalSwapContext";
import { STUB_CATALOGUE } from "@/lib/brainsFixtures";
import { BrainPicker } from "./BrainPicker";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGetCatalogue = vi.fn();
const mockDispatchSwap = vi.fn();
let stubActive = false;

vi.mock("@/lib/brainsApi", () => ({
  brainsApi: {
    isStub: true,
    getCatalogue: (...args: unknown[]) => mockGetCatalogue(...args),
    dispatchSwap: (...args: unknown[]) => mockDispatchSwap(...args),
    getDefaultProfileId: async () => "assistant-default",
  },
  get BRAINS_STUB_ACTIVE() {
    return stubActive;
  },
}));

const mockSendCommand = vi.fn();
vi.mock("@/contexts/AstridrWSContext", () => ({
  useAstridrWS: () => ({
    status: "connected",
    sendCommand: (...args: unknown[]) => mockSendCommand(...args),
    subscribe: vi.fn(() => vi.fn()),
    subscribeEvent: vi.fn(() => vi.fn()),
    reconnect: vi.fn(),
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
  mockGetCatalogue.mockReset();
  mockDispatchSwap.mockReset();
  mockToastFn.mockReset();
  mockToastSuccess.mockReset();
  mockToastError.mockReset();
  mockUseQuery.mockReset();
  mockUseQuery.mockReturnValue({});
  mockSendCommand.mockReset();
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
  // Default so any incidental swap.catalogue call in a "profile"-scope test (there shouldn't be
  // one) resolves harmlessly instead of hanging the test on an unresolved promise. Named to line
  // up with STUB_CATALOGUE's "Codex CLI" entry so tests that toggle to "All profiles" without
  // caring about the catalogue's actual contents can keep asserting on the same familiar text.
  mockSendCommand.mockResolvedValue({
    type: "ack",
    request_id: "",
    status: "ok",
    entries: [{ id: "codex-cli", name: "Codex CLI", vendor: "codex" }],
  });
  stubActive = false;
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

describe("BrainPicker — catalogue fetch", () => {
  it("fetches the catalogue every time the popover opens, never caching client-side", async () => {
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
    renderPicker();

    openPicker();
    await waitFor(() => expect(mockGetCatalogue).toHaveBeenCalledTimes(1));
    await screen.findByText("Codex CLI");

    openPicker(); // close
    openPicker(); // reopen

    await waitFor(() => expect(mockGetCatalogue).toHaveBeenCalledTimes(2));
  });

  it("shows a loading skeleton while the fetch is in flight, then an error state on failure", async () => {
    mockGetCatalogue.mockRejectedValue(new Error("boom"));
    renderPicker();

    openPicker();
    expect(
      await screen.findByText("Couldn't load the brain catalogue — try again in a moment.")
    ).toBeInTheDocument();
  });
});

describe("BrainPicker — scope selector reset (D-08)", () => {
  it('reads "This profile" on every open, including after being moved to "All profiles"', async () => {
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
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
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
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
});

describe("BrainPicker — dispatch branch separation", () => {
  it('dispatches exactly one gateway.model.set for a normal-tier row in "This profile" scope', async () => {
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
    mockDispatchSwap.mockResolvedValue({ type: "ack", request_id: "", status: "ok" });
    renderPicker();

    openPicker();
    const row = await screen.findByText("Codex CLI");
    fireEvent.click(row);

    await waitFor(() => expect(mockDispatchSwap).toHaveBeenCalledTimes(1));
    expect(mockDispatchSwap).toHaveBeenCalledWith({
      type: "gateway.model.set",
      request_id: "",
      scope: "profile",
      profile_id: "assistant-default",
      model: "codex-cli",
      mode: "session",
    });
  });

  it('opens GlobalSwapModal and dispatches nothing until it confirms, in "All profiles" scope', async () => {
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
    renderPicker();

    openPicker();
    await screen.findByText("Codex CLI");
    fireEvent.click(screen.getByRole("radio", { name: "All profiles" }));
    // Switching scope re-fetches (103-08: the catalogue is scope-sourced now), so the row
    // momentarily disappears behind the loading skeleton before the global fetch resolves.
    await screen.findByText("Codex CLI");

    fireEvent.click(screen.getByText("Codex CLI"));

    const modal = await screen.findByTestId("global-swap-modal");
    expect(modal).toHaveAttribute("data-target-id", "codex-cli");
    expect(mockDispatchSwap).not.toHaveBeenCalled();
  });
});

describe("BrainPicker — pending never lies (D-15)", () => {
  it("keeps the base label byte-identical and shows a switching-to suffix while a dispatch is in flight", async () => {
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
    let resolveDispatch: (value: unknown) => void = () => {};
    mockDispatchSwap.mockImplementation(
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

    resolveDispatch({ type: "ack", request_id: "", status: "ok" });
    await waitFor(() => expect(mockDispatchSwap).toHaveBeenCalledTimes(1));
  });

  it("drops the switching-to suffix and keeps the original base label after an error ack, with no error styling on the trigger", async () => {
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
    mockDispatchSwap.mockResolvedValue({
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
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
    mockDispatchSwap.mockResolvedValue({ type: "ack", request_id: "", status: "ok" });
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
      expect(mockDispatchSwap).toHaveBeenCalledWith(
        expect.objectContaining({ model: "openrouter-sonnet-5-dup" })
      )
    );
  });
});

describe("BrainPicker — group order (D-07)", () => {
  it("renders the three catalogue groups in the fixed order Subscription, API, Local", async () => {
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
    renderPicker();

    openPicker();
    await screen.findByText("Codex CLI");

    // Query the cmdk group-heading elements specifically -- a plain text match on "API" would
    // also collect every row's billing chip, which is a different (and differently-scoped) "API"
    // string entirely.
    const headings = Array.from(document.querySelectorAll("[cmdk-group-heading]"));
    expect(headings.map((h) => h.textContent)).toEqual(["Subscription", "API", "Local"]);
  });
});

describe("BrainPicker — stub indicator (D-16)", () => {
  it("renders the STUB banner and chip only when the stub adapter is active", async () => {
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
    stubActive = true;
    renderPicker();

    expect(screen.getByTestId("brain-picker-trigger-stub-chip")).toBeInTheDocument();

    openPicker();
    await screen.findByText("Codex CLI");
    expect(
      screen.getByText("Running on stub brain data — live Ástríðr backend not connected")
    ).toBeInTheDocument();
  });

  it("renders neither the STUB banner nor chip anywhere when the stub adapter is inactive", async () => {
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
    stubActive = false;
    renderPicker();

    expect(screen.queryByTestId("brain-picker-trigger-stub-chip")).not.toBeInTheDocument();

    openPicker();
    await screen.findByText("Codex CLI");
    expect(
      screen.queryByText("Running on stub brain data — live Ástríðr backend not connected")
    ).not.toBeInTheDocument();
  });

  it('never attaches a STUB chip to the "All profiles" (global) dispatch path', async () => {
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
    stubActive = true;
    renderPicker();

    const stubChipCountBefore = screen.getAllByTestId("brain-picker-trigger-stub-chip").length;

    openPicker();
    await screen.findByText("Codex CLI");
    fireEvent.click(screen.getByRole("radio", { name: "All profiles" }));
    // Switching scope re-fetches (103-08), so wait for the global-sourced row before clicking it.
    await screen.findByText("Codex CLI");
    fireEvent.click(screen.getByText("Codex CLI"));

    await screen.findByTestId("global-swap-modal");
    // Selecting in "All profiles" scope never sets the per-profile pending state, so it can
    // never grow the trigger's own STUB chip count -- the global branch stays un-stub-tagged.
    expect(screen.getAllByTestId("brain-picker-trigger-stub-chip").length).toBe(
      stubChipCountBefore
    );
    expect(mockDispatchSwap).not.toHaveBeenCalled();
  });
});

describe("BrainPicker — composition API (103-06)", () => {
  it("renders a custom `trigger` in place of its own default trigger, and clicking it opens the popover", async () => {
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
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

    // The picker's own default trigger button (base label, pending suffix, STUB chip) never
    // renders at all when a custom `trigger` is supplied -- there is exactly one trigger element.
    expect(screen.queryByTestId("brain-picker-base-label")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "custom trigger" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "custom trigger" }));
    await screen.findByText("Codex CLI");
  });

  it("fires onPendingChange with the same formatted switching-to label the default trigger renders", async () => {
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
    let resolveDispatch: (value: unknown) => void = () => {};
    mockDispatchSwap.mockImplementation(
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

    resolveDispatch({ type: "ack", request_id: "", status: "ok" });
    await waitFor(() => expect(mockDispatchSwap).toHaveBeenCalledTimes(1));
  });

  it("drops the pending callback to null on a failed dispatch, matching the default trigger's own drop-suffix behavior", async () => {
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
    mockDispatchSwap.mockResolvedValue({
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
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
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
    const longNameCatalogue = [
      { ...STUB_CATALOGUE[0], name: "A Very Long Engine Name That Would Previously Have Been Truncated" },
    ];
    mockGetCatalogue.mockResolvedValue(longNameCatalogue);
    renderPicker();

    openPicker();
    const nameEl = await screen.findByText(longNameCatalogue[0].name);
    const row = nameEl.closest("button")!;
    expect(row.className).toContain("whitespace-normal");
    expect(row.className).toContain("break-words");
    expect(row.className).not.toContain("truncate");
  });
});

// ── 103-08: scope-aware catalogue source ──────────────────────────────────────
//
// Before this fix, BOTH scopes rendered the SAME single fetch from `brainsApi.getCatalogue()`
// (the stub-backed, deferred per-profile seam) — the "All profiles" branch never touched the
// live, shipped `swap.catalogue` command at all, so the flagship picker could not initiate even
// the global swap that already works. These tests prove each scope reads from its own correct
// source and that a live failure never quietly degrades into stub data.

// ── 103-11: keyboard activation (CR-02) ────────────────────────────────────────
//
// CR-02 found the picker's cmdk CommandItems never wired `onSelect`, so the component's own
// designed primary interaction (search -> arrow-navigate -> Enter) was completely non-functional
// -- only a literal mouse click on the row's nested button worked. These tests drive the real,
// unmocked cmdk `Command` via keyboard events on the `CommandInput` (never `.click()`) to prove
// the keyboard path now dispatches through the exact same branch the mouse path uses.

describe("BrainPicker — keyboard activation (103-11, CR-02)", () => {
  it("profile scope, normal-tier row: ArrowDown + Enter dispatches the exact gateway.model.set payload", async () => {
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
    mockDispatchSwap.mockResolvedValue({ type: "ack", request_id: "", status: "ok" });
    renderPicker();

    openPicker();
    await screen.findByText("Codex CLI");

    const search = screen.getByPlaceholderText("Search brains…");
    fireEvent.change(search, { target: { value: "Codex" } });
    await screen.findByText("Codex CLI");
    expect(screen.queryByText("Antigravity CLI")).not.toBeInTheDocument();

    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Enter" });

    await waitFor(() => expect(mockDispatchSwap).toHaveBeenCalledTimes(1));
    expect(mockDispatchSwap).toHaveBeenCalledWith({
      type: "gateway.model.set",
      request_id: "",
      scope: "profile",
      profile_id: "assistant-default",
      model: "codex-cli",
      mode: "session",
    });
  });

  it("profile scope, expensive-tier row: first Enter expands the inline confirm without dispatching, second Enter dispatches (UI-SPEC §3 regression guard)", async () => {
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
    mockDispatchSwap.mockResolvedValue({ type: "ack", request_id: "", status: "ok" });
    renderPicker();

    openPicker();
    await screen.findByText("Codex CLI");

    const search = screen.getByPlaceholderText("Search brains…");
    // "opus-4-8" (not the display name "Opus") -- cmdk's fuzzy filter/re-select-top-match-on-search
    // behavior can otherwise let a loosely-matching duplicate-name entry ("Sonnet 5") outscore the
    // intended target for an ambiguous query; this substring is unique to anthropic-opus-4-8's id.
    fireEvent.change(search, { target: { value: "opus-4-8" } });
    await screen.findByText("Opus 4.8"); // anthropic-opus-4-8, costTier: expensive
    expect(screen.queryAllByText("Sonnet 5")).toHaveLength(0);

    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Enter" });

    // First Enter must NOT dispatch -- it opens the same inline expand-to-confirm branch a mouse
    // click takes, never a bypass (the exact regression CR-02's own note warns a naive fix
    // would introduce).
    expect(mockDispatchSwap).not.toHaveBeenCalled();
    expect(await screen.findByText("Confirm swap")).toBeInTheDocument();
    expect(
      screen.getByText(/This model may be expensive per token\. Confirm swap to Opus 4\.8\?/)
    ).toBeInTheDocument();

    fireEvent.keyDown(search, { key: "Enter" });

    await waitFor(() => expect(mockDispatchSwap).toHaveBeenCalledTimes(1));
    expect(mockDispatchSwap).toHaveBeenCalledWith(
      expect.objectContaining({ model: "anthropic-opus-4-8" })
    );
  });

  it("global scope, any row: Enter opens GlobalSwapModal and dispatches zero swap.set WS frames (D-15 confirm-gate regression guard)", async () => {
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
    renderPicker();

    openPicker();
    await screen.findByText("Codex CLI");
    fireEvent.click(screen.getByRole("radio", { name: "All profiles" }));
    // Scope switch re-fetches (103-08) -- the default mockSendCommand resolution (see beforeEach)
    // resolves with a single "codex-cli" entry, matching the profile-scope fixture's own name so
    // the same search string works for both branches.
    await screen.findByText("Codex CLI");

    const search = screen.getByPlaceholderText("Search brains…");
    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Enter" });

    const modal = await screen.findByTestId("global-swap-modal");
    expect(modal).toHaveAttribute("data-target-id", "codex-cli");
    expect(mockDispatchSwap).not.toHaveBeenCalled();
    // ANTI-STUB-MASKING PROOF: asserted directly against the real sendCommand frame log, which
    // never passes through brainsApi/VITE_BRAINS_STUB at all.
    expect(mockSendCommand).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "swap.set" })
    );
  });
});

// ── 103-11: WR-01 staleness guard on the scope-driven catalogue fetch ─────────────────────────

describe("BrainPicker — catalogue fetch generation guard (WR-01)", () => {
  it("discards a stale (superseded) catalogue response instead of overwriting the latest scope's data", async () => {
    let resolveGlobal: (value: unknown) => void = () => {};
    const deferredGlobal = new Promise((resolve) => {
      resolveGlobal = resolve;
    });
    mockGetCatalogue
      .mockResolvedValueOnce(STUB_CATALOGUE) // initial open, "This profile"
      .mockResolvedValueOnce([
        { ...STUB_CATALOGUE[0], id: "profile-marker", name: "Profile Marker Entry" },
      ]); // second "This profile" fetch, after the toggle-back below
    mockSendCommand.mockImplementationOnce(() => deferredGlobal); // "All profiles" fetch -- never resolves until we say so

    renderPicker();
    openPicker();
    await screen.findByText("Codex CLI"); // gen 1 (This profile) loaded

    // Rapid toggle: This profile -> All profiles (gen 2, deliberately left unresolved) -> This
    // profile again (gen 3, resolves immediately).
    fireEvent.click(screen.getByRole("radio", { name: "All profiles" }));
    fireEvent.click(screen.getByRole("radio", { name: "This profile" }));

    await screen.findByText("Profile Marker Entry"); // gen 3 (the LATEST request) won the render

    // Now let the STALE gen-2 (global) response resolve. If the generation guard were absent,
    // this would overwrite the already-rendered gen-3 data with gen-2's -- exactly the scope-blind
    // dispatch bug WR-01 describes (rendering one axis's catalogue while `scope` -- and the
    // dispatch branch keyed on it -- points at the other).
    resolveGlobal({
      type: "ack",
      request_id: "",
      status: "ok",
      entries: [{ id: "global-marker", name: "Global Marker Entry", vendor: "x" }],
    });
    // A real timer flush (not just a couple of microtask ticks) -- the stale response's `await
    // sendCommand(...)` continuation, the guard check, and (if it were absent) the resulting
    // setEntries/re-render all need to have a genuine chance to run before we can honestly assert
    // the stale data never landed. A bare `await Promise.resolve()` pair is not enough ticks to
    // reach that continuation reliably, which would make a negative assertion immediately after it
    // pass vacuously regardless of whether the guard actually works.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(screen.getByText("Profile Marker Entry")).toBeInTheDocument();
    expect(screen.queryByText("Global Marker Entry")).not.toBeInTheDocument();
    // The scope selector itself agrees with what's rendered -- both point at the same axis.
    expect(screen.getByRole("radio", { name: "This profile" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });
});

describe("BrainPicker — scope-aware catalogue source (103-08)", () => {
  it('scope "profile" sources the catalogue from brainsApi.getCatalogue() only, never sendCommand', async () => {
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
    renderPicker();

    openPicker();
    await screen.findByText("Codex CLI");

    expect(mockGetCatalogue).toHaveBeenCalledTimes(1);
    expect(mockSendCommand).not.toHaveBeenCalled();
  });

  it('scope "global" sources the catalogue from the live swap.catalogue command, not brainsApi', async () => {
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
    mockSendCommand.mockResolvedValue({
      type: "ack",
      request_id: "",
      status: "ok",
      entries: [{ id: "x-ai/grok-4.5", name: "Grok Live", vendor: "x-ai" }],
    });
    renderPicker();

    openPicker();
    await screen.findByText("Codex CLI"); // initial open, default "This profile" scope

    fireEvent.click(screen.getByRole("radio", { name: "All profiles" }));

    await waitFor(() =>
      expect(mockSendCommand).toHaveBeenCalledWith({ type: "swap.catalogue", target: "brain" })
    );
    expect(await screen.findByText("Grok Live")).toBeInTheDocument();
    // The stub-backed per-profile catalogue never bleeds into the global branch's rendered list.
    expect(screen.queryByText("Codex CLI")).not.toBeInTheDocument();
    // Only the initial "This profile" open touched brainsApi -- the scope switch to "global"
    // did not fall back to it.
    expect(mockGetCatalogue).toHaveBeenCalledTimes(1);
  });

  it("shows the error state, never a stub fallback, when the global swap.catalogue ack is non-ok", async () => {
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
    mockSendCommand.mockResolvedValue({
      type: "ack",
      request_id: "",
      status: "error",
      error: "backend unreachable",
    });
    renderPicker();

    openPicker();
    await screen.findByText("Codex CLI");

    fireEvent.click(screen.getByRole("radio", { name: "All profiles" }));

    expect(
      await screen.findByText("Couldn't load the brain catalogue — try again in a moment.")
    ).toBeInTheDocument();
    // Honesty check (constraint from 103-08): an errored live request must never silently
    // degrade into presenting stub data as though it were a successful (if empty) live result.
    expect(screen.queryByText("Codex CLI")).not.toBeInTheDocument();
    expect(mockGetCatalogue).toHaveBeenCalledTimes(1);
  });

  it('reads from swap.catalogue immediately when entryScope="global" is the initial scope', async () => {
    mockSendCommand.mockResolvedValue({
      type: "ack",
      request_id: "",
      status: "ok",
      entries: [{ id: "x-ai/grok-4.5", name: "Grok Live", vendor: "x-ai" }],
    });
    renderPicker({ entryScope: "global" });

    openPicker();
    await screen.findByText("Grok Live");

    expect(mockSendCommand).toHaveBeenCalledWith({ type: "swap.catalogue", target: "brain" });
    expect(mockGetCatalogue).not.toHaveBeenCalled();
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
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
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
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
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
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
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
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
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
// already-mocked `useAstridrWS`/`useGlobalBrainOverride`/`sonner` seams -- no new mocking surface
// needed. Covers all four scenarios from 103-16-PLAN.md's Task 2 action text.

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
    // Only the initial "This profile" scope (the default on every popover open) reads this --
    // every test below immediately switches to "All profiles", but the fetch still fires once on
    // open and must resolve to something so it doesn't leave a dangling unresolved promise.
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
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
    mockSendCommand.mockImplementation(async (cmd: unknown) => {
      const type = (cmd as { type?: string }).type;
      if (type === "swap.set") {
        return { type: "ack", request_id: "", status: "error", error: "backend unreachable" };
      }
      return {
        type: "ack",
        request_id: "",
        status: "ok",
        entries: [{ id: "codex-cli", name: "Codex CLI", vendor: "codex" }],
      };
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
    mockSendCommand.mockImplementation(async (cmd: unknown) => {
      const type = (cmd as { type?: string }).type;
      if (type === "swap.set") {
        return { type: "ack", request_id: "", status: "ok" };
      }
      return {
        type: "ack",
        request_id: "",
        status: "ok",
        entries: [
          { id: "codex-cli", name: "Codex CLI", vendor: "codex" },
          { id: "x-ai/grok-4.5", name: "Grok Live", vendor: "x-ai" },
        ],
      };
    });

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
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
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
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);

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
    expect(mockSendCommand).toHaveBeenCalledWith({
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
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
    // A global override is already in force (matching the default mocked active engine's model,
    // so the pre-swap snapshot resolves a readable display name for it) BEFORE this swap starts.
    mockGlobalOverride = { modelOverride: "anthropic-sonnet-5", voiceOverride: null };
    renderPicker();

    await openGlobalPickerAndSelect("Codex CLI");
    fireEvent.click(
      await screen.findByRole("button", { name: "Swap all profiles to Codex CLI" })
    );

    expect(mockSendCommand).toHaveBeenCalledWith({
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
    expect(mockSendCommand).toHaveBeenCalledWith({
      type: "swap.set",
      target: "brain",
      value: "anthropic-sonnet-5",
      restore: false,
    });

    mockGlobalOverride = { modelOverride: "anthropic-sonnet-5", voiceOverride: null };
    expect(await screen.findByText("Reverted to anthropic-sonnet-5.")).toBeInTheDocument();
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
    mockGetCatalogue.mockResolvedValue(STUB_CATALOGUE);
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
