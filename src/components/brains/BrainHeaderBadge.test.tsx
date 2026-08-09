/**
 * BrainHeaderBadge.test.tsx — 103-06-T1, rewritten under 103-06 for the composition-API rewrite.
 * Extended under 103-08 (user-authorized scope addition) to cover the live-global-engine fallback.
 * Rewritten again under Phase 109 Plan 03 (D-01/D-03) for the seam retirement: the badge's
 * catalogue and `default_profile_id` now come from `@/hooks/useBrainCatalogue`, mocked directly
 * below (controllable `entries`/`defaultProfileId`) — replacing the pre-Phase-109 per-profile
 * adapter and build-time-stub-flag mocks entirely. There is no such flag left to cover.
 *
 * `@/components/brains/BrainPicker` is mocked entirely — this file tests BrainHeaderBadge's OWN
 * rendering/composition logic (mixed-state honesty, aria-label, pulse dot, session/pinned line,
 * trigger composition, pending mirroring), not BrainPicker's own internals (already covered by
 * BrainPicker.test.tsx, including the real `trigger`/`onPendingChange` API this mock stands in
 * for). The mock renders `props.trigger` verbatim (exactly what the real `BrainPicker` does via
 * `PopoverTrigger asChild`) and exposes a `mock-toggle-pending` button that calls
 * `props.onPendingChange` directly — the real callback contract — rather than mutating any DOM
 * node a consumer would have to scrape.
 *
 * `convex/react` + the generated Convex API module are mocked directly (not
 * `@/hooks/useActiveEngine`/`@/hooks/useProfileConfigs`) so the REAL `useActiveEngine` hook and
 * REAL `deriveMixedState` pure function run — this is the same idiom `useActiveEngine.test.ts`
 * already establishes for hook-level tests.
 *
 * `@/contexts/AstridrWSContext` is also mocked directly (not the real `AstridrWSProvider`, which
 * this file never renders) so tests can (a) fire a controlled `swap.state` event through the exact
 * `subscribeEvent` callback contract the real provider uses, and (b) simulate the real provider's
 * out-of-provider throw (`useAstridrWS must be used within AstridrWSProvider`) via
 * `mockAstridrWSThrows`, proving `BrainHeaderBadge`'s own try/catch degrades gracefully rather than
 * relying on a real provider ever wrapping this test.
 */

import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrainHeaderBadge } from "./BrainHeaderBadge";

// ─── Astridr WS mock (103-08) ──────────────────────────────────────────────

type WSEventCallback = (event: Record<string, unknown>) => void;

let mockAstridrWSThrows = false;
// Phase 109 D-06: `useProfileBrainOverrides` (via `useResolvedBrain`) is now a SECOND, independent
// `swap.state` subscriber alongside `useGlobalBrainOverride`'s — mirroring the real
// `AstridrWSProvider`'s fan-out (every `subscribeEvent` call registers its own listener; firing an
// event invokes ALL listeners registered for that type), this tracks every registered swap.state
// callback, not just the last one, so `emitSwapState` below drives both hooks correctly.
const capturedSwapStateCallbacks: WSEventCallback[] = [];
const mockUnsubscribe = vi.fn();
const mockSubscribeEvent = vi.fn((eventType: string, callback: WSEventCallback) => {
  if (eventType === "swap.state") {
    capturedSwapStateCallbacks.push(callback);
  }
  return mockUnsubscribe;
});
// 103-09: the badge now reads the global-override snapshot through `useResolvedBrain` ->
// `useGlobalBrainOverride`, which sends `swap.get_state` on every connected transition.
// Controllable so tests can seed an already-active override with ZERO swap.state events.
const mockSendCommand = vi.fn();

vi.mock("@/contexts/AstridrWSContext", () => ({
  useAstridrWS: () => {
    if (mockAstridrWSThrows) {
      throw new Error("useAstridrWS must be used within AstridrWSProvider");
    }
    return {
      status: "connected",
      sendCommand: mockSendCommand,
      subscribe: vi.fn(),
      subscribeEvent: mockSubscribeEvent,
      reconnect: vi.fn(),
    };
  },
}));

