import { describe, it, expect, vi } from "vitest";
import { renderProactiveAlert, PROACTIVE_ALERT_TOAST_DURATION_MS } from "./proactiveAlert";

function makeCallbacks() {
  return {
    toast: vi.fn(),
    appendLocalAssistantMessage: vi.fn(),
  };
}

describe("renderProactiveAlert (Phase 186 checkpoint round 4, D-09 observability fix)", () => {
  it("fires BOTH a toast and a chat-timeline append with the same body", () => {
    const callbacks = makeCallbacks();
    renderProactiveAlert(callbacks, { profileId: "personal", body: "Invoice needs payment" });

    expect(callbacks.toast).toHaveBeenCalledWith("Invoice needs payment");
    expect(callbacks.appendLocalAssistantMessage).toHaveBeenCalledWith("Invoice needs payment");
  });

  it("trims whitespace before rendering", () => {
    const callbacks = makeCallbacks();
    renderProactiveAlert(callbacks, { body: "  Board meeting starting  " });

    expect(callbacks.toast).toHaveBeenCalledWith("Board meeting starting");
    expect(callbacks.appendLocalAssistantMessage).toHaveBeenCalledWith("Board meeting starting");
  });

  it("silently ignores a missing body -- never a blank toast or empty chat bubble", () => {
    const callbacks = makeCallbacks();
    renderProactiveAlert(callbacks, {});

    expect(callbacks.toast).not.toHaveBeenCalled();
    expect(callbacks.appendLocalAssistantMessage).not.toHaveBeenCalled();
  });

  it("silently ignores a whitespace-only body", () => {
    const callbacks = makeCallbacks();
    renderProactiveAlert(callbacks, { body: "   " });

    expect(callbacks.toast).not.toHaveBeenCalled();
    expect(callbacks.appendLocalAssistantMessage).not.toHaveBeenCalled();
  });

  it("silently ignores a non-string body (malformed event)", () => {
    const callbacks = makeCallbacks();
    renderProactiveAlert(callbacks, { body: 42 as unknown as string });

    expect(callbacks.toast).not.toHaveBeenCalled();
    expect(callbacks.appendLocalAssistantMessage).not.toHaveBeenCalled();
  });

  it("exports a sensible auto-dismiss duration matching the FocusExitDigest precedent", () => {
    expect(PROACTIVE_ALERT_TOAST_DURATION_MS).toBe(7000);
  });
});
