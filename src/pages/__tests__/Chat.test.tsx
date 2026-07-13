/**
 * Chat approval payload + ack-handling regression test.
 *
 * Chat.tsx currently sends the WRONG approval.respond shape
 * ({ requestId, approved }) and never checks the sendCommand ack before
 * showing a success toast. This test encodes the server-correct contract
 * (Inbox.tsx's verified-correct shape): { request_id_target, decision } +
 * ack-checked toast.
 *
 * Phase 96, Plan 03: F6 (payload fix) + D-11 (shared approval component).
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockSendCommand = vi.fn().mockResolvedValue({ status: "ok" });
const mockSubscribeEvent = vi.fn(() => () => {});

vi.mock("@/contexts/AstridrWSContext", () => ({
  useAstridrWS: () => ({
    status: "connected",
    sendCommand: mockSendCommand,
    subscribeEvent: mockSubscribeEvent,
  }),
}));

vi.mock("@/hooks/useLiveFlash", () => ({
  useLiveFlash: () => ({ flashRef: { current: null }, triggerFlash: vi.fn() }),
}));

vi.mock("@/hooks/useTtsPlayback", () => ({
  useTtsPlayback: () => ({
    play: vi.fn(),
    stop: vi.fn(),
    isPlaying: false,
    analyser: null,
  }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

// Import after mocks
import Chat from "../Chat";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Capture the run.block subscription callback so tests can inject an approval block. */
function getRunBlockCallback(): ((event: Record<string, unknown>) => void) | null {
  for (const call of mockSubscribeEvent.mock.calls as unknown as [
    string,
    (event: Record<string, unknown>) => void,
  ][]) {
    if (call[0] === "run.block") return call[1];
  }
  return null;
}

function injectApprovalBlock(requestId: string) {
  const cb = getRunBlockCallback();
  if (!cb) throw new Error("run.block subscription not found");
  act(() => {
    cb({
      session_id: "sess-1",
      block: {
        type: "approval",
        requestId,
        action: "shell_exec",
        details: { command: "rm -rf /tmp/x" },
        riskLevel: "high",
        agentName: "Ástríðr",
      },
    });
  });
}

function renderChat() {
  return render(
    <MemoryRouter>
      <Chat />
    </MemoryRouter>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Chat — approval payload + ack handling (F6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscribeEvent.mockImplementation(() => () => {});
    mockSendCommand.mockResolvedValue({ status: "ok" });
  });

  test("Approve sends request_id_target + decision:approve, not requestId/approved", async () => {
    renderChat();
    injectApprovalBlock("req-1");

    await act(async () => {
      fireEvent.click(screen.getByText("Approve"));
    });

    expect(mockSendCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "approval.respond",
        request_id_target: "req-1",
        decision: "approve",
      })
    );
    const call = mockSendCommand.mock.calls[0][0];
    expect(call).not.toHaveProperty("requestId");
    expect(call).not.toHaveProperty("approved");
  });

  test("Reject sends decision:reject", async () => {
    renderChat();
    injectApprovalBlock("req-2");

    fireEvent.click(screen.getByText("Reject Request"));
    await act(async () => {
      fireEvent.click(screen.getByText("Submit Rejection"));
    });

    expect(mockSendCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "approval.respond",
        request_id_target: "req-2",
        decision: "reject",
      })
    );
    const call = mockSendCommand.mock.calls[0][0];
    expect(call).not.toHaveProperty("requestId");
    expect(call).not.toHaveProperty("approved");
  });

  test("shows toast.error and no success toast when ack.status is error", async () => {
    mockSendCommand.mockResolvedValueOnce({ status: "error", error: "bad" });
    renderChat();
    injectApprovalBlock("req-3");

    await act(async () => {
      fireEvent.click(screen.getByText("Approve"));
    });

    expect(toast.error).toHaveBeenCalledWith("bad");
    expect(toast.success).not.toHaveBeenCalled();
  });

  test("shows toast.success when ack.status is ok", async () => {
    mockSendCommand.mockResolvedValueOnce({ status: "ok" });
    renderChat();
    injectApprovalBlock("req-4");

    await act(async () => {
      fireEvent.click(screen.getByText("Approve"));
    });

    expect(toast.success).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