/** Fires the real `swap.state` event shape (`{ event_type, data: { model_override } }`) through
 * EVERY registered swap.state callback — mirrors what `AstridrWSProvider`'s own `ws.onmessage`
 * fan-out delivers to `subscribeEvent` listeners (every subscriber, not just the most recent). */
function emitSwapState(modelOverride: string | null) {
  act(() => {
    for (const cb of capturedSwapStateCallbacks) {
      cb({ event_type: "swap.state", data: { model_override: modelOverride } });
    }
  });
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

type MockPending = { label: string; kind: "inflight" | "uncertain" } | null;

let mockOnPendingChange: ((pending: MockPending) => void) | undefined;

vi.mock("@/components/brains/BrainPicker", () => ({
  BrainPicker: (props: {
    profileId: string;
    entryScope?: string;
    trigger?: ReactNode;
    onPendingChange?: (pending: MockPending) => void;
  }) => {
    mockOnPendingChange = props.onPendingChange;
    return (
      <div
        data-testid="mock-brain-picker"
        data-profile-id={props.profileId}
        data-entry-scope={props.entryScope ?? ""}
      >
        {props.trigger}
        <button
          type="button"
          data-testid="mock-toggle-pending"
          data-pending="false"
          onClick={(e) => {
            const btn = e.currentTarget;
            const nextPending = btn.dataset.pending !== "true";
            btn.dataset.pending = String(nextPending);
            props.onPendingChange?.(
              nextPending ? { label: "· switching to Codex CLI…", kind: "inflight" } : null
            );
          }}
        >
          toggle pending
        </button>
      </div>
    );
  },
}));

// The display-name helpers (and, since Phase 109 Plan 05, D-08's modelIdsMatch) are pure
// functions with no I/O, so they are wired to the REAL implementations via importOriginal rather
// than stubbed — a stub returning the raw id would silently pass the very cosmetic regression
// they exist to prevent (UAT 2026-07-29), and a stubbed modelIdsMatch would silently pass the
// provider-dot format-tolerance regression D-08 exists to prevent.
vi.mock("@/lib/brainsApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/brainsApi")>();
  return {
    resolveModelDisplayName: actual.resolveModelDisplayName,
    buildModelNameMap: actual.buildModelNameMap,
    modelIdsMatch: actual.modelIdsMatch,
  };
});

// Phase 109 D-01/D-03: the ONE swap.catalogue fetcher, mocked directly (controllable
// `entries`/`defaultProfileId`) — replaces the pre-Phase-109 per-profile adapter's two separate
// mocked methods. `useGlobalModelNames` (imported from `@/hooks/useResolvedBrain`, unmocked in
// this file) is itself a thin derivation over this same hook, so mocking it here also drives that
// derivation.
let mockCatalogueEntries: { id: string; name: string; vendor?: string }[] | null = [];
let mockDefaultProfileId = "assistant-default";
vi.mock("@/hooks/useBrainCatalogue", () => ({
  useBrainCatalogue: () => ({
    entries: mockCatalogueEntries,
    defaultProfileId: mockDefaultProfileId,
    error: false,
    refetch: vi.fn(),
  }),
}));

const mockUseQuery = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));
vi.mock("../../../convex/_generated/api", () => ({
  api: {
    activeEngine: { latestByProfile: "activeEngine:latestByProfile" },
    profiles: { listConfigs: "profiles:listConfigs" },
  },
}));

