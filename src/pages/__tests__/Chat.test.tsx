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

function injectApprovalBlock(requestId: string, extra: Record<string, unknown> = {}) {
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
          ...extra,
        },
      ],
    });
  });
}

/** D-05: inject a resolution block — same requestId, updated status. */
function injectResolutionBlock(requestId: string, status: "approved" | "rejected" | "expired") {
  injectApprovalBlock(requestId, { status });
}

/** Inject a non-approval block (e.g. markdown) to verify it's never update-matched. */
function injectMarkdownBlock(content: string) {
  const cb = getRunBlocksCallback();
  if (!cb) throw new Error("run.blocks subscription not found");
  act(() => {
    cb({
      session_id: "sess-1",
      blocks: [
        {
          type: "markdown",
          content,
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
    // The page also sends config.get (strict-mode hydration) on mount — assert
    // on the approval call specifically, not calls[0].
    const call = mockSendCommand.mock.calls.find(
      (c) => (c[0] as { type?: string })?.type === "approval.respond"
    )![0];
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
    const call = mockSendCommand.mock.calls.find(
      (c) => (c[0] as { type?: string })?.type === "approval.respond"
    )![0];
    expect(call).not.toHaveProperty("requestId");
    expect(call).not.toHaveProperty("approved");
  });

  test("shows toast.error, no success toast, and keeps the block pending when sendCommand rejects (real contract)", async () => {
    // The REAL context rejects on error acks/timeouts/queue-full — it never
    // resolves { status: "error" }. Reject the APPROVAL send specifically:
    // the page also sends config.get on mount, which must not eat a
    // rejected-once. Mount-time calls resolve ok.
    mockSendCommand.mockImplementation((cmd: { type?: string }) =>
      cmd?.type === "approval.respond"
        ? Promise.reject(new Error("bad"))
        : Promise.resolve({ status: "ok" })
    );
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

// ─── D-05: run.blocks update-by-requestId merge ────────────────────────────────

describe("Chat — run.blocks update-by-requestId merge (D-05)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscribeEvent.mockImplementation(() => () => {});
    mockSendCommand.mockResolvedValue({ status: "ok" });
  });

  test("(a) a resolution block with a matching requestId flips the card in place — no second card", async () => {
    renderChat();
    injectApprovalBlock("req-A");
    expect(screen.getByText("shell_exec")).toBeInTheDocument();

    injectResolutionBlock("req-A", "approved");

    expect(screen.getAllByText("Approved — sent to Ástríðr")).toHaveLength(1);
    expect(screen.queryByText("shell_exec")).toBeNull();
    expect(screen.queryByText("Approve")).toBeNull();
  });

  test("(b) an unknown requestId still appends as a new card — two distinct cards render", async () => {
    renderChat();
    injectApprovalBlock("req-A");
    injectApprovalBlock("req-B");

    expect(screen.getAllByText("Approve")).toHaveLength(2);
    expect(screen.getAllByText("shell_exec")).toHaveLength(2);
  });

  test("(c) a non-approval block never update-matches — approval card untouched, markdown renders", async () => {
    renderChat();
    injectApprovalBlock("req-A");

    injectMarkdownBlock("Some markdown content");

    expect(screen.getByText("Approve")).toBeInTheDocument();
    expect(screen.getByText("Some markdown content")).toBeInTheDocument();
  });
});
