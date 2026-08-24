/**
 * SignalHorizon.test.tsx — SIGNAL-01 (Phase 125-04, Task 3).
 *
 * Proves the fail-closed contract for the four Unknown-entry conditions no
 * operator can trigger by hand — delayed snapshot, never-arriving snapshot,
 * malformed payload, reconnect — plus the armed/dawn/alert-overlay
 * transitions, against a mocked `useAstridrWS()` that lets the test push
 * synthetic `estop_state` frames and flip `status` between renders.
 *
 * Mocking strategy follows ForceGraphCanvas.test.tsx's `vi.hoisted` +
 * `vi.mock` props/callback-capture idiom (mock the module a component
 * imports, not the provider itself) — deliberately different from
 * AstridrWSContext.test.tsx, which renders the REAL provider against a
 * stubbed WebSocket to test the provider's own fan-out. This file tests
 * SignalHorizon as a *consumer* of `useAstridrWS()`, so it mocks the hook
 * directly: fake timers drive both the 15s connect-scoped snapshot timeout
 * and the 2600ms dawn ease without a real WebSocket in the loop at all.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, type RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";
import SignalHorizon, { resolveHorizonState, type AlertLevel, type HorizonInput } from "./SignalHorizon";

type WSStatus = "connected" | "reconnecting" | "disconnected";
type FrameCallback = (event: Record<string, unknown>) => void;

// ─── Mock @/contexts/AstridrWSContext ──────────────────────────────────────
// `h` is the vi.hoisted handle: `status` is read fresh on every render (the
// mock factory below is not memoized), and `handlers` captures the real
// `subscribeEvent("estop_state", ...)` callback SignalHorizon registers, so
// the test can push frames directly into it.
const h = vi.hoisted(() => ({
  status: "connected" as WSStatus,
  handlers: new Map<string, FrameCallback>(),
}));

vi.mock("@/contexts/AstridrWSContext", async (importOriginal) => {
  // TOPIC_EVENT_MAP is re-exported from the REAL module (not hand-copied)
  // so this mock cannot silently drift from the live topic list — plan
  // 125-08's `Object.keys(TOPIC_EVENT_MAP)` iterates whatever this returns.
  const actual = await importOriginal<typeof import("@/contexts/AstridrWSContext")>();
  return {
    TOPIC_EVENT_MAP: actual.TOPIC_EVENT_MAP,
    useAstridrWS: () => ({
      status: h.status,
      subscribeEvent: (eventType: string, cb: FrameCallback) => {
        h.handlers.set(eventType, cb);
        return () => {
          h.handlers.delete(eventType);
        };
      },
      subscribe: vi.fn(() => () => {}),
      sendCommand: vi.fn(),
      reconnect: vi.fn(),
    }),
  };
});

beforeEach(() => {
  vi.useFakeTimers();
  h.status = "connected";
  h.handlers.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── Test helpers ───────────────────────────────────────────────────────────

function renderHorizon(alertLevel: AlertLevel = "none") {
  const utils = render(<SignalHorizon alertLevel={alertLevel} />);
  const getState = () =>
    utils.container.querySelector(".signal-horizon")?.getAttribute("data-horizon-state");
  return { ...utils, getState };
}

/** Pushes a raw payload through the captured estop_state subscriber, inside act(). */
function push(payload: unknown) {
  const cb = h.handlers.get("estop_state");
  if (!cb) throw new Error("no estop_state subscriber registered — did the component mount?");
  act(() => {
    cb(payload as Record<string, unknown>);
  });
}

/** Flips the mocked wsStatus and forces a re-render so the component reads it. */
function setStatus(
  status: WSStatus,
  rerender: RenderResult["rerender"],
  alertLevel: AlertLevel = "none"
) {
  h.status = status;
  act(() => {
    rerender(<SignalHorizon alertLevel={alertLevel} /> as ReactElement);
  });
}

function armedFrame() {
  return { event_type: "estop_state", data: { armed: true, reason: "manual", initiator: "operator" } };
}
function disarmedFrame() {
  return { event_type: "estop_state", data: { armed: false, reason: "manual", initiator: "operator" } };
}

// ─── Component behaviour ────────────────────────────────────────────────────

