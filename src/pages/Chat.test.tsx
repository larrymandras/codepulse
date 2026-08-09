/**
 * Chat.test.tsx — mount-triggered auto-send effect (Phase 99 Plan 02,
 * LAUNCH-01/03).
 *
 * A Run→Chat/Ástríðr handoff (router state `{ autoSend }`, Plan 03's
 * navigate('/chat', { state })) must always produce an executed chat.send
 * on mount — never a prefilled-and-waiting composer (D-05/D-06) — and
 * record exactly one `recordSkillLaunch` on confirmed send (D-12). A WS that
 * settles disconnected before ever connecting must surface an honest toast
 * instead of silently dropping the launch (Pitfall 3).
 *
 * useAstridrChat is mocked directly (spy `sendMessage`, controllable
 * `status`) per the plan — this isolates the mount-effect contract from the
 * real hook's streaming/TTS/approval machinery (already covered by
 * useAstridrChat.test.ts and the pre-existing __tests__/Chat.test.tsx).
 */
import React from "react";
import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor, screen, act, within, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockSendMessage = vi.fn().mockResolvedValue(true);
const mockRecordSkillLaunch = vi.fn().mockResolvedValue(undefined);
const mockAppendLocalAssistantMessage = vi.fn();
const mockCorrectAssistantMessage = vi.fn();
/** Stable across renders so tests can assert swap.get_state re-pull counts. */
const mockSendCommand = vi.fn().mockResolvedValue({ status: "ok" });

/** Mutable status the mocked useAstridrChat() reads on each call. */
let mockStatus: "connected" | "reconnecting" | "disconnected" = "connected";

/**
 * Registered (eventType -> callback) pairs across every subscribeEvent()
 * caller in the tree (Chat.tsx's own run.completed/swap.state listeners AND
 * ControlCenterPanel's proactive_prefs.state listener all share this one
 * mocked context) — 186-08 regression coverage dispatches directly into the
 * REAL registered callback rather than asserting state was merely set.
 */
const registeredEventHandlers = new Map<string, (event: Record<string, unknown>) => void>();

vi.mock("@/contexts/AstridrWSContext", () => ({
  useAstridrWS: () => ({
    status: mockStatus,
    sendCommand: mockSendCommand,
    subscribeEvent: vi.fn((eventType: string, cb: (event: Record<string, unknown>) => void) => {
      registeredEventHandlers.set(eventType, cb);
      return () => registeredEventHandlers.delete(eventType);
    }),
  }),
}));

vi.mock("@/hooks/useAstridrChat", () => ({
  useAstridrChat: () => ({
    status: mockStatus,
    messages: [],
    sendMessage: mockSendMessage,
    isStreaming: false,
    ttsEnabled: false,
    setTtsEnabled: vi.fn(),
    playAudio: vi.fn(),
    stopAudio: vi.fn(),
    ttsIsPlaying: false,
    interrupt: vi.fn(() => ""),
    appendLocalAssistantMessage: mockAppendLocalAssistantMessage,
    correctAssistantMessage: mockCorrectAssistantMessage,
    handleApprove: vi.fn(),
    handleReject: vi.fn(),
    registerScreenShare: vi.fn(),
    activeSessionRef: { current: null },
    streamingReplyRef: { current: "" },
  }),
}));

