/**
 * AstridrWSContext.test.tsx — provider test harness (188.4-02 Task 1, Wave 0).
 *
 * This file did not exist before this task. Confirmed live 2026-08-10:
 * repo-wide greps for `MockWebSocket`, `global.WebSocket` and `window.WebSocket`
 * returned zero matches — there was no WebSocket mock precedent anywhere in
 * this codebase. Pattern follows `GlobalSwapContext.test.tsx`'s shape: render
 * the provider wrapping a small real consumer component that calls the
 * provider's own hook.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { useEffect } from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AstridrWSProvider, useAstridrWS } from "./AstridrWSContext";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── InertWebSocket ──────────────────────────────────────────────────────────
//
// This stub exists ONLY to stop AstridrWSProvider's connect() from dialling a
// real ws://localhost:8181/ws/telemetry endpoint under jsdom. It accepts the
// real WebSocket constructor's (url, protocols) signature and exposes the
// fields the provider reads (readyState, onopen/onmessage/onclose/onerror,
// send, close) — but it NEVER calls onopen, NEVER calls onmessage, and NEVER
// delivers a frame.
//
// Both D-07/D-08-style injectors added in this plan's later tasks
// deliberately bypass onmessage entirely — the foreign-session injector
// (Task 3) replicates the provider's own fan-out block directly against
// eventSubsRef, not through this stub. So NOTHING in this suite tests the
// socket itself; a future reader must not mistake this stub for
// message-delivery infrastructure.
class InertWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState = InertWebSocket.CONNECTING;
  url: string;
  protocols?: string | string[];
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocols = protocols;
  }

  send(_data: string) {
    /* inert — never actually sends */
  }

  close() {
    this.readyState = InertWebSocket.CLOSED;
  }
}

// ─── Reusable consumer ───────────────────────────────────────────────────────
// Mirrors GlobalSwapContext.test.tsx's Opener component: a small real
// consumer that calls the provider's public hook. Exposes registered
// unsubscribe closures (proof of real subscribeEvent registration) and the
// raw events two topics receive, for Task 3's SIGNAL/CONTROL fixtures.

type ReceivedEvent = Record<string, unknown>;

function RunBlocksConsumer({
  received,
  otherReceived,
  unsubs,
}: {
  received: ReceivedEvent[];
  otherReceived: ReceivedEvent[];
  unsubs: Array<() => void>;
}) {
  const { subscribeEvent } = useAstridrWS();
  useEffect(() => {
    const unsubBlocks = subscribeEvent("run.blocks", (event) => {
      received.push(event);
    });
    // Different event type — Task 3's CONTROL fixture proves the fan-out is
    // keyed the way the real one is, rather than broadcasting to everything.
    const unsubOther = subscribeEvent("run.text", (event) => {
      otherReceived.push(event);
    });
    unsubs.push(unsubBlocks, unsubOther);
    return () => {
      unsubBlocks();
      unsubOther();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribeEvent]);
  return null;
}

function renderProviderWithConsumer() {
  const received: ReceivedEvent[] = [];
  const otherReceived: ReceivedEvent[] = [];
  const unsubs: Array<() => void> = [];
  const utils = render(
    <AstridrWSProvider>
      <RunBlocksConsumer received={received} otherReceived={otherReceived} unsubs={unsubs} />
    </AstridrWSProvider>
  );
  // Flush the mount-time connect() delay (:369 `setTimeout(() => connect(), 50)`,
  // added to survive React StrictMode double-mount) so connect() actually runs
  // against the stubbed WebSocket, exercising the real mount->connect->unmount
  // lifecycle rather than skipping it.
  act(() => {
    vi.advanceTimersByTime(50);
  });
  return { ...utils, received, otherReceived, unsubs };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", InertWebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("AstridrWSContext.test.tsx — provider test harness (188.4-02 Task 1, Wave 0)", () => {
  it("SMOKE: AstridrWSProvider mounts, subscribeEvent registers real unsubscribe closures, and unmount leaves no pending timer or unhandled rejection", () => {
    const { unmount, unsubs } = renderProviderWithConsumer();

    // Registration proof: subscribeEvent's real contract (:432-443) returns an
    // unsubscribe closure per call; two subscriptions were made.
    expect(unsubs).toHaveLength(2);
    expect(unsubs.every((fn) => typeof fn === "function")).toBe(true);

    // No pending timer immediately after the mount-time connect() has run —
    // proves connect() itself did not leak a retry/stability timer against
    // the inert socket (it never calls onopen/onclose, so neither
    // moduleStableTimer nor moduleRetryTimer/scheduleRetry ever fires).
    expect(vi.getTimerCount()).toBe(0);

    act(() => {
      unmount();
    });

    // Unmount's cleanup (:370-388) clears the connect timer, closes wsRef +
    // moduleSocket, and never itself schedules a new timer — so the process
    // does not hang on a leaked reconnect timer. (An unhandled rejection
    // would independently fail this vitest run; none is reported.)
    expect(vi.getTimerCount()).toBe(0);
  });
});