describe("SignalHorizon — fail-closed state machine", () => {
  it("(a) MOUNT: before any frame, state is unknown — named explicitly, not inferred from an absence of resting", () => {
    const { getState } = renderHorizon();
    expect(getState()).toBe("unknown");
  });

  it("(b) DELAYED SNAPSHOT: connected with no frame for 14s stays unknown; a valid disarmed frame at 14s reaches resting — proves the timeout did not fire early", () => {
    const { getState } = renderHorizon();
    act(() => {
      vi.advanceTimersByTime(14000);
    });
    expect(getState()).toBe("unknown");
    push(disarmedFrame());
    expect(getState()).toBe("resting");
  });

  it("(c) MISSING SNAPSHOT: connected, no frame ever, past 15s stays unknown, and a further 5 minutes stays unknown — never resting", () => {
    const { getState } = renderHorizon();
    act(() => {
      vi.advanceTimersByTime(15001);
    });
    expect(getState()).toBe("unknown");
    act(() => {
      vi.advanceTimersByTime(5 * 60 * 1000);
    });
    expect(getState()).toBe("unknown");
  });

  it("(d) MALFORMED SNAPSHOT: after a valid disarmed frame reaches resting, each of four malformed shapes lands in unknown, and none of the pushes throw", () => {
    const { getState } = renderHorizon();
    push(disarmedFrame());
    expect(getState()).toBe("resting");

    const malformedShapes = [
      { event_type: "estop_state" },
      { event_type: "estop_state", data: null },
      { event_type: "estop_state", data: { armed: "true" } },
      { event_type: "estop_state", data: {} },
    ];
    for (const bad of malformedShapes) {
      expect(() => push(bad)).not.toThrow();
      expect(getState()).toBe("unknown");
    }
  });

  it("(e) ARMED: a valid { armed: true } frame yields critical", () => {
    const { getState } = renderHorizon();
    push(armedFrame());
    expect(getState()).toBe("critical");
  });

  it("(f) RECONNECT: from critical, disconnecting drives offline, and reconnecting lands on unknown IMMEDIATELY (not critical resumed from memory), staying unknown until a fresh frame arrives", () => {
    const { getState, rerender } = renderHorizon();
    push(armedFrame());
    expect(getState()).toBe("critical");

    setStatus("disconnected", rerender);
    expect(getState()).toBe("offline");

    setStatus("connected", rerender);
    expect(getState()).toBe("unknown");
    act(() => {
      vi.advanceTimersByTime(60000);
    });
    expect(getState()).toBe("unknown");

    // Recovery: a fresh frame on the new connection is honoured normally.
    push(disarmedFrame());
    expect(getState()).toBe("resting");
  });

  it("(g) DAWN: armed -> disarmed enters dawn, holds through 2599ms, and reaches resting just past 2600ms — the amber phase is asserted as ENTERED", () => {
    const { getState } = renderHorizon();
    push(armedFrame());
    expect(getState()).toBe("critical");
    push(disarmedFrame());
    expect(getState()).toBe("dawn");
    act(() => {
      vi.advanceTimersByTime(2599);
    });
    expect(getState()).toBe("dawn");
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(getState()).toBe("resting");
  });

  it("(h) NO SPURIOUS DAWN: a disarmed frame arriving when the machine was never armed goes straight to resting, never through dawn", () => {
    const { getState } = renderHorizon();
    push(disarmedFrame());
    expect(getState()).toBe("resting");
  });

  it("(i) ALERT OVERLAY: alertLevel warn with a valid disarmed snapshot yields warn; alertLevel unknown with the same snapshot yields resting (loading alert counts do not block the aurora)", () => {
    const warnRender = renderHorizon("warn");
    push(disarmedFrame());
    expect(warnRender.getState()).toBe("warn");

    h.handlers.clear();
    const unknownRender = renderHorizon("unknown");
    push(disarmedFrame());
    expect(unknownRender.getState()).toBe("resting");
  });

  it("(j) ARMED OUTRANKS ALERTS: alertLevel none with an armed snapshot yields critical", () => {
    const { getState } = renderHorizon("none");
    push(armedFrame());
    expect(getState()).toBe("critical");
  });
});

// ─── resolveHorizonState — direct priority-order coverage ──────────────────
// Localises a regression in ordering to this pure function rather than
// surfacing only through the component.

describe("resolveHorizonState — priority order", () => {
  const base: HorizonInput = {
    wsStatus: "connected",
    snapshot: { armed: false },
    dawnUntil: null,
    alertLevel: "none",
    now: 1_000_000,
  };

  it("rule 1: disconnected outranks everything, even an armed snapshot and a critical alert overlay", () => {
    expect(
      resolveHorizonState({
        ...base,
        wsStatus: "disconnected",
        snapshot: { armed: true },
        alertLevel: "critical",
      })
    ).toBe("offline");
  });

  it("rule 2: a null snapshot yields unknown even while connected", () => {
    expect(resolveHorizonState({ ...base, snapshot: null })).toBe("unknown");
  });

  it("rule 2: reconnecting with a null snapshot also yields unknown, not offline", () => {
    expect(resolveHorizonState({ ...base, wsStatus: "reconnecting", snapshot: null })).toBe("unknown");
  });

  it("rule 3: an armed snapshot outranks a warn alert overlay", () => {
    expect(resolveHorizonState({ ...base, snapshot: { armed: true }, alertLevel: "warn" })).toBe(
      "critical"
    );
  });

  it("rule 4: alertLevel critical wins over a disarmed snapshot", () => {
    expect(resolveHorizonState({ ...base, alertLevel: "critical" })).toBe("critical");
  });

  it("rule 4: alertLevel warn wins over a disarmed snapshot with no dawn in flight", () => {
    expect(resolveHorizonState({ ...base, alertLevel: "warn" })).toBe("warn");
  });

  it("rule 5: dawn holds only while now < dawnUntil, and only once alert overlay is clear", () => {
    expect(resolveHorizonState({ ...base, dawnUntil: base.now + 1, alertLevel: "none" })).toBe("dawn");
    expect(resolveHorizonState({ ...base, dawnUntil: base.now - 1, alertLevel: "none" })).toBe("resting");
  });

  it("rule 4 outranks rule 5: an alert overlay wins over an in-flight dawn", () => {
    expect(
      resolveHorizonState({ ...base, dawnUntil: base.now + 1, alertLevel: "warn" })
    ).toBe("warn");
  });

  it("rule 6: the fully-cleared case reaches resting", () => {
    expect(resolveHorizonState(base)).toBe("resting");
  });
});