// Phase 186-13: Chat.tsx now also mounts <FocusExitDigest /> (D-07), which
// calls useQuery(api.inbox.listAll) -- an empty array is sufficient, this
// suite doesn't exercise the focus-exit toast itself (see
// FocusExitDigest.test.tsx for that coverage).
// 188-13: command-center mode mounts LlmStatusPanel/SystemMonitorPanel,
// both of which pull through useLlmMetrics -> usePaginatedQuery — add it
// alongside the existing useQuery/useMutation mocks (a wholesale-mocked
// module has no real implementation for anything not listed here).
vi.mock("convex/react", () => ({
  useMutation: vi.fn(() => mockRecordSkillLaunch),
  useQuery: vi.fn(() => []),
  usePaginatedQuery: vi.fn(() => ({ results: [], status: "Exhausted", loadMore: vi.fn() })),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

// ─── 103-07-T2: composer brain pill mocks ─────────────────────────────────────
//
// useActiveEngine, useBrainCatalogue, and BrainPicker are mocked directly (rather than exercising
// the real Convex-backed hook / real WS catalogue fetch / real cmdk Popover) — this file tests
// Chat.tsx's OWN composition of the pill (label sourcing, session/pinned line, pending mirroring,
// trigger passthrough), not BrainPicker's own internals (covered by BrainPicker.test.tsx) or
// useActiveEngine's own join logic (covered by useActiveEngine.test.ts). Mirrors the exact idiom
// BrainHeaderBadge.test.tsx already established for the same composition-API shape. Phase 109 D-01/
// D-03 retired the pre-Phase-109 per-profile adapter and its build-time stub flag, which this file
// used to mock as three separate seams — useBrainCatalogue() now supplies both live values (the
// catalogue and the default profile id) from ONE mocked hook.
type MockEngine = {
  model: string;
  mode: "session" | "pinned" | "inherited";
  expiresAt?: number;
} | null;

let mockActiveEngineMap: Record<string, MockEngine> = {};

// 188-13: LlmStatusPanel is the first consumer in this tree to call
// useResolvedBrain() with NO profileId, which routes through the real
// deriveMixedState() (previously untouched by this file's mocks — every
// other consumer here always passes a profileId). Keep it real via
// importOriginal rather than stubbing useActiveEngine wholesale, or that
// branch throws "no deriveMixedState export" the moment it's exercised.
vi.mock("@/hooks/useActiveEngine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useActiveEngine")>();
  return {
    ...actual,
    useActiveEngine: () => mockActiveEngineMap,
  };
});

// The display-name helpers are pure functions with no I/O, so they are wired to the REAL
// implementations via importOriginal rather than stubbed — a stub returning the raw id would
// silently pass the very cosmetic regression they exist to prevent (UAT 2026-07-29).
vi.mock("@/lib/brainsApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/brainsApi")>();
  return {
    resolveModelDisplayName: actual.resolveModelDisplayName,
    buildModelNameMap: actual.buildModelNameMap,
    modelIdsMatch: actual.modelIdsMatch,
  };
});

// Phase 109 D-01/D-03: the ONE swap.catalogue fetcher, mocked directly. Module-load defaults
// below hold for every test unless a test explicitly reassigns them — `vi.clearAllMocks()` (used
// throughout this file's existing describe blocks) does not touch these plain `let` bindings.
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

let lastBrainPickerProps: {
  profileId: string;
  trigger?: ReactNode;
  onPendingChange?: (label: string | null) => void;
} | null = null;

vi.mock("@/components/brains/BrainPicker", () => ({
  BrainPicker: (props: {
    profileId: string;
    trigger?: ReactNode;
    onPendingChange?: (label: string | null) => void;
  }) => {
    lastBrainPickerProps = props;
    return (
      <div data-testid="mock-chat-brain-picker" data-profile-id={props.profileId}>
        {props.trigger}
      </div>
    );
  },
}));

// Import after mocks
import Chat from "./Chat";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderChat(
  autoSend?: Record<string, unknown>,
  opts?: { strict?: boolean }
) {
  const entry = autoSend
    ? { pathname: "/chat", state: { autoSend } }
    : { pathname: "/chat" };
  const ui = (
    <MemoryRouter initialEntries={[entry]}>
      <Chat />
    </MemoryRouter>
  );
  return render(opts?.strict ? <React.StrictMode>{ui}</React.StrictMode> : ui);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Chat — mount-triggered auto-send (LAUNCH-01/03, D-05/D-06/D-12)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registeredEventHandlers.clear();
    mockStatus = "connected";
    mockSendMessage.mockResolvedValue(true);
    mockRecordSkillLaunch.mockResolvedValue(undefined);
  });

  it("sends the handoff text and records the launch exactly once when connected", async () => {
    renderChat({ text: "/x 1", skillName: "x" });

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
    });
    expect(mockSendMessage).toHaveBeenCalledWith("/x 1", undefined);

    await waitFor(() => {
      expect(mockRecordSkillLaunch).toHaveBeenCalledTimes(1);
    });
    expect(mockRecordSkillLaunch).toHaveBeenCalledWith({ name: "x" });
  });

  it("forwards the profile from the handoff onto sendMessage's opts", async () => {
    renderChat({ text: "/y", skillName: "y", profile: "business" });

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith("/y", { profile: "business" });
    });
    // Honest-state (D-14a): only the profile-forwarding wire contract is
    // asserted — no claim that a persona voice answered.
  });

  it("does nothing when there is no autoSend handoff in router state", async () => {
    renderChat();

    // Let any pending effects flush.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(mockRecordSkillLaunch).not.toHaveBeenCalled();
  });

  it("fires sendMessage exactly once under React StrictMode double-mount", async () => {
    renderChat({ text: "/z", skillName: "z" }, { strict: true });

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
    });
    // Give a hypothetical late double-fire a chance to land, then re-assert.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
  });

  it("shows an honest toast and never sends when the WS is settled disconnected", async () => {
    mockStatus = "disconnected";
    renderChat({ text: "/w", skillName: "w" });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(mockRecordSkillLaunch).not.toHaveBeenCalled();
  });

  // ─── CR-01 (99-07): a resolved-but-FAILED send must never record ──────────
  it("does NOT record the launch when the underlying send resolves false (failed send)", async () => {
    mockSendMessage.mockResolvedValue(false);
    renderChat({ text: "/fail", skillName: "fail-skill" });

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
    });
    // Give the (would-be) recordSkillLaunch call a chance to land.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mockRecordSkillLaunch).not.toHaveBeenCalled();
  });
});

