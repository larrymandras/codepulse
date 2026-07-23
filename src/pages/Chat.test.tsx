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
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockSendMessage = vi.fn().mockResolvedValue(true);
const mockRecordSkillLaunch = vi.fn().mockResolvedValue(undefined);

/** Mutable status the mocked useAstridrChat() reads on each call. */
let mockStatus: "connected" | "reconnecting" | "disconnected" = "connected";

vi.mock("@/contexts/AstridrWSContext", () => ({
  useAstridrWS: () => ({
    status: mockStatus,
    sendCommand: vi.fn().mockResolvedValue({ status: "ok" }),
    subscribeEvent: vi.fn(() => () => {}),
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
    appendLocalAssistantMessage: vi.fn(),
    handleApprove: vi.fn(),
    handleReject: vi.fn(),
    registerScreenShare: vi.fn(),
    activeSessionRef: { current: null },
    streamingReplyRef: { current: "" },
  }),
}));

vi.mock("convex/react", () => ({
  useMutation: vi.fn(() => mockRecordSkillLaunch),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
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
