/**
 * Chat approval payload + ack-handling regression test.
 *
 * Encodes the server-correct approval.respond contract
 * ({ request_id_target, decision }, not { requestId, approved }) AND the
 * REAL AstridrWSContext.sendCommand failure contract: the live context never
 * resolves a non-ok ack — it REJECTS the promise (error ack / timeout /
 * queue-full). A rejected send must surface toast.error, show no success
 * toast, and leave the ApprovalBlock pending (no false "Approved" state).
 *
 * Phase 96, Plan 03: F6 (payload fix) + D-11 (shared approval component).
 * CR-01 review fix: failure path exercises rejection, the shape the real
 * context emits, instead of an unreachable resolved error ack.
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

/** Capture the run.blocks subscription callback so tests can inject an approval block. */
function getRunBlocksCallback(): ((event: Record<string, unknown>) => void) | null {
  for (const call of mockSubscribeEvent.mock.calls as unknown as [
    string,
    (event: Record<string, unknown>) => void,
  ][]) {
    if (call[0] === "run.blocks") return call[1];
  }
  return null;
}

function injectApprovalBlock(requestId: string) {
  const cb = getRunBlocksCallback();
  if (!cb) throw new Error("run.blocks subscription not found");
  act(() => {
    cb({
      session_id: "sess-1",
      blocks: [
        {
          type: "approval",
          requestId,
          action: "shell_exec",
          details: { command: "rm -rf /tmp/x" },
          riskLevel: "high",
          agentName: "Ástríðr",
        },
      ],
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

  test("shows toast.error, no success toast, and keeps the block pending when sendCommand rejects (real contract)", async () => {
    // The REAL context rejects on error acks/timeouts/queue-full — it never
    // resolves { status: "error" }.
    mockSendCommand.mockRejectedValueOnce(new Error("bad"));
    renderChat();
    injectApprovalBlock("req-3");

    await act(async () => {
      fireEvent.click(screen.getByText("Approve"));
    });

    expect(toast.error).toHaveBeenCalledWith("bad");
    expect(toast.success).not.toHaveBeenCalled();
    // The block must NOT falsely flip to "Approved" — it stays actionable.
    expect(screen.getByText("Approve")).toBeInTheDocument();
    expect(screen.queryByText("Approved — sent to Ástríðr")).toBeNull();
  });

  test("shows toast.success and collapses the block when ack.status is ok", async () => {
    mockSendCommand.mockResolvedValueOnce({ status: "ok" });
    renderChat();
    injectApprovalBlock("req-4");

    await act(async () => {
      fireEvent.click(screen.getByText("Approve"));
    });

    expect(toast.success).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.getByText("Approved — sent to Ástríðr")).toBeInTheDocument();
  });
});