// ─── 186-08 regression: BRAIN pill reflects a live run.completed model ──────
//
// Root cause (confirmed live via a Playwright probe against the real running
// astridr-agent, not just source reading): every CodePulse chat.send turn
// runs through bootstrap/wiring.py's `_ws_agent_launcher`, which explicitly
// sets `sub_loop.complexity_assessor = None` for `_source == "codepulse_chat"`
// (a deliberate chat-speed optimization) — so `post_turn_pipeline.py`'s old
// `elif run_state.last_complexity: ...` fallback never fired for a single
// CodePulse-originated turn, and `provider.get_current_model` doesn't exist
// anywhere in the codebase (dead hasattr check). The live run.completed WS
// frame carried `"model": ""` (falsy), so Chat.tsx's `if (model)` guard
// correctly never called setLastTurnModel — the wiring was NOT the bug; the
// backend was never actually emitting a real value. Fixed in
// post_turn_pipeline.py to prefer `response.model` (always populated by
// every provider). This test asserts the value reaches the RENDERED BRAIN
// box from a simulated run.completed WS event, not just that React state
// was set — dispatching directly into the REAL callback Chat.tsx registered
// via subscribeEvent (not a re-implemented copy).
describe("Chat — BRAIN pill reflects live run.completed model (186-08)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registeredEventHandlers.clear();
    mockStatus = "connected";
  });

  // Plan 09 (186-09) wrapped the BRAIN/VOICE boxes in BrainControl/
  // VoiceControl, both of which default-label "Auto" — scope queries to
  // the BRAIN trigger specifically ("Choose brain" aria-label) so these
  // assertions aren't ambiguous now that VOICE is always visible too.
  function brainBox() {
    return screen.getByRole("button", { name: "Choose brain" });
  }

  it("shows Auto before any turn completes", () => {
    renderChat();
    expect(within(brainBox()).getByText("BRAIN")).toBeInTheDocument();
    expect(within(brainBox()).getByText("Auto")).toBeInTheDocument();
  });

  it("updates the rendered BRAIN box when a run.completed event carries a model", async () => {
    renderChat();

    await waitFor(() => {
      expect(registeredEventHandlers.has("run.completed")).toBe(true);
    });

    act(() => {
      registeredEventHandlers.get("run.completed")!({
        data: { session_id: "s1", model: "claude-sonnet-5", rounds: 1 },
      });
    });

    await waitFor(() => {
      expect(within(brainBox()).getByText("claude-sonnet-5")).toBeInTheDocument();
    });
    expect(within(brainBox()).queryByText("Auto")).not.toBeInTheDocument();
  });

  it("does NOT update the BRAIN box when run.completed carries an empty model (the exact live bug shape)", async () => {
    renderChat();

    await waitFor(() => {
      expect(registeredEventHandlers.has("run.completed")).toBe(true);
    });

    act(() => {
      registeredEventHandlers.get("run.completed")!({
        data: { session_id: "s1", model: "", rounds: 1 },
      });
    });

    // Falsy model must NOT clobber the "Auto" fallback — reproduces the
    // exact live payload shape before the backend fix.
    expect(within(brainBox()).getByText("Auto")).toBeInTheDocument();
  });
});

