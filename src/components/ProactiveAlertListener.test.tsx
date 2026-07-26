/**
 * ProactiveAlertListener.test.tsx — Phase 186 checkpoint round 5 (D-09
 * page-scoping fix).
 *
 * Dispatches directly into the REAL registered "proactive_alert" callback
 * (not a re-implemented copy) via a mocked useAstridrWS().subscribeEvent,
 * mirroring Chat.test.tsx's own precedent for this exact WS mock shape.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { ProactiveAlertListener } from "./ProactiveAlertListener";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const registeredHandlers = new Map<string, (event: Record<string, unknown>) => void>();

vi.mock("@/contexts/AstridrWSContext", () => ({
  useAstridrWS: () => ({
    subscribeEvent: vi.fn((eventType: string, cb: (event: Record<string, unknown>) => void) => {
      registeredHandlers.set(eventType, cb);
      return () => registeredHandlers.delete(eventType);
    }),
  }),
}));

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));
vi.mock("sonner", () => ({
  toast: toastMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
  registeredHandlers.clear();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ProactiveAlertListener", () => {
  it("renders nothing (headless)", () => {
    const { container } = render(<ProactiveAlertListener />);
    expect(container.firstChild).toBeNull();
  });

  it("fires a toast on a real proactive_alert event, regardless of which page mounted it", () => {
    render(<ProactiveAlertListener />);
    expect(registeredHandlers.has("proactive_alert")).toBe(true);

    act(() => {
      registeredHandlers.get("proactive_alert")!({
        data: { profileId: "personal", body: "Invoice needs payment" },
      });
    });

    expect(toastMock).toHaveBeenCalledWith(
      "Invoice needs payment",
      expect.objectContaining({ duration: expect.any(Number) })
    );
  });

  it("never toasts for a malformed (bodyless) event", () => {
    render(<ProactiveAlertListener />);

    act(() => {
      registeredHandlers.get("proactive_alert")!({ data: { profileId: "personal" } });
    });

    expect(toastMock).not.toHaveBeenCalled();
  });

  it("unsubscribes on unmount", () => {
    const { unmount } = render(<ProactiveAlertListener />);
    expect(registeredHandlers.has("proactive_alert")).toBe(true);
    unmount();
    expect(registeredHandlers.has("proactive_alert")).toBe(false);
  });

  // ── Checkpoint round 5 cosmetic nit: priority-tinted toast ────────────────

  it("styles a money-priority toast with the --status-warn left border + an icon", () => {
    render(<ProactiveAlertListener />);

    act(() => {
      registeredHandlers.get("proactive_alert")!({
        data: { profileId: "personal", body: "Invoice needs payment", priority: "money" },
      });
    });

    const [, options] = toastMock.mock.calls[0];
    expect(options.style.borderLeft).toContain("var(--status-warn)");
    expect(options.icon).toBeTruthy();
  });

  it("styles a high-priority toast with the --status-info left border + an icon", () => {
    render(<ProactiveAlertListener />);

    act(() => {
      registeredHandlers.get("proactive_alert")!({
        data: { profileId: "personal", body: "Board meeting starting", priority: "high" },
      });
    });

    const [, options] = toastMock.mock.calls[0];
    expect(options.style.borderLeft).toContain("var(--status-info)");
    expect(options.icon).toBeTruthy();
  });

  it("applies no special style/icon for normal priority (plain sonner default)", () => {
    render(<ProactiveAlertListener />);

    act(() => {
      registeredHandlers.get("proactive_alert")!({
        data: { profileId: "personal", body: "FYI meeting reminder", priority: "normal" },
      });
    });

    const [, options] = toastMock.mock.calls[0];
    expect(options.style).toBeUndefined();
    expect(options.icon).toBeUndefined();
  });

  it("applies no special style/icon when priority is missing entirely (backward compatible)", () => {
    render(<ProactiveAlertListener />);

    act(() => {
      registeredHandlers.get("proactive_alert")!({
        data: { profileId: "personal", body: "No priority field" },
      });
    });

    const [, options] = toastMock.mock.calls[0];
    expect(options.style).toBeUndefined();
    expect(options.icon).toBeUndefined();
  });

  it("applies no special style/icon for an out-of-enum priority value", () => {
    render(<ProactiveAlertListener />);

    act(() => {
      registeredHandlers.get("proactive_alert")!({
        data: { profileId: "personal", body: "Weird value", priority: "URGENT!!!" },
      });
    });

    const [, options] = toastMock.mock.calls[0];
    expect(options.style).toBeUndefined();
    expect(options.icon).toBeUndefined();
  });
});
