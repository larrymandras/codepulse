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
// mock factory below is not memoized), `handlers` captures the real
// `subscribeEvent("estop_state", ...)` callback SignalHorizon registers, and
// `topicHandlers` captures every `subscribe(topic, ...)` registration the
// plan 125-08 packet spawner makes — one Set per topic, mirroring
// AstridrWSContext.tsx's own real fan-out shape (:441-449) closely enough
// that pushing through it exercises the SAME multi-subscriber-per-topic and
// unknown-type-fans-out-to-all paths the real context does.
const h = vi.hoisted(() => ({
  status: "connected" as WSStatus,
  handlers: new Map<string, FrameCallback>(),
  topicHandlers: new Map<string, Set<FrameCallback>>(),
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
      subscribe: (topic: string, cb: FrameCallback) => {
        if (!h.topicHandlers.has(topic)) h.topicHandlers.set(topic, new Set());
        h.topicHandlers.get(topic)!.add(cb);
        return () => {
          h.topicHandlers.get(topic)?.delete(cb);
        };
      },
      sendCommand: vi.fn(),
      reconnect: vi.fn(),
    }),
  };
});

beforeEach(() => {
  vi.useFakeTimers();
  h.status = "connected";
  h.handlers.clear();
  h.topicHandlers.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.theme;
});

// ─── Test helpers ───────────────────────────────────────────────────────────

function renderHorizon(alertLevel: AlertLevel = "none") {
  const utils = render(<SignalHorizon alertLevel={alertLevel} />);
  const getState = () =>
    utils.container.querySelector(".signal-horizon")?.getAttribute("data-horizon-state");
  const getPackets = () => utils.container.querySelectorAll(".signal-horizon .packet");
  return { ...utils, getState, getPackets };
}

/** Pushes a raw payload through the captured estop_state subscriber, inside act(). */
function push(payload: unknown) {
  const cb = h.handlers.get("estop_state");
  if (!cb) throw new Error("no estop_state subscriber registered — did the component mount?");
  act(() => {
    cb(payload as Record<string, unknown>);
  });
}

/**
 * Delivers `payload` to the subscribers of ONE topic — mirrors a real
 * event_type that maps to exactly one topic (AstridrWSContext.tsx:328-336).
 * A no-op (not a throw) when nothing is registered on that topic, since "no
 * subscribers" is the CORRECT state under D-04's motion gate — the whole
 * point of cases (d) below.
 */
function pushTopic(topic: string, payload: unknown) {
  const subs = h.topicHandlers.get(topic);
  if (!subs) return;
  act(() => {
    for (const cb of subs) cb(payload as Record<string, unknown>);
  });
}

/**
 * Delivers the SAME payload object to EVERY topic's subscribers — mirrors
 * AstridrWSContext.tsx's unknown-event-type fan-out-to-all branch
 * (:337-342), which is what a message whose event_type is absent from
 * TOPIC_EVENT_MAP actually receives in production.
 */
function pushUnknownToAllTopics(payload: unknown) {
  act(() => {
    for (const [, subs] of h.topicHandlers) {
      for (const cb of subs) cb(payload as Record<string, unknown>);
    }
  });
}