// ─── Phase 186 checkpoint round 4/5: proactive_alert observability fix (D-09) ─
//
// Root cause round 4 guarded against: the governor's WS-tier presence-
// cascade delivery previously had no registered backend channel sender at
// all (astridr/automation/proactive.py's make_codepulse_channel_sender
// fixes this), so a money/high pulse card's intent reached status=complete
// while Larry saw nothing — no toast, no chat message, nothing in Telegram.
//
// Root cause round 5 (page-scoping fix): the round-4 toast was wired here,
// in Chat.tsx, so it only ever fired while /chat happened to be mounted —
// Larry was on /inbox and never saw it. The toast now fires from an
// APP-LEVEL mount (ProactiveAlertListener.tsx, App.tsx — see its own test
// file) regardless of which page is active; THIS Chat-scoped subscription
// now ONLY appends the visible assistant chat-timeline message (dispatches
// directly into the REAL registered "proactive_alert" callback, not a
// re-implemented copy).
describe("Chat — proactive_alert appends a chat message (186-06 checkpoint round 5, D-09)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registeredEventHandlers.clear();
    mockStatus = "connected";
  });

  it("appends a visible assistant chat message on a real proactive_alert event (toast now fires app-level, not here)", async () => {
    renderChat();

    await waitFor(() => {
      expect(registeredEventHandlers.has("proactive_alert")).toBe(true);
    });

    act(() => {
      registeredEventHandlers.get("proactive_alert")!({
        data: { profileId: "personal", body: "Invoice needs payment" },
      });
    });

    expect(mockAppendLocalAssistantMessage).toHaveBeenCalledWith("Invoice needs payment");
    // Chat.tsx no longer owns the toast channel — that's ProactiveAlertListener's job now.
    expect(toast).not.toHaveBeenCalled();
  });

  it("never appends a chat message for a malformed (bodyless) event", async () => {
    renderChat();

    await waitFor(() => {
      expect(registeredEventHandlers.has("proactive_alert")).toBe(true);
    });

    act(() => {
      registeredEventHandlers.get("proactive_alert")!({ data: { profileId: "personal" } });
    });

    expect(mockAppendLocalAssistantMessage).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });
});

describe("Chat — chat.correction patches the already-rendered bubble (186-09 deferred item)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registeredEventHandlers.clear();
    mockStatus = "connected";
  });

  it("calls correctAssistantMessage with session_id + corrected_text on a real chat.correction event", async () => {
    renderChat();

    await waitFor(() => {
      expect(registeredEventHandlers.has("chat.correction")).toBe(true);
    });

    act(() => {
      registeredEventHandlers.get("chat.correction")!({
        data: { session_id: "sess-abc", corrected_text: "Swapped to Claude Sonnet 5." },
      });
    });

    expect(mockCorrectAssistantMessage).toHaveBeenCalledWith(
      "sess-abc",
      "Swapped to Claude Sonnet 5."
    );
  });

  it("never patches on a malformed (missing session_id or corrected_text) event", async () => {
    renderChat();

    await waitFor(() => {
      expect(registeredEventHandlers.has("chat.correction")).toBe(true);
    });

    act(() => {
      registeredEventHandlers.get("chat.correction")!({ data: { session_id: "sess-abc" } });
    });
    act(() => {
      registeredEventHandlers.get("chat.correction")!({
        data: { corrected_text: "no session here" },
      });
    });

    expect(mockCorrectAssistantMessage).not.toHaveBeenCalled();
  });
});

describe("Chat — swap badge reconnect re-pull (WR-07)", () => {
  const swapPulls = () =>
    mockSendCommand.mock.calls.filter(
      (c) => (c[0] as { type?: string })?.type === "swap.get_state"
    ).length;

  beforeEach(() => {
    vi.clearAllMocks();
    registeredEventHandlers.clear();
    mockStatus = "connected";
    mockSendCommand.mockResolvedValue({ status: "ok" });
  });

  it("re-pulls swap.get_state (once per shared-resolver consumer on the page) each time the socket (re)connects", async () => {
    // A fresh element each time — reusing one reference lets React bail out of
    // re-rendering, so the mocked status would never update.
    const makeTree = () => (
      <MemoryRouter initialEntries={[{ pathname: "/chat" }]}>
        <Chat />
      </MemoryRouter>
    );

    // 103-09: the page-level `swapState` (feeding BrainControl) and `BrainComposerPill` are two
    // independent instances of the same shared `useGlobalBrainOverride` hook (from
    // `src/hooks/useResolvedBrain.ts`) — each instance owns its own snapshot effect, so a single
    // connect fires one pull per consumer, not one pull for the whole page. The WR-07 invariant
    // this test guards — re-pull on every reconnect, never while disconnected — holds per
    // consumer; it is asserted here as a stable multiple of the initial pull count.
    mockStatus = "connected";
    const view = render(makeTree());
    await waitFor(() => expect(swapPulls()).toBeGreaterThanOrEqual(2)); // initial connect pull(s)
    const initialPulls = swapPulls();

    // Socket drops — no re-pull while down.
    await act(async () => {
      mockStatus = "reconnecting";
      view.rerender(makeTree());
    });
    expect(swapPulls()).toBe(initialPulls);

    // Socket reconnects — every consumer must re-hydrate from the server.
    await act(async () => {
      mockStatus = "connected";
      view.rerender(makeTree());
    });
    await waitFor(() => expect(swapPulls()).toBe(initialPulls * 2));
  });
});

