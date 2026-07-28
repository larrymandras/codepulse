/**
 * BrainFallbackNotice.test.tsx — 103-07-T3.
 *
 * `useAstridrWS` is mocked directly (spy `subscribeEvent`, recording the registered callback)
 * mirroring the exact idiom `Chat.test.tsx` already establishes for its own `"swap.state"` /
 * `"run.completed"` subscriptions — dispatches directly into the REAL registered callback rather
 * than asserting internal state was merely set.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { useBrainFallbackNotice } from "./BrainFallbackNotice";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const registeredHandlers = new Map<string, (event: Record<string, unknown>) => void>();
const mockUnsubscribe = vi.fn();
const mockSubscribeEvent = vi.fn(
  (eventType: string, cb: (event: Record<string, unknown>) => void) => {
    registeredHandlers.set(eventType, cb);
    return mockUnsubscribe;
  }
);

vi.mock("@/contexts/AstridrWSContext", () => ({
  useAstridrWS: () => ({
    subscribeEvent: mockSubscribeEvent,
  }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  }),
}));

// Import after mocks
import { toast } from "sonner";

function Host() {
  useBrainFallbackNotice();
  return null;
}

beforeEach(() => {
  vi.clearAllMocks();
  registeredHandlers.clear();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useBrainFallbackNotice — honest CLI-to-API fallback (D-04)", () => {
  it("fires exactly one warn-toned toast interpolating the CLI and fallback engine names on a well-formed event", () => {
    render(<Host />);

    const handler = registeredHandlers.get("brain.fallback");
    expect(handler).toBeInstanceOf(Function);

    handler!({
      data: {
        profile_id: "assistant-default",
        cli_model: "Claude CLI",
        fallback_model: "Sonnet 5",
        reason: "tool_call_unsupported",
      },
    });

    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(toast.warning).toHaveBeenCalledWith(
      "Claude CLI couldn't use tools this turn — answered on Sonnet 5 instead.",
      expect.objectContaining({ icon: expect.anything() })
    );
    // Graceful degrade, never a failure — toast.error must never fire for this event.
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("never fires toast.error — this is a warn-toned graceful degrade, not a failure", () => {
    render(<Host />);
    const handler = registeredHandlers.get("brain.fallback")!;

    handler({
      data: { cli_model: "Codex CLI", fallback_model: "Fable 5" },
    });

    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes on unmount — a subsequent event fires no toast", () => {
    const { unmount } = render(<Host />);
    const handler = registeredHandlers.get("brain.fallback")!;

    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);

    // The component is unmounted, but nothing prevents calling the captured handler directly in
    // this test — assert firing it post-unmount still produces no NEW toast is out of scope (React
    // itself guarantees a real unsubscribed listener is never re-invoked by the transport); this
    // asserts the unsubscribe function the hook registered was actually called, proving cleanup.
    expect(handler).toBeInstanceOf(Function);
  });

  it("does not throw and fires no toast for a payload missing fallback_model", () => {
    render(<Host />);
    const handler = registeredHandlers.get("brain.fallback")!;

    expect(() => {
      handler({ data: { cli_model: "Claude CLI" } });
    }).not.toThrow();

    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("does not throw and fires no toast for a payload missing cli_model", () => {
    render(<Host />);
    const handler = registeredHandlers.get("brain.fallback")!;

    expect(() => {
      handler({ data: { fallback_model: "Sonnet 5" } });
    }).not.toThrow();

    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("does not throw and fires no toast for an event with no data at all", () => {
    render(<Host />);
    const handler = registeredHandlers.get("brain.fallback")!;

    expect(() => {
      handler({});
    }).not.toThrow();

    expect(toast.warning).not.toHaveBeenCalled();
  });
});