// ─── useAstridrWS — provider boundary (mirrors GlobalSwapContext's own check) ─

describe("useAstridrWS — provider boundary", () => {
  it("throws when called outside an AstridrWSProvider", () => {
    function Bare() {
      useAstridrWS();
      return null;
    }
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Bare />)).toThrow("useAstridrWS must be used within AstridrWSProvider");
    spy.mockRestore();
  });
});

// ─── __astridrInjectForeignSessionBlocks — D-08 (188.4-02 Task 3) ────────────
// The debug-gated property is attached via a local `window as unknown as
// {...}` cast at its own call site (AstridrWSContext.tsx), not a
// `declare global` augmentation — test files need the identical cast.
function debugWindow(): {
  __astridrInjectForeignSessionBlocks?: (sessionId?: string, text?: string) => void;
} {
  return window as unknown as {
    __astridrInjectForeignSessionBlocks?: (sessionId?: string, text?: string) => void;
  };
}

describe("__astridrInjectForeignSessionBlocks — foreign-session injector on the real event bus (188.4-02 Task 3, D-08)", () => {
  it("PRESENCE: window.__astridrInjectForeignSessionBlocks is a function once the provider renders", () => {
    const { unmount } = renderProviderWithConsumer();
    expect(typeof debugWindow().__astridrInjectForeignSessionBlocks).toBe("function");
    act(() => {
      unmount();
    });
  });

  it("ABSENCE: window.__astridrInjectForeignSessionBlocks is undefined after the provider unmounts", () => {
    const { unmount } = renderProviderWithConsumer();
    expect(typeof debugWindow().__astridrInjectForeignSessionBlocks).toBe("function");
    act(() => {
      unmount();
    });
    expect(debugWindow().__astridrInjectForeignSessionBlocks).toBeUndefined();
  });

  it("STRUCTURAL: the effect attaching __astridrInjectForeignSessionBlocks opens with the VOICE_DEBUG_ENABLED + typeof-window guard", () => {
    const source = readFileSync(path.resolve(__dirname, "./AstridrWSContext.tsx"), "utf-8");
    const anchor = "w.__astridrInjectForeignSessionBlocks = (";
    const idx = source.indexOf(anchor);
    expect(idx).toBeGreaterThan(-1);
    const preceding = source.slice(Math.max(0, idx - 300), idx);
    expect(preceding).toContain('if (!VOICE_DEBUG_ENABLED || typeof window === "undefined") return;');
  });

  it("SIGNAL: a subscriber registered for run.blocks receives the synthetic frame, with the foreign session_id intact and the blocks array present", () => {
    const { received } = renderProviderWithConsumer();
    act(() => {
      debugWindow().__astridrInjectForeignSessionBlocks?.();
    });
    expect(received).toHaveLength(1);
    const frame = received[0] as {
      event_type?: string;
      data?: { session_id?: string; blocks?: unknown[] };
    };
    expect(frame.event_type).toBe("run.blocks");
    // Default synthetic session id — deliberately foreign, per D-08.
    expect(frame.data?.session_id).toBe("debug-foreign-session-9x7q2");
    expect(frame.data?.blocks).toBeDefined();
    expect(frame.data?.blocks?.length).toBeGreaterThan(0);
  });

  it("CONTROL: a subscriber registered for a DIFFERENT event type (run.text) receives nothing — proves the fan-out is keyed the way the real one is, not broadcasting to everything", () => {
    const { received, otherReceived } = renderProviderWithConsumer();
    act(() => {
      debugWindow().__astridrInjectForeignSessionBlocks?.();
    });
    expect(received).toHaveLength(1);
    expect(otherReceived).toHaveLength(0);
  });
});