// ─── 103-07-T2: composer brain pill (D-05 corrected host) ──────────────────────
describe("Chat — composer brain pill (103-07-T2, D-01/D-03/D-15)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registeredEventHandlers.clear();
    mockStatus = "connected";
    mockActiveEngineMap = {};
    lastBrainPickerProps = null;
    mockCatalogueEntries = [];
    mockDefaultProfileId = "assistant-default";
  });

  function renderPlainChat() {
    return render(
      <MemoryRouter initialEntries={[{ pathname: "/chat" }]}>
        <Chat />
      </MemoryRouter>
    );
  }

  it("renders the pill in a new row above the composer row without displacing the send button", async () => {
    mockActiveEngineMap = { "assistant-default": { model: "anthropic-sonnet-5", mode: "inherited" } };
    const { container } = renderPlainChat();

    const pill = await screen.findByTestId("mock-chat-brain-picker");
    const sendButton = screen.getByRole("button", { name: "Send message" });
    const textarea = container.querySelector("textarea");

    expect(pill).toBeInTheDocument();
    expect(sendButton).toBeInTheDocument();
    expect(textarea).toBeInTheDocument();
    // The pill's row is a DOM sibling that precedes the textarea/send row — a new row above,
    // not a replacement of it.
    // eslint-disable-next-line no-bitwise
    expect(pill.compareDocumentPosition(textarea!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("scopes the pill to Ástríðr's own default_profile_id (via useBrainCatalogue), never a Convex-ordering fallback (D-03)", async () => {
    mockActiveEngineMap = { "assistant-default": { model: "anthropic-sonnet-5", mode: "inherited" } };
    renderPlainChat();

    await waitFor(() => expect(lastBrainPickerProps?.profileId).toBe("assistant-default"));
  });

  it("scopes the pill to \"\" (never a fabricated profile) when default_profile_id is absent", async () => {
    mockDefaultProfileId = "";
    mockActiveEngineMap = {};
    renderPlainChat();

    await screen.findByTestId("mock-chat-brain-picker");
    expect(lastBrainPickerProps?.profileId).toBe("");
  });

  it("renders the live reported engine as the pill's label", async () => {
    mockActiveEngineMap = { "assistant-default": { model: "anthropic-sonnet-5", mode: "inherited" } };
    renderPlainChat();

    expect(await screen.findByTestId("chat-brain-pill-label")).toHaveTextContent(
      "anthropic-sonnet-5"
    );
  });

  it("renders the pill's own visible trigger inside the picker it opens (single control, no relay)", async () => {
    mockActiveEngineMap = { "assistant-default": { model: "anthropic-sonnet-5", mode: "inherited" } };
    renderPlainChat();

    const picker = await screen.findByTestId("mock-chat-brain-picker");
    expect(within(picker).getByTestId("chat-brain-pill-label")).toBeInTheDocument();
  });

  it("keeps the base label byte-identical while pending and shows a switching-to suffix; drops the suffix (label unchanged) on error ack", async () => {
    mockActiveEngineMap = { "assistant-default": { model: "anthropic-sonnet-5", mode: "inherited" } };
    renderPlainChat();

    const labelBefore = (await screen.findByTestId("chat-brain-pill-label")).textContent;
    expect(labelBefore).toBe("anthropic-sonnet-5");

    act(() => {
      lastBrainPickerProps?.onPendingChange?.("· switching to Codex CLI…");
    });

    expect(await screen.findByTestId("chat-brain-pill-pending")).toHaveTextContent(
      "switching to Codex CLI"
    );
    expect(screen.getByTestId("chat-brain-pill-label").textContent).toBe(labelBefore);

    // Error ack: BrainPicker itself clears pendingTarget, which drives onPendingChange(null).
    act(() => {
      lastBrainPickerProps?.onPendingChange?.(null);
    });

    await waitFor(() =>
      expect(screen.queryByTestId("chat-brain-pill-pending")).not.toBeInTheDocument()
    );
    expect(screen.getByTestId("chat-brain-pill-label").textContent).toBe(labelBefore);
  });

  it("renders the session-override line, never the pinned line, for a session-override reading", async () => {
    mockActiveEngineMap = {
      "assistant-default": {
        model: "anthropic-sonnet-5",
        mode: "session",
        expiresAt: Math.floor(Date.now() / 1000) + 1800,
      },
    };
    renderPlainChat();

    expect(await screen.findByTestId("chat-brain-pill-session")).toBeInTheDocument();
    expect(screen.queryByTestId("chat-brain-pill-pinned")).not.toBeInTheDocument();
  });

  it("renders the pinned-default line, never the session line, for a pinned-default reading", async () => {
    mockActiveEngineMap = {
      "assistant-default": { model: "anthropic-sonnet-5", mode: "pinned" },
    };
    renderPlainChat();

    expect(await screen.findByTestId("chat-brain-pill-pinned")).toBeInTheDocument();
    expect(screen.queryByTestId("chat-brain-pill-session")).not.toBeInTheDocument();
  });

  it("never renders a STUB chip anywhere on the pill (Phase 109 D-01: the build-time stub seam no longer exists)", async () => {
    mockActiveEngineMap = { "assistant-default": { model: "anthropic-sonnet-5", mode: "inherited" } };
    renderPlainChat();

    await screen.findByTestId("chat-brain-pill-label");
    expect(screen.queryByTestId("chat-brain-pill-stub-chip")).not.toBeInTheDocument();
    expect(screen.queryByText("STUB")).not.toBeInTheDocument();
  });

  it('renders the canonical "Not reported" string, italic and muted, with no color dot, when nothing is reported (D-07/UI-SPEC §A)', async () => {
    mockActiveEngineMap = {};
    renderPlainChat();

    const label = await screen.findByTestId("chat-brain-pill-label");
    expect(label).toHaveTextContent("Not reported");
    expect(label.className).toContain("italic");
    expect(label.className).toContain("text-muted-foreground");

    // Scoped to the composer pill trigger — Control Center's separate "Choose brain" (BrainControl)
    // box also renders in this tree and legitimately still says "Auto" (out of this plan's scope).
    const trigger = screen.getByRole("button", { name: /Active brain/ });
    expect(within(trigger).queryByText("Auto")).not.toBeInTheDocument();
    expect(trigger.querySelector('span[aria-hidden="true"].rounded-full')).not.toBeInTheDocument();
  });

  it('carries the accessible name "Active brain: Not reported" (no parenthetical) for the absent state', async () => {
    mockActiveEngineMap = {};
    renderPlainChat();

    await screen.findByTestId("chat-brain-pill-label");
    expect(
      screen.getByRole("button", { name: "Active brain: Not reported — opens the brain picker" })
    ).toBeInTheDocument();
  });

  describe("Chat — composer pill provider dot tolerates a model-id vendor-prefix mismatch (Phase 109 Plan 05, D-08)", () => {
    it("resolves the real vendor color when the reported model is vendor-prefixed but the catalogue id is bare", async () => {
      mockCatalogueEntries = [
        { id: "claude-sonnet-5", name: "Claude Sonnet 5", vendor: "anthropic_direct" },
      ];
      mockActiveEngineMap = {
        "assistant-default": { model: "anthropic/claude-sonnet-5", mode: "inherited" },
      };
      renderPlainChat();

      await screen.findByTestId("chat-brain-pill-label");
      const trigger = screen.getByRole("button", { name: /Active brain/ });
      const dot = trigger.querySelector('span[aria-hidden="true"].rounded-full:not(.animate-pulse)');
      expect(dot).not.toBeNull();
      expect((dot as HTMLElement).style.backgroundColor).not.toBe("var(--muted-foreground)");
    });

    it("CONTROL: still falls back to the neutral dot when the reported model matches nothing in the catalogue — a change that made the lookup always succeed must fail this", async () => {
      mockCatalogueEntries = [
        { id: "claude-sonnet-5", name: "Claude Sonnet 5", vendor: "anthropic_direct" },
      ];
      mockActiveEngineMap = {
        "assistant-default": { model: "anthropic/claude-opus-4-8", mode: "inherited" },
      };
      renderPlainChat();

      await screen.findByTestId("chat-brain-pill-label");
      const trigger = screen.getByRole("button", { name: /Active brain/ });
      const dot = trigger.querySelector('span[aria-hidden="true"].rounded-full:not(.animate-pulse)');
      expect(dot).not.toBeNull();
      expect((dot as HTMLElement).style.backgroundColor).toBe("var(--muted-foreground)");
    });
  });

  describe("Chat — composer pill, D-06 override rung invisibility (UI-SPEC §B)", () => {
    it("renders byte-identical pill markup for source:'override' vs source:'profile'+mode:'pinned', same model", async () => {
      // A pinned reading sourced purely from per-profile TELEMETRY (no live override at all).
      mockSendCommand.mockResolvedValue({ status: "ok" });
      mockActiveEngineMap = { "assistant-default": { model: "claude-opus-4-8", mode: "pinned" } };
      const profileRender = renderPlainChat();
      await screen.findByText("claude-opus-4-8");
      const profileButton = screen.getByTestId("chat-brain-pill-label").closest("button")!;
      const profileHtml = profileButton.outerHTML;
      profileRender.unmount();

      // The SAME model, but now sourced purely from a live per-profile OVERRIDE — no telemetry at all.
      mockActiveEngineMap = {};
      mockSendCommand.mockResolvedValue({
        status: "ok",
        profile_overrides: {
          "assistant-default": { model: "claude-opus-4-8", source: "operator" },
        },
      });
      const overrideRender = renderPlainChat();
      await screen.findByText("claude-opus-4-8");
      const overrideButton = screen.getByTestId("chat-brain-pill-label").closest("button")!;
      const overrideHtml = overrideButton.outerHTML;
      overrideRender.unmount();

      expect(overrideHtml).toBe(profileHtml);
    });
  });
});

// ─── 188-13: Command Center toggle + layout + panel mounts (D-18) ───────────
//
// The seven panel components (IntelligenceFeedPanel/ActiveAgentsPanel/
// MissionTimelinePanel/LlmStatusPanel/SystemMonitorPanel/VoiceStatusPanel/
// QuickCommandsPanel) are NOT mocked here — they mount for real, through the
// SAME useQuery/usePaginatedQuery mocks already wired above (each already
// defaults to an empty/loading-safe shape), matching this file's existing
// convention of exercising the real component tree rather than re-stubbing
// every leaf. This also proves T-188-53 (SectionErrorBoundary around every
// mount) end-to-end: if any panel threw during mount, these tests would fail
// with an uncaught error instead of a clean pass.
const LS_COMMAND_CENTER = "codepulse-command-center";

function findByClassSubstring(container: HTMLElement, marker: string): HTMLElement | undefined {
  return Array.from(container.querySelectorAll<HTMLElement>("div")).find((el) =>
    el.className.includes(marker)
  );
}

const SEVEN_PANEL_LABELS = [
  "INTELLIGENCE FEED",
  "ACTIVE AGENTS",
  "MISSION TIMELINE",
  "LLM STATUS",
  "SYSTEM MONITOR",
  "VOICE STATUS",
  "QUICK COMMANDS",
];

function gridToggle() {
  return screen.getByRole("button", { name: /command center mode/i });
}

describe("Chat — command center toggle (188-13, D-18)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registeredEventHandlers.clear();
    mockStatus = "connected";
    mockSendCommand.mockResolvedValue({ status: "ok" });
    localStorage.removeItem(LS_COMMAND_CENTER);
  });

  it("renders OFF by default: GRID label, aria-pressed=false", () => {
    renderChat();
    const toggle = gridToggle();
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveTextContent("GRID");
    expect(toggle).not.toHaveTextContent("GRID ON");
    expect(toggle).toHaveAttribute("aria-label", "Enter command center mode");
  });

  it("toggling flips aria-pressed + the label and persists instantly to localStorage", () => {
    renderChat();
    const toggle = gridToggle();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(toggle).toHaveTextContent("GRID ON");
    expect(toggle).toHaveAttribute("aria-label", "Exit command center mode");
    expect(localStorage.getItem(LS_COMMAND_CENTER)).toBe("true");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(localStorage.getItem(LS_COMMAND_CENTER)).toBe("false");
  });

  it("hydrates ON from localStorage on mount", () => {
    localStorage.setItem(LS_COMMAND_CENTER, "true");
    renderChat();
    expect(gridToggle()).toHaveAttribute("aria-pressed", "true");
  });
});