beforeAll(() => {
  if (typeof window.ResizeObserver === "undefined") {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

beforeEach(() => {
  mockOnPendingChange = undefined;
  mockCatalogueEntries = [];
  mockDefaultProfileId = "assistant-default";
  mockUseQuery.mockReset();
  mockUseQuery.mockReturnValue(undefined);
  mockAstridrWSThrows = false;
  capturedSwapStateCallbacks.length = 0;
  mockUnsubscribe.mockReset();
  mockSubscribeEvent.mockClear();
  mockSendCommand.mockReset();
  mockSendCommand.mockResolvedValue({
    type: "ack",
    request_id: "x",
    status: "ok",
    model_override: null,
    voice_override_name: null,
  });
});

type StubEngine = {
  profileId: string;
  model: string;
  mode: "session" | "pinned" | "inherited";
  selectionPath: string;
  expiresAt?: number;
  timestamp: number;
};

function makeEngine(profileId: string, model: string, overrides: Partial<StubEngine> = {}): StubEngine {
  return {
    profileId,
    model,
    mode: "pinned",
    selectionPath: "codepulse-default",
    timestamp: Date.now(),
    ...overrides,
  };
}

function seedEngines(snapshots: StubEngine[], profileIds: string[]) {
  mockUseQuery.mockImplementation((ref: unknown) => {
    if (ref === "activeEngine:latestByProfile") return snapshots;
    if (ref === "profiles:listConfigs") return profileIds.map((profileId) => ({ profileId }));
    return undefined;
  });
}

function renderBadge() {
  return render(
    <TooltipProvider>
      <BrainHeaderBadge />
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------

describe("BrainHeaderBadge — agreement", () => {
  it("renders the agreed engine name and a single provider-color dot when all profiles agree", async () => {
    seedEngines(
      [
        makeEngine("assistant-default", "anthropic-sonnet-5"),
        makeEngine("consulting", "anthropic-sonnet-5"),
      ],
      ["assistant-default", "consulting"]
    );
    renderBadge();

    expect(await screen.findByTestId("brain-header-badge-label")).toHaveTextContent(
      "anthropic-sonnet-5"
    );
    expect(screen.queryByText("Mixed brains")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Active brain: anthropic-sonnet-5" })
    ).toBeInTheDocument();
  });

  it("passes no entryScope (defaults to This profile) to BrainPicker when profiles agree", async () => {
    seedEngines(
      [
        makeEngine("assistant-default", "anthropic-sonnet-5"),
        makeEngine("consulting", "anthropic-sonnet-5"),
      ],
      ["assistant-default", "consulting"]
    );
    renderBadge();

    await screen.findByTestId("brain-header-badge-label");
    expect(screen.getByTestId("mock-brain-picker")).toHaveAttribute("data-entry-scope", "");
  });
});

describe("BrainHeaderBadge — provider dot tolerates a model-id vendor-prefix mismatch (Phase 109 Plan 05, D-08)", () => {
  it("resolves the real vendor color when the reported model is vendor-prefixed but the catalogue id is bare", async () => {
    mockCatalogueEntries = [
      { id: "claude-sonnet-5", name: "Claude Sonnet 5", vendor: "anthropic_direct" },
    ];
    seedEngines(
      [makeEngine("assistant-default", "anthropic/claude-sonnet-5")],
      ["assistant-default"]
    );
    const { container } = renderBadge();

    await screen.findByTestId("brain-header-badge-label");
    const dot = container.querySelector(
      'span[aria-hidden="true"].rounded-full:not(.animate-pulse)'
    );
    expect(dot).not.toBeNull();
    expect((dot as HTMLElement).style.backgroundColor).not.toBe("var(--muted-foreground)");
  });

  it("CONTROL: still falls back to the neutral dot when the reported model matches NOTHING in the catalogue — a change that made the lookup always succeed must fail this", async () => {
    mockCatalogueEntries = [
      { id: "claude-sonnet-5", name: "Claude Sonnet 5", vendor: "anthropic_direct" },
    ];
    seedEngines(
      [makeEngine("assistant-default", "anthropic/claude-opus-4-8")],
      ["assistant-default"]
    );
    const { container } = renderBadge();

    await screen.findByTestId("brain-header-badge-label");
    const dot = container.querySelector(
      'span[aria-hidden="true"].rounded-full:not(.animate-pulse)'
    );
    expect(dot).not.toBeNull();
    expect((dot as HTMLElement).style.backgroundColor).toBe("var(--muted-foreground)");
  });
});

describe("BrainHeaderBadge — mixed state (D-14/BSC-01 honesty)", () => {
  it('renders "Mixed brains" and a stacked multi-dot cluster, never a single engine name as the headline, when profiles disagree', async () => {
    seedEngines(
      [
        makeEngine("assistant-default", "anthropic-sonnet-5"),
        makeEngine("consulting", "claude-cli-sonnet5"),
      ],
      ["assistant-default", "consulting"]
    );
    renderBadge();

    expect(await screen.findByTestId("brain-header-badge-label")).toHaveTextContent("Mixed brains");
    expect(screen.queryByText("anthropic-sonnet-5")).not.toBeInTheDocument();
    expect(screen.queryByText("claude-cli-sonnet5")).not.toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Active brain: Mixed brains" })
    ).toBeInTheDocument();
  });

  it('opens the picker with the all-profiles entry scope when clicked from the mixed state', async () => {
    seedEngines(
      [
        makeEngine("assistant-default", "anthropic-sonnet-5"),
        makeEngine("consulting", "claude-cli-sonnet5"),
      ],
      ["assistant-default", "consulting"]
    );
    renderBadge();

    await screen.findByTestId("brain-header-badge-label");
    expect(screen.getByTestId("mock-brain-picker")).toHaveAttribute("data-entry-scope", "global");
  });
});

describe("BrainHeaderBadge — no engine reported", () => {
  it("renders an honest unknown state without throwing when no profile has reported telemetry", async () => {
    seedEngines([], []);
    expect(() => renderBadge()).not.toThrow();

    expect(await screen.findByTestId("brain-header-badge-label")).toHaveTextContent(
      "Not reported"
    );
  });

  it('carries the accessible name "Active brain: Not reported" (no parenthetical), italic/muted label text, and no color dot for the absent state (D-07/UI-SPEC §A)', async () => {
    seedEngines([], []);
    const { container } = renderBadge();

    const label = await screen.findByTestId("brain-header-badge-label");
    expect(label.className).toContain("italic");
    expect(label.className).toContain("text-muted-foreground");
    expect(
      screen.getByRole("button", { name: "Active brain: Not reported" })
    ).toBeInTheDocument();
    // No color dot — neither the single-model dot nor the mixed-state stacked cluster.
    expect(container.querySelector('span[aria-hidden="true"].rounded-full')).not.toBeInTheDocument();
  });
});

describe("BrainHeaderBadge — confirmed-live pulse dot", () => {
  it("renders the confirmed-live pulse dot for a server-confirmed, non-pending reading", async () => {
    seedEngines([makeEngine("assistant-default", "anthropic-sonnet-5")], ["assistant-default"]);
    const { container } = renderBadge();

    await screen.findByTestId("brain-header-badge-label");
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("does not render the CONFIRMED-LIVE pulse dot while a swap is pending — the pulse that DOES render while pending is the separate, in-flight status-info one (Phase 109 Plan 06)", async () => {
    seedEngines([makeEngine("assistant-default", "anthropic-sonnet-5")], ["assistant-default"]);
    const { container } = renderBadge();

    await screen.findByTestId("brain-header-badge-label");
    fireEvent.click(screen.getByTestId("mock-toggle-pending"));

    await screen.findByTestId("brain-header-badge-pending");
    expect(container.querySelector('[class*="bg-primary"].animate-pulse')).not.toBeInTheDocument();
  });
});

describe("BrainHeaderBadge — the bounded 'accepted, not yet confirmed' state reads as uncertain, never in-progress (Phase 109 Plan 06, 109-UI-SPEC.md §C)", () => {
  it("renders a static AlertTriangle (never a pulsing dot) for the uncertain kind, paired with a control asserting the in-flight kind renders the pulse and no AlertTriangle", async () => {
    seedEngines([makeEngine("assistant-default", "anthropic-sonnet-5")], ["assistant-default"]);
    const { container } = renderBadge();
    await screen.findByTestId("brain-header-badge-label");

    // CONTROL: in-flight — the status-info pulsing dot renders, no AlertTriangle.
    act(() => {
      mockOnPendingChange?.({ label: "· switching to Codex CLI…", kind: "inflight" });
    });
    await screen.findByTestId("brain-header-badge-pending");
    expect(container.querySelector('[class*="status-info"].animate-pulse')).toBeInTheDocument();
    expect(container.querySelector("svg.lucide-triangle-alert")).not.toBeInTheDocument();

    // Uncertain — a static AlertTriangle, never a pulsing dot.
    act(() => {
      mockOnPendingChange?.({ label: "· not yet confirmed", kind: "uncertain" });
    });
    await waitFor(() =>
      expect(screen.getByTestId("brain-header-badge-pending")).toHaveTextContent(
        "not yet confirmed"
      )
    );
    expect(container.querySelector('[class*="status-info"].animate-pulse')).not.toBeInTheDocument();
    expect(container.querySelector("svg.lucide-triangle-alert")).toBeInTheDocument();
  });

  it("isConfirmedLive (the primary pulse) is false while any suffix is showing, including the uncertain state", async () => {
    seedEngines([makeEngine("assistant-default", "anthropic-sonnet-5")], ["assistant-default"]);
    const { container } = renderBadge();
    await screen.findByTestId("brain-header-badge-label");
    expect(container.querySelector('[class*="bg-primary"].animate-pulse')).toBeInTheDocument();

    act(() => {
      mockOnPendingChange?.({ label: "· not yet confirmed", kind: "uncertain" });
    });
    await screen.findByTestId("brain-header-badge-pending");
    expect(container.querySelector('[class*="bg-primary"].animate-pulse')).not.toBeInTheDocument();
  });
});

describe("BrainHeaderBadge — session override vs pinned default (D-02)", () => {
  it("renders the session secondary line, never the pinned line, for a session-override reading", async () => {
    seedEngines(
      [
        makeEngine("assistant-default", "anthropic-sonnet-5", {
          mode: "session",
          expiresAt: Math.floor(Date.now() / 1000) + 1800,
        }),
      ],
      ["assistant-default"]
    );
    renderBadge();

    expect(await screen.findByTestId("brain-header-badge-session")).toHaveTextContent(
      /session override/
    );
    expect(screen.queryByTestId("brain-header-badge-pinned")).not.toBeInTheDocument();
  });

  it("renders the pinned secondary line, never the session line, for a pinned-default reading", async () => {
    seedEngines(
      [makeEngine("assistant-default", "anthropic-sonnet-5", { mode: "pinned" })],
      ["assistant-default"]
    );
    renderBadge();

    expect(await screen.findByTestId("brain-header-badge-pinned")).toHaveTextContent(
      "pinned default"
    );
    expect(screen.queryByTestId("brain-header-badge-session")).not.toBeInTheDocument();
  });
});

describe("BrainHeaderBadge — trigger composition (103-06)", () => {
  it("passes its own visible, accessible button as BrainPicker's `trigger` prop instead of mounting a second, hidden picker", async () => {
    seedEngines([makeEngine("assistant-default", "anthropic-sonnet-5")], ["assistant-default"]);
    renderBadge();

    const picker = await screen.findByTestId("mock-brain-picker");
    // The real "Active brain" button renders INSIDE the (mocked) BrainPicker, because it IS the
    // `trigger` prop BrainPicker renders via `PopoverTrigger asChild` — not a separate element a
    // click has to be relayed into.
    expect(
      within(picker).getByRole("button", { name: "Active brain: anthropic-sonnet-5" })
    ).toBeInTheDocument();
    // Exactly one "Active brain" control exists in the whole accessibility tree — no second,
    // invisibly-mounted instance anywhere in the document.
    expect(screen.getAllByRole("button", { name: /Active brain:/ })).toHaveLength(1);
  });

  it("passes Ástríðr's own default_profile_id (from useBrainCatalogue) through to BrainPicker as the effective profileId", async () => {
    seedEngines([makeEngine("assistant-default", "anthropic-sonnet-5")], ["assistant-default"]);
    renderBadge();

    await screen.findByTestId("brain-header-badge-label");
    expect(screen.getByTestId("mock-brain-picker")).toHaveAttribute(
      "data-profile-id",
      "assistant-default"
    );
  });
});

describe("BrainHeaderBadge — default_profile_id has no Convex-ordering fallback (D-03)", () => {
  it("addresses profiles[0].profileId's profile ONLY through the paired control below — with default_profile_id absent, the picker addresses NO profile at all", async () => {
    mockDefaultProfileId = "";
    seedEngines(
      [makeEngine("assistant-default", "anthropic-sonnet-5")],
      ["assistant-default", "consulting"]
    );
    renderBadge();

    await screen.findByTestId("brain-header-badge-label");
    // The rejected D-03 option was `profiles[0]?.profileId` — here that would be
    // "assistant-default". This assertion fails if that fallback is ever reintroduced.
    expect(screen.getByTestId("mock-brain-picker")).toHaveAttribute("data-profile-id", "");
  });

  it("CONTROL: with a real default_profile_id present, the picker DOES address that profile — proves the test above is a real absence, not a vacuous always-empty render", async () => {
    mockDefaultProfileId = "consulting";
    seedEngines(
      [makeEngine("assistant-default", "anthropic-sonnet-5")],
      ["assistant-default", "consulting"]
    );
    renderBadge();

    await screen.findByTestId("brain-header-badge-label");
    expect(screen.getByTestId("mock-brain-picker")).toHaveAttribute(
      "data-profile-id",
      "consulting"
    );
  });
});

describe("BrainHeaderBadge — pending never lies (D-15)", () => {
  it("keeps the base label unchanged and shows a switching-to suffix while a swap is in flight", async () => {
    seedEngines([makeEngine("assistant-default", "anthropic-sonnet-5")], ["assistant-default"]);
    renderBadge();

    const labelBefore = (await screen.findByTestId("brain-header-badge-label")).textContent;
    expect(labelBefore).toBe("anthropic-sonnet-5");

    fireEvent.click(screen.getByTestId("mock-toggle-pending"));

    expect(await screen.findByTestId("brain-header-badge-pending")).toHaveTextContent(
      "switching to Codex CLI"
    );
    expect(screen.getByTestId("brain-header-badge-label").textContent).toBe(labelBefore);
  });

  it("drops the pending suffix once BrainPicker's onPendingChange reports it cleared", async () => {
    seedEngines([makeEngine("assistant-default", "anthropic-sonnet-5")], ["assistant-default"]);
    renderBadge();

    await screen.findByTestId("brain-header-badge-label");
    fireEvent.click(screen.getByTestId("mock-toggle-pending"));
    await screen.findByTestId("brain-header-badge-pending");

    fireEvent.click(screen.getByTestId("mock-toggle-pending"));
    await waitFor(() =>
      expect(screen.queryByTestId("brain-header-badge-pending")).not.toBeInTheDocument()
    );
  });

  it("exposes onPendingChange as a real callback prop, invocable directly, not sourced from any DOM node", async () => {
    seedEngines([makeEngine("assistant-default", "anthropic-sonnet-5")], ["assistant-default"]);
    renderBadge();

    await screen.findByTestId("brain-header-badge-label");
    expect(mockOnPendingChange).toBeInstanceOf(Function);

    mockOnPendingChange?.({ label: "· switching to Fable 5…", kind: "inflight" });
    expect(await screen.findByTestId("brain-header-badge-pending")).toHaveTextContent(
      "switching to Fable 5"
    );

    mockOnPendingChange?.(null);
    await waitFor(() =>
      expect(screen.queryByTestId("brain-header-badge-pending")).not.toBeInTheDocument()
    );
  });
});

describe("BrainHeaderBadge — global engine fallback (103-08, precedence corrected under 103-09)", () => {
  it("a live global override now WINS over an existing per-profile reading (103-09 corrects 103-08's per-profile-always-wins precedence per 103-CONTRACT.md §9 — a global override genuinely shadows the per-profile default, so showing the stale per-profile value while a global override governs the turn is exactly the BSC-01 trap)", async () => {
    seedEngines([makeEngine("assistant-default", "anthropic-sonnet-5")], ["assistant-default"]);
    renderBadge();
    await screen.findByTestId("brain-header-badge-label");

    emitSwapState("claude-cli-sonnet5");

    expect(screen.getByTestId("brain-header-badge-label")).toHaveTextContent("claude-cli-sonnet5");
    expect(screen.getByTestId("brain-header-badge-global-chip")).toHaveTextContent("Global");
    expect(
      screen.getByRole("button", { name: "Active brain: claude-cli-sonnet5 (global)" })
    ).toBeInTheDocument();
  });

  it("falls back to the live global engine, labelled as global, when no profile has reported telemetry", async () => {
    seedEngines([], []);
    renderBadge();
    await screen.findByTestId("brain-header-badge-label");
    expect(screen.getByTestId("brain-header-badge-label")).toHaveTextContent("Not reported");

    emitSwapState("anthropic-opus-4-8");

    expect(screen.getByTestId("brain-header-badge-label")).toHaveTextContent("anthropic-opus-4-8");
    expect(screen.getByTestId("brain-header-badge-global-chip")).toHaveTextContent("Global");
    expect(
      screen.getByRole("button", { name: "Active brain: anthropic-opus-4-8 (global)" })
    ).toBeInTheDocument();
  });

  it('keeps "Not reported" when both per-profile telemetry and the global engine are empty', async () => {
    seedEngines([], []);
    renderBadge();

    expect(await screen.findByTestId("brain-header-badge-label")).toHaveTextContent(
      "Not reported"
    );
    expect(screen.queryByTestId("brain-header-badge-global-chip")).not.toBeInTheDocument();

    // An explicit null override (no global override active either) must not manufacture a reading.
    emitSwapState(null);
    expect(screen.getByTestId("brain-header-badge-label")).toHaveTextContent("Not reported");
    expect(screen.queryByTestId("brain-header-badge-global-chip")).not.toBeInTheDocument();
  });

  it("a live global override now WINS over a real Mixed-brains reading too (same 103-09 precedence correction — global is rung 2, ahead of any per-profile reading including a disagreeing fleet)", async () => {
    seedEngines(
      [
        makeEngine("assistant-default", "anthropic-sonnet-5"),
        makeEngine("consulting", "claude-cli-sonnet5"),
      ],
      ["assistant-default", "consulting"]
    );
    renderBadge();
    await screen.findByTestId("brain-header-badge-label");

    emitSwapState("fable-5");

    expect(screen.getByTestId("brain-header-badge-label")).toHaveTextContent("fable-5");
    expect(screen.getByTestId("brain-header-badge-global-chip")).toHaveTextContent("Global");
    expect(screen.getByRole("button", { name: "Active brain: fable-5 (global)" })).toBeInTheDocument();
  });

  it("degrades to no global reading, without throwing, when rendered as if outside AstridrWSProvider", async () => {
    mockAstridrWSThrows = true;
    seedEngines([], []);

    expect(() => renderBadge()).not.toThrow();
    expect(await screen.findByTestId("brain-header-badge-label")).toHaveTextContent(
      "Not reported"
    );
    expect(screen.queryByTestId("brain-header-badge-global-chip")).not.toBeInTheDocument();
  });

  it("unsubscribes from swap.state and run.completed on unmount", async () => {
    seedEngines([], []);
    const { unmount } = renderBadge();
    await screen.findByTestId("brain-header-badge-label");

    expect(mockSubscribeEvent).toHaveBeenCalledWith("swap.state", expect.any(Function));
    // useLastTurnModel's run.completed fallback subscription (2026-07-31 honest-absent-state fix).
    expect(mockSubscribeEvent).toHaveBeenCalledWith("run.completed", expect.any(Function));
    expect(mockUnsubscribe).not.toHaveBeenCalled();

    unmount();
    // Phase 109 D-06: useProfileBrainOverrides also subscribes to swap.state (a second, independent
    // subscription alongside useGlobalBrainOverride's) — three total: swap.state x2, run.completed x1.
    expect(mockUnsubscribe).toHaveBeenCalledTimes(3);
  });
});

describe("BrainHeaderBadge — global override snapshot on load (103-09, BSC-01 gap closure)", () => {
  it("shows an override already active before page load, correctly qualified as global, from the swap.get_state ack alone — zero swap.state events", async () => {
    mockSendCommand.mockResolvedValue({
      type: "ack",
      request_id: "x",
      status: "ok",
      model_override: "claude-haiku-4-5-20251001",
      voice_override_name: null,
    });
    seedEngines([], []);
    renderBadge();

    expect(
      await screen.findByRole("button", {
        name: "Active brain: claude-haiku-4-5-20251001 (global)",
      })
    ).toBeInTheDocument();
    expect(screen.getByTestId("brain-header-badge-global-chip")).toHaveTextContent("Global");
    // This is the exact 2026-07-28 live regression: the pre-103-09 badge only ever subscribed to
    // swap.state (a change event) and never requested a snapshot, so an override already active
    // before load read as "Not reported" forever. The subscription is still set up (for
    // in-tab changes), but this test's reading comes entirely from the ack.
    expect(capturedSwapStateCallbacks.length).toBeGreaterThan(0);
  });

  it('still renders "Mixed brains" when there is no global override and two profiles disagree — the global path must not swallow the honest mixed reading', async () => {
    seedEngines(
      [
        makeEngine("assistant-default", "anthropic-sonnet-5"),
        makeEngine("consulting", "claude-cli-sonnet5"),
      ],
      ["assistant-default", "consulting"]
    );
    renderBadge();

    expect(await screen.findByTestId("brain-header-badge-label")).toHaveTextContent(
      "Mixed brains"
    );
    expect(
      screen.getByRole("button", { name: "Active brain: Mixed brains" })
    ).toBeInTheDocument();
    expect(screen.queryByTestId("brain-header-badge-global-chip")).not.toBeInTheDocument();
  });
});

describe("BrainHeaderBadge — accessibility", () => {
  it("carries an aria-label containing the active engine name, independent of viewport", async () => {
    seedEngines([makeEngine("assistant-default", "anthropic-sonnet-5")], ["assistant-default"]);
    renderBadge();

    const button = await screen.findByRole("button", { name: /Active brain:/ });
    expect(button).toHaveAttribute("aria-label", "Active brain: anthropic-sonnet-5");
    // Text label is viewport-hidden below sm:, but aria-label carries the same content regardless.
    expect(within(button).getByTestId("brain-header-badge-label").className).toContain("sm:inline");
  });

  it("never places a focusable element inside an aria-hidden container (axe aria-hidden-focus regression, 103-06)", async () => {
    seedEngines([makeEngine("assistant-default", "anthropic-sonnet-5")], ["assistant-default"]);
    const { container } = renderBadge();
    await screen.findByTestId("brain-header-badge-label");

    // This is the exact defect the pre-103-06 shape had: a whole second BrainPicker instance
    // mounted inside a `aria-hidden="true"` wrapper for its real trigger `<button>` to be
    // DOM-relay-clicked into. `opacity-0`/`pointer-events-none` do not remove an element from the
    // tab order, so that trigger stayed keyboard-focusable while assistive tech was told to ignore
    // it — WCAG 4.1.2 / axe-core `aria-hidden-focus`. There must be zero focusable descendants of
    // any `aria-hidden="true"` element anywhere in this component's render.
    const FOCUSABLE_SELECTOR = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const hiddenContainers = Array.from(container.querySelectorAll('[aria-hidden="true"]'));
    for (const hidden of hiddenContainers) {
      expect(hidden.querySelectorAll(FOCUSABLE_SELECTOR)).toHaveLength(0);
    }
  });
});
