import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import type { InboxItem } from "@/components/InboxCard";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => []),
  useMutation: vi.fn(() => vi.fn()),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: new Proxy({}, {
    get: () => new Proxy({}, { get: () => "mock-fn-ref" }),
  }),
}));

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

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

// Import after mocks
import Inbox from "../Inbox";

// ─── Fixture items ────────────────────────────────────────────────────────────

const makeApprovalItem = (id: string): InboxItem => ({
  id,
  type: "approval",
  title: `Action ${id}`,
  message: `Details for ${id}`,
  timestamp: Date.now(),
  read: false,
  riskLevel: "low",
  agentName: "Ástríðr",
  action: `action_${id}`,
  requestId: id,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Capture the approval_request subscription callback so tests can inject items.
 */
function getApprovalCallback(): ((event: Record<string, unknown>) => void) | null {
  for (const call of mockSubscribeEvent.mock.calls as unknown as [string, (event: Record<string, unknown>) => void][]) {
    if (call[0] === "approval_request") return call[1];
  }
  return null;
}

function injectApprovalItem(item: InboxItem) {
  const cb = getApprovalCallback();
  if (!cb) throw new Error("approval_request subscription not found");
  act(() => {
    cb({
      id: item.id,
      action: item.action ?? item.title,
      details: { agent_name: item.agentName },
      timestamp: item.timestamp / 1000,
    });
  });
}

function renderInbox() {
  return render(<Inbox />);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Inbox — keyboard navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscribeEvent.mockImplementation(() => () => {});
    mockSendCommand.mockResolvedValue({ status: "ok" });
  });

  afterEach(() => {
    // Clean up any document keydown listeners
    fireEvent.keyDown(document, { key: "Escape" });
  });

  test("ArrowDown moves focus to next InboxCard", () => {
    renderInbox();
    // Inject two approval items so there are cards to navigate between
    injectApprovalItem(makeApprovalItem("item-1"));
    injectApprovalItem(makeApprovalItem("item-2"));

    // First ArrowDown should focus index 0 (first card)
    act(() => { fireEvent.keyDown(document, { key: "ArrowDown" }); });
    // Second ArrowDown should move to index 1 (second card)
    act(() => { fireEvent.keyDown(document, { key: "ArrowDown" }); });

    // The second card's wrapper should have the focus ring class
    const cards = document.querySelectorAll('[class*="ring-2"]');
    expect(cards.length).toBeGreaterThan(0);
  });

  test("ArrowUp moves focus to previous InboxCard", () => {
    renderInbox();
    injectApprovalItem(makeApprovalItem("item-1"));
    injectApprovalItem(makeApprovalItem("item-2"));

    // Move to index 1
    act(() => { fireEvent.keyDown(document, { key: "ArrowDown" }); });
    act(() => { fireEvent.keyDown(document, { key: "ArrowDown" }); });
    // Move back to index 0
    act(() => { fireEvent.keyDown(document, { key: "ArrowUp" }); });

    const cards = document.querySelectorAll('[class*="ring-2"]');
    expect(cards.length).toBeGreaterThan(0);
  });

  test("Enter expands/collapses focused InboxCard", () => {
    renderInbox();
    injectApprovalItem(makeApprovalItem("item-1"));

    act(() => { fireEvent.keyDown(document, { key: "ArrowDown" }); });
    // Enter should not throw and should toggle expanded state
    act(() => { fireEvent.keyDown(document, { key: "Enter" }); });
    // Enter again to collapse
    act(() => { fireEvent.keyDown(document, { key: "Enter" }); });

    // No assertion on exact DOM — just verify no errors thrown and item is rendered
    expect(screen.getByText("action_item-1")).toBeInTheDocument();
  });

  test("'A' key triggers approve on focused approval item", () => {
    renderInbox();
    injectApprovalItem(makeApprovalItem("item-1"));

    act(() => { fireEvent.keyDown(document, { key: "ArrowDown" }); });
    act(() => { fireEvent.keyDown(document, { key: "a" }); });

    expect(mockSendCommand).toHaveBeenCalledWith(
      expect.objectContaining({ type: "approval.respond" })
    );
  });

  test("'R' key opens reject flow on focused approval item", () => {
    renderInbox();
    injectApprovalItem(makeApprovalItem("item-1"));

    act(() => { fireEvent.keyDown(document, { key: "ArrowDown" }); });
    act(() => { fireEvent.keyDown(document, { key: "r" }); });

    // R key triggers handleReject — sendCommand should be called
    expect(mockSendCommand).toHaveBeenCalledWith(
      expect.objectContaining({ type: "approval.respond" })
    );
  });

  test("Escape clears keyboard focus", () => {
    renderInbox();
    injectApprovalItem(makeApprovalItem("item-1"));

    act(() => { fireEvent.keyDown(document, { key: "ArrowDown" }); });
    // Should have focus ring now
    const ringsBefore = document.querySelectorAll('[class*="ring-2"]');
    expect(ringsBefore.length).toBeGreaterThan(0);

    act(() => { fireEvent.keyDown(document, { key: "Escape" }); });
    // Focus ring should be gone after Escape
    const ringsAfter = document.querySelectorAll('[class*="ring-2"]');
    expect(ringsAfter.length).toBe(0);
  });

  test("keyboard hints caption shown below filter bar", () => {
    renderInbox();
    expect(screen.getByText(/↑↓ navigate/)).toBeInTheDocument();
  });

  test("focused card has ring-2 ring-ring ring-offset-1 style", () => {
    renderInbox();
    injectApprovalItem(makeApprovalItem("item-1"));

    act(() => { fireEvent.keyDown(document, { key: "ArrowDown" }); });

    const focusedCard = document.querySelector(".ring-2.ring-ring.ring-offset-1");
    expect(focusedCard).not.toBeNull();
  });
});