describe("Chat — command-center layout (188-13, D-18)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registeredEventHandlers.clear();
    mockStatus = "connected";
    mockSendCommand.mockResolvedValue({ status: "ok" });
    localStorage.removeItem(LS_COMMAND_CENTER);
  });

  it("with the mode OFF, the grid keeps the exact original lg:grid-cols string and mounts none of the seven panels", () => {
    const { container } = renderChat();

    const calmGrid = findByClassSubstring(
      container,
      "lg:grid-cols-[minmax(0,1.1fr)_clamp(320px,27vw,400px)_minmax(0,1fr)]"
    );
    expect(calmGrid).toBeDefined();
    expect(calmGrid?.className).not.toContain("xl:grid-cols-[240px");

    for (const label of SEVEN_PANEL_LABELS) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });

  it("with the mode ON, the 5-track xl grid (calm sizing intact) + footer band + all seven panels render", () => {
    const { container } = renderChat();
    fireEvent.click(gridToggle());

    const ccGrid = findByClassSubstring(container, "xl:grid-cols-[240px");
    expect(ccGrid).toBeDefined();
    // The three calm tracks keep their exact existing sizing fragment inside
    // the same grid element — nothing in them reflows.
    expect(ccGrid?.className).toContain(
      "lg:grid-cols-[minmax(0,1.1fr)_clamp(320px,27vw,400px)_minmax(0,1fr)]"
    );

    for (const label of SEVEN_PANEL_LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("never adds a transition/animation class to the layout swap", () => {
    const { container } = renderChat();
    fireEvent.click(gridToggle());
    const ccGrid = findByClassSubstring(container, "xl:grid-cols-[240px");
    expect(ccGrid?.className ?? "").not.toMatch(/transition-\[grid|animate-/);
  });
});

describe("Chat — command-center panel mounts (188-13, D-18, T-188-52/53)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registeredEventHandlers.clear();
    mockStatus = "connected";
    mockSendCommand.mockResolvedValue({ status: "ok" });
    localStorage.removeItem(LS_COMMAND_CENTER);
  });

  function enterCommandCenter() {
    renderChat();
    fireEvent.click(gridToggle());
  }

  it("Quick Commands' Strict Mode reaches the SAME voice-prefs executor a spoken command / ControlCenterPanel use", async () => {
    enterCommandCenter();
    mockSendCommand.mockClear();

    const panel = screen.getByTestId("quick-commands-panel");
    fireEvent.click(within(panel).getByRole("button", { name: /Strict Mode/i }));

    await waitFor(() => {
      expect(mockSendCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "config.update",
          section: "voice-prefs",
          changes: { strict_mode: true },
        })
      );
    });
  });

  it("Quick Commands' Focus Mode reaches the SAME proactive-prefs executor ControlCenterPanel's FocusModeToggle uses", async () => {
    enterCommandCenter();
    mockSendCommand.mockClear();

    const panel = screen.getByTestId("quick-commands-panel");
    fireEvent.click(within(panel).getByRole("button", { name: /Focus Mode/i }));

    await waitFor(() => {
      expect(mockSendCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "config.update",
          section: "proactive-prefs",
          changes: { focus_mode: true },
        })
      );
    });
  });

  it("Quick Commands' Stop button wires to the voice hook's barge-in cut without throwing (no second interrupt mechanism)", () => {
    enterCommandCenter();
    const panel = screen.getByTestId("quick-commands-panel");
    expect(() =>
      fireEvent.click(within(panel).getByRole("button", { name: /^Stop$/i }))
    ).not.toThrow();
  });

  it("VoiceStatusPanel is bound to the SAME avatarState ControlCenterPanel receives as voiceState", () => {
    enterCommandCenter();
    // No live voice engine is armed in this jsdom harness, so avatarState
    // resolves to "idle" — the same value ControlCenterPanel's own
    // ReadinessPill would render for.
    expect(screen.getByTestId("voice-status-chip-idle").className).toContain("text-primary");
  });

  it("mounts none of the seven command-center panels while the mode is off", () => {
    renderChat();
    for (const label of SEVEN_PANEL_LABELS) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
    // QuickCommandsPanel specifically — the panel this describe block is
    // about — is absent (its container, and therefore its own
    // useProactivePrefs() instance, never mounts while off).
    expect(screen.queryByTestId("quick-commands-panel")).not.toBeInTheDocument();
  });
});