function stubMatchMedia(reduced: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: reduced && query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
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

// ─── Event packets (SIGNAL-01, plan 125-08) ─────────────────────────────────

describe("SignalHorizon — event packets", () => {
  it("(a) COALESCING: 5 events within 900ms produce exactly ONE packet; the removed-after-700ms control proves cleanup works, then a further event past the 1s gate produces a fresh packet", () => {
    stubMatchMedia(false);
    const { getPackets } = renderHorizon();

    for (let i = 0; i < 5; i++) {
      pushTopic("executions", { event_type: "command_execution", id: i });
    }
    expect(getPackets().length).toBe(1);

    act(() => {
      vi.advanceTimersByTime(1001);
    });
    // The first packet's own 700ms removal timer has already fired by t=1001
    // -- zero packets here is the CONTROL proving removal actually works,
    // not that spawning silently stopped.
    expect(getPackets().length).toBe(0);

    pushTopic("executions", { event_type: "command_execution", id: 99 });
    expect(getPackets().length).toBe(1);
  });

  it("(b) HUE: an Ástríðr-family event colours the packet var(--astridr); a machine event colours it var(--primary) -- asserted on the packet's own inline style, not a class name", () => {
    stubMatchMedia(false);
    const { getPackets } = renderHorizon();

    pushTopic("live-runs", { event_type: "run.tool_call" });
    let packets = getPackets();
    expect(packets.length).toBe(1);
    expect((packets[0] as HTMLElement).style.getPropertyValue("--pk")).toBe("var(--astridr)");

    act(() => {
      vi.advanceTimersByTime(1001);
    });
    pushTopic("executions", { event_type: "command_execution" });
    packets = getPackets();
    expect(packets.length).toBe(1);
    expect((packets[0] as HTMLElement).style.getPropertyValue("--pk")).toBe("var(--primary)");
  });

  it("(c) UNKNOWN TYPE: an unrecognised event_type still produces exactly ONE packet, coloured var(--primary), even though the context's unknown-branch fans it out to all five topic subscribers -- the production-faithful behavioural proof (same synchronous tick, matching AstridrWSContext.tsx's real fan-out loop)", () => {
    stubMatchMedia(false);
    const { getPackets } = renderHorizon();

    expect(h.topicHandlers.size).toBe(5); // sanity: every TOPIC_EVENT_MAP key subscribed
    pushUnknownToAllTopics({ event_type: "some_future_event_type_not_in_the_map" });

    const packets = getPackets();
    expect(packets.length).toBe(1);
    expect((packets[0] as HTMLElement).style.getPropertyValue("--pk")).toBe("var(--primary)");
  });

  // (c, mechanism-isolated) Case (c) above is confounded with the D-07
  // drop-gate: all five topic deliveries land in the SAME synchronous tick
  // (matching production, where one wire message's fan-out is entirely
  // synchronous inside ws.onmessage — AstridrWSContext.tsx:322-343), so
  // Date.now() is identical across all five calls and the 1s gate alone
  // would already collapse them to one packet even WITHOUT identity dedup.
  // This test breaks that confound deliberately: the SAME message object is
  // redelivered with the drop-gate cleared (>1000ms) between each delivery,
  // so a passing gate check on every single call means the ONLY thing that
  // can still prevent 5 packets is the WeakSet recognising it is the same
  // object every time. Verified live (below): removing the WeakSet check
  // turns this test RED with 5 packets while (c) above stays green,
  // confirming (c) alone does not discriminate the mechanism — this test
  // does.
  it("(c, mechanism-isolated) IDENTITY DEDUP: the SAME message object redelivered with the drop-gate cleared between each delivery still results in only ONE packet ever CREATED -- spies on the host's own appendChild rather than final DOM state, since every packet auto-removes after 700ms regardless of how many were created", () => {
    stubMatchMedia(false);
    const { container } = renderHorizon();
    const host = container.querySelector(".signal-horizon") as HTMLElement;
    const appendSpy = vi.spyOn(host, "appendChild");

    const topics = Array.from(h.topicHandlers.keys());
    expect(topics.length).toBe(5);

    const sameMsg = { event_type: "some_future_event_type_not_in_the_map" };
    for (const topic of topics) {
      pushTopic(topic, sameMsg);
      act(() => {
        vi.advanceTimersByTime(1001);
      });
    }

    const packetAppends = appendSpy.mock.calls.filter(([node]) =>
      (node as HTMLElement).classList?.contains("packet")
    ).length;
    expect(packetAppends).toBe(1);
  });

  it("(d) MOTION SUPPRESSION: under reduced-motion, the component registers NO topic subscriptions at all, and pushing events produces ZERO packets -- with the non-reduced case as the control", () => {
    stubMatchMedia(true);
    const { getPackets } = renderHorizon();
    expect(h.topicHandlers.size).toBe(0);
    for (let i = 0; i < 5; i++) {
      pushTopic("executions", { event_type: "command_execution", id: i });
    }
    expect(getPackets().length).toBe(0);
  });

  it("(d control) MOTION ALLOWED: with reduced-motion NOT set, the same push produces a packet -- proves (d) is the gate, not a component that never spawns", () => {
    stubMatchMedia(false);
    const { getPackets } = renderHorizon();
    expect(h.topicHandlers.size).toBe(5);
    pushTopic("executions", { event_type: "command_execution" });
    expect(getPackets().length).toBe(1);
  });

  it("(d) READABLE THEME: with data-theme=readable, the component registers NO topic subscriptions and pushing events produces ZERO packets", () => {
    stubMatchMedia(false);
    document.documentElement.dataset.theme = "readable";
    const { getPackets } = renderHorizon();
    expect(h.topicHandlers.size).toBe(0);
    for (let i = 0; i < 5; i++) {
      pushTopic("executions", { event_type: "command_execution", id: i });
    }
    expect(getPackets().length).toBe(0);
  });

  it("(e) ESTOP_STATE SPAWNS NOTHING: a valid estop_state frame changes data-horizon-state, and even delivered through the SAME unknown-type fan-out a real wire message would take (estop_state is absent from TOPIC_EVENT_MAP), it creates no packet -- the explicit exclusion", () => {
    stubMatchMedia(false);
    const { getState, getPackets } = renderHorizon();
    const frame = armedFrame();
    // One real wire message reaches BOTH mechanisms in production
    // (AstridrWSContext.tsx's single ws.onmessage fans out to the
    // event-level subscriber AND, since estop_state has no topic, every
    // topic-level subscriber too) -- deliver it through both mocked paths
    // to reproduce that faithfully.
    push(frame);
    pushUnknownToAllTopics(frame);
    expect(getState()).toBe("critical");
    expect(getPackets().length).toBe(0);
  });

  it("(f) CLEANUP: unmounting with a packet outstanding leaves no pending timer -- vi.getTimerCount() returns to zero, and advancing time afterward touches nothing", () => {
    stubMatchMedia(false);
    const { unmount, getPackets } = renderHorizon();

    pushTopic("executions", { event_type: "command_execution" });
    expect(getPackets().length).toBe(1);
    expect(vi.getTimerCount()).toBeGreaterThan(0); // the packet's own 700ms removal timer, plus the connect-scoped snapshot timeout

    unmount();
    // Every timer this component owned -- the packet removal timer AND the
    // snapshot/dawn timers from the state machine above -- is cleared on
    // unmount; nothing pending means nothing CAN fire against a detached
    // node.
    expect(vi.getTimerCount()).toBe(0);

    expect(() => {
      act(() => {
        vi.advanceTimersByTime(10000);
      });
    }).not.toThrow();
  });
});
