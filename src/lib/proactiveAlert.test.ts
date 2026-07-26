import { describe, it, expect, vi } from "vitest";
import {
  renderProactiveAlert,
  extractProactiveAlertBody,
  extractProactiveAlertPriority,
  PRIORITY_TOAST_STYLE,
  PROACTIVE_ALERT_TOAST_DURATION_MS,
} from "./proactiveAlert";

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

// ─── extractProactiveAlertBody (Phase 186 checkpoint round 5 page-scoping fix) ─
//
// The shared validation helper both ProactiveAlertListener.tsx (app-level
// toast) and Chat.tsx (chat-timeline append) now use independently, so the
// "malformed body is ignored" rule lives in exactly one place.

describe("extractProactiveAlertBody", () => {
  it("returns the trimmed body for a well-formed event", () => {
    expect(extractProactiveAlertBody({ body: "  Invoice needs payment  " })).toBe(
      "Invoice needs payment"
    );
  });

  it("returns null for a missing body", () => {
    expect(extractProactiveAlertBody({})).toBeNull();
  });

  it("returns null for a whitespace-only body", () => {
    expect(extractProactiveAlertBody({ body: "   " })).toBeNull();
  });

  it("returns null for a non-string body", () => {
    expect(extractProactiveAlertBody({ body: 42 as unknown as string })).toBeNull();
  });
});

// ─── extractProactiveAlertPriority + PRIORITY_TOAST_STYLE (checkpoint round 5 nit) ─
//
// "add some color... a bit more noticeable" -- money/high get a design-token
// left-border tint (never a hardcoded hex); normal/low get no special style.

describe("extractProactiveAlertPriority", () => {
  it.each(["money", "high", "normal", "low"] as const)(
    "returns %s unchanged for a valid priority",
    (priority) => {
      expect(extractProactiveAlertPriority({ priority })).toBe(priority);
    }
  );

  it("returns null for a missing priority", () => {
    expect(extractProactiveAlertPriority({})).toBeNull();
  });

  it("returns null for an out-of-enum priority (never trusted as-is)", () => {
    expect(extractProactiveAlertPriority({ priority: "URGENT!!!" })).toBeNull();
  });

  it("returns null for a non-string priority", () => {
    expect(extractProactiveAlertPriority({ priority: 1 as unknown as string })).toBeNull();
  });
});

describe("PRIORITY_TOAST_STYLE", () => {
  it("money uses the --status-warn design token, never a hardcoded hex", () => {
    const visual = PRIORITY_TOAST_STYLE.money;
    expect(visual).not.toBeNull();
    expect(visual!.borderColorVar).toBe("--status-warn");
    expect(visual!.style.borderLeft).toContain("var(--status-warn)");
    expect(visual!.style.borderLeft).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it("high uses the --status-info design token, never a hardcoded hex", () => {
    const visual = PRIORITY_TOAST_STYLE.high;
    expect(visual).not.toBeNull();
    expect(visual!.borderColorVar).toBe("--status-info");
    expect(visual!.style.borderLeft).toContain("var(--status-info)");
    expect(visual!.style.borderLeft).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it("normal and low have no special styling (sonner default)", () => {
    expect(PRIORITY_TOAST_STYLE.normal).toBeNull();
    expect(PRIORITY_TOAST_STYLE.low).toBeNull();
  });
});
