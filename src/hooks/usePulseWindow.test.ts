/**
 * usePulseWindow.test.ts — SIGNAL-02 (Phase 125 Plan 09) reconciliation,
 * D-19 dedup and D-17 fill-window coverage for the Pulse ECG hero's data
 * feed.
 *
 * Mocks `convex/react`'s `useConvex` with a controllable fake client (a
 * queue of deferreds, one per call, so each connect/reconnect cycle can be
 * resolved or rejected independently) and `@/contexts/AstridrWSContext`
 * with a topic-subscription harness that can push frames and flip
 * `status` — same top-level `vi.mock` idiom as `useAstridrChat.test.ts`,
 * plus `ForceGraphCanvas.test.tsx`'s `vi.hoisted` pattern for the mutable
 * state the mock factories need to close over.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePulseWindow, dedupeLiveEvent, mergeBackfill } from "./usePulseWindow";

// ─── Shared mutable mock state ──────────────────────────────────────────────

const h = vi.hoisted(() => {
  const topicMap: Record<string, Set<string>> = {
    health: new Set(["health_check", "docker_status"]),
    "live-runs": new Set([
      "run.started",
      "run.tool_call",
      "run.blocks",
      "run.error",
      "chat.response",
    ]),
  };
  return {
    status: "connected" as "connected" | "reconnecting" | "disconnected",
    topicMap,
    subs: new Map<string, Set<(msg: Record<string, unknown>) => void>>(),
    orderLog: [] as string[],
    queryMock: vi.fn(),
    queryDeferreds: [] as {
      resolve: (v: unknown) => void;
      reject: (e: unknown) => void;
    }[],
    convexClient: { query: (..._a: unknown[]) => Promise.resolve() } as {
      query: (...a: unknown[]) => Promise<unknown>;
    },
  };
});
// Same referentially-stable object every render — the real Convex client
// context value doesn't change identity across renders, and usePulseWindow's
// connect-cycle effect depends on it, so a mock that returned a fresh object
// per call would spuriously re-fire that effect on every render.
h.convexClient = { query: h.queryMock };

h.queryMock.mockImplementation(() => {
  h.orderLog.push("query");
  return new Promise((resolve, reject) => {
    h.queryDeferreds.push({ resolve, reject });
  });
});

function mockSubscribe(topic: string, cb: (msg: Record<string, unknown>) => void) {
  h.orderLog.push(`subscribe:${topic}`);
  if (!h.subs.has(topic)) h.subs.set(topic, new Set());
  h.subs.get(topic)!.add(cb);
  return () => {
    h.subs.get(topic)?.delete(cb);
  };
}

vi.mock("convex/react", () => ({
  useConvex: () => h.convexClient,
}));

vi.mock("@/contexts/AstridrWSContext", () => ({
  get TOPIC_EVENT_MAP() {
    return h.topicMap;
  },
  useAstridrWS: () => ({ status: h.status, subscribe: mockSubscribe }),
}));

// Mirrors AstridrWSContext.tsx's own fan-out: deliver the SAME msg object to
// every topic whose set contains this event type, or to every subscriber
// (best-effort) if the type is unrecognised.
function emit(eventType: string, data: unknown, timestampSec: number) {
  const msg = { event_type: eventType, data, timestamp: timestampSec };
  let matched = false;
  for (const [topic, types] of Object.entries(h.topicMap)) {
    if (types.has(eventType)) {
      matched = true;
      for (const cb of h.subs.get(topic) ?? []) cb(msg);
    }
  }
  if (!matched) {
    for (const [, cbs] of h.subs) for (const cb of cbs) cb(msg);
  }
  return msg;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

const NOW_MS = 1_700_000_000_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW_MS);
  h.status = "connected";
  h.subs.clear();
  h.orderLog.length = 0;
  h.queryDeferreds.length = 0;
  h.queryMock.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── Pure functions ──────────────────────────────────────────────────────

describe("dedupeLiveEvent (pure)", () => {
  it("always counts non-run.blocks events, even identical ones repeated", () => {
    const seen = new Map<string, number>();
    expect(dedupeLiveEvent(seen, "run.tool_call", { round_num: 1, blocks: ["x"] }, 0)).toBe(true);
    expect(dedupeLiveEvent(seen, "run.tool_call", { round_num: 1, blocks: ["x"] }, 10)).toBe(true);
  });

  it("counts the first run.blocks delivery, then rejects an identical one inside the TTL", () => {
    const seen = new Map<string, number>();
    const data = { round_num: 3, blocks: ["a", "b"] };
    expect(dedupeLiveEvent(seen, "run.blocks", data, 1000)).toBe(true);
    expect(dedupeLiveEvent(seen, "run.blocks", { ...data }, 1050)).toBe(false);
  });

  it("re-admits the same run.blocks key once the TTL has elapsed", () => {
    const seen = new Map<string, number>();
    const data = { round_num: 3, blocks: ["a", "b"] };
    expect(dedupeLiveEvent(seen, "run.blocks", data, 1000)).toBe(true);
    expect(dedupeLiveEvent(seen, "run.blocks", { ...data }, 1000 + 2000)).toBe(true);
  });

  it("does not throw on a circular blocks payload, and still returns a boolean", () => {
    const seen = new Map<string, number>();
    const circular: Record<string, unknown> = { round_num: 9 };
    circular.blocks = circular;
    let outcome: boolean | undefined;
    expect(() => {
      outcome = dedupeLiveEvent(seen, "run.blocks", circular, 0);
    }).not.toThrow();
    expect(typeof outcome).toBe("boolean");
  });
});

describe("mergeBackfill (pure)", () => {
  it("drops a buffered row that exactly matches a backfill row's (eventType, timestamp)", () => {
    const backfill = [{ eventType: "docker_status", timestamp: 100.5 }];
    const buffered = [{ eventType: "docker_status", timestamp: 100.5 }];
    expect(mergeBackfill(backfill, buffered)).toHaveLength(1);
  });

  it("control: distinct timestamps of the same type both survive", () => {
    const backfill = [{ eventType: "docker_status", timestamp: 100.5 }];
    const buffered = [{ eventType: "docker_status", timestamp: 100.6 }];
    expect(mergeBackfill(backfill, buffered)).toHaveLength(2);
  });
});

// ─── usePulseWindow — hook-level reconciliation ─────────────────────────

describe("usePulseWindow — reconciliation, D-19 dedup, D-17 fill window", () => {
  it("(k) sends an EMPTY args object to the backfill query -- no window parameter is invented", () => {
    renderHook(() => usePulseWindow());
    expect(h.queryMock).toHaveBeenCalledTimes(1);
    expect(h.queryMock.mock.calls[0][1]).toEqual({});
  });

  it("(b) subscription is registered BEFORE the backfill query is issued, and a mid-flight arrival is not lost", async () => {
    const { result } = renderHook(() => usePulseWindow());
    const firstQueryIdx = h.orderLog.indexOf("query");
    const firstSubIdx = h.orderLog.findIndex((e) => e.startsWith("subscribe:"));
    expect(firstSubIdx).toBeGreaterThanOrEqual(0);
    expect(firstSubIdx).toBeLessThan(firstQueryIdx);

    const ts = NOW_MS / 1000 - 5;
    act(() => {
      emit("docker_status", {}, ts);
    });

    h.queryDeferreds[0].resolve({ rows: [], truncated: false });
    await flush();

    expect(result.current.blips.some((b) => b.t === ts * 1000)).toBe(true);
  });

  it("(a) overlap: an event in both backfill and live buffer with the SAME (eventType, timestamp) merges once", async () => {
    const ts = NOW_MS / 1000 - 5.123456;
    const { result } = renderHook(() => usePulseWindow());
    h.queryDeferreds[0].resolve({
      rows: [{ _id: "r1", eventType: "docker_status", timestamp: ts }],
      truncated: false,
    });
    await flush();
    act(() => {
      emit("docker_status", {}, ts);
    });
    expect(result.current.blips).toHaveLength(1);
  });

  it("(a control) distinct floats of the same type both appear", async () => {
    const ts = NOW_MS / 1000 - 5;
    const { result } = renderHook(() => usePulseWindow());
    h.queryDeferreds[0].resolve({
      rows: [{ _id: "r1", eventType: "docker_status", timestamp: ts }],
      truncated: false,
    });
    await flush();
    act(() => {
      emit("docker_status", {}, ts + 0.001);
    });
    expect(result.current.blips).toHaveLength(2);
  });

  it("(d) out-of-order arrival: an earlier-timestamped live event is still placed in the trace, not dropped", async () => {
    const { result } = renderHook(() => usePulseWindow());
    h.queryDeferreds[0].resolve({ rows: [], truncated: false });
    await flush();
    const laterTs = NOW_MS / 1000 - 5;
    const earlierTs = NOW_MS / 1000 - 20;
    act(() => {
      emit("docker_status", {}, laterTs);
    });
    act(() => {
      emit("docker_status", {}, earlierTs);
    });
    expect(result.current.blips.map((b) => b.t)).toEqual(
      expect.arrayContaining([laterTs * 1000, earlierTs * 1000]),
    );
  });

  it("(e) same-second burst: two distinct-fraction same-type events both survive in the trace AND both count", async () => {
    const { result } = renderHook(() => usePulseWindow());
    h.queryDeferreds[0].resolve({ rows: [], truncated: false });
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    const nowSec = Date.now() / 1000;
    act(() => {
      emit("run.tool_call", {}, nowSec - 0.5 + 0.111);
      emit("run.tool_call", {}, nowSec - 0.5 + 0.222);
    });

    const traceCount = result.current.blips.filter((b) => b.hue === "astridr").length;
    expect(traceCount).toBeGreaterThanOrEqual(2);
    expect(result.current.countState).toBe("ready");
    expect(result.current.liveCount).toBe(2);
  });

  it("(f) D-19 doubled run.blocks: identical round_num+blocks, different session ids, 50ms apart -- counts ONCE", async () => {
    const { result } = renderHook(() => usePulseWindow());
    h.queryDeferreds[0].resolve({ rows: [], truncated: false });
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    act(() => {
      emit("run.blocks", { round_num: 7, blocks: ["A", "B"], session_id: "sess-1" }, Date.now() / 1000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    act(() => {
      emit("run.blocks", { round_num: 7, blocks: ["A", "B"], session_id: "sess-2" }, Date.now() / 1000);
    });

    expect(result.current.liveCount).toBe(1);
  });

  it("(f control) two run.blocks frames with DIFFERENT blocks payloads both count -- the guard discriminates, not swallows", async () => {
    const { result } = renderHook(() => usePulseWindow());
    h.queryDeferreds[0].resolve({ rows: [], truncated: false });
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    act(() => {
      emit("run.blocks", { round_num: 7, blocks: ["A", "B"], session_id: "sess-1" }, Date.now() / 1000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    act(() => {
      emit("run.blocks", { round_num: 7, blocks: ["C", "D"], session_id: "sess-2" }, Date.now() / 1000);
    });

    expect(result.current.liveCount).toBe(2);
  });

  it("(g) D-19 single delivery: one run.blocks frame counts once (a no-op once the upstream duplicate is gone)", async () => {
    const { result } = renderHook(() => usePulseWindow());
    h.queryDeferreds[0].resolve({ rows: [], truncated: false });
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    act(() => {
      emit("run.blocks", { round_num: 1, blocks: ["A"] }, Date.now() / 1000);
    });

    expect(result.current.liveCount).toBe(1);
  });

  it("(h) D-17 fill window: countState stays loading through 59s since connect, flips to ready after 60s", async () => {
    const { result } = renderHook(() => usePulseWindow());
    h.queryDeferreds[0].resolve({ rows: [], truncated: false });
    await flush();

    // Push the 3 events late in the fill window (58s in) so they are still
    // well within their OWN 60s trailing window once the fill window
    // itself crosses 60s -- this isolates "the window since connect has not
    // filled" (loading) from "the rolling 60s count window" (which is a
    // separate, event-relative clock covered by case (e)'s burst).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(58_000);
    });
    expect(result.current.countState).toBe("loading");
    expect(result.current.liveCount).toBeNull();

    act(() => {
      emit("docker_status", {}, Date.now() / 1000);
      emit("docker_status", {}, Date.now() / 1000);
      emit("docker_status", {}, Date.now() / 1000);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000); // 59s since connect -- still loading
    });
    expect(result.current.countState).toBe("loading");
    expect(result.current.liveCount).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000); // 61s since connect -- crosses the fill window
    });
    expect(result.current.countState).toBe("ready");
    expect(result.current.liveCount).toBe(3);
  });

  it("(i) backfill rejection: feedState is unavailable, nothing throws, live events still accumulate", async () => {
    const { result } = renderHook(() => usePulseWindow());
    h.queryDeferreds[0].reject(new Error("Server Error"));
    await flush();
    expect(result.current.feedState).toBe("unavailable");

    act(() => {
      emit("docker_status", {}, Date.now() / 1000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    // countState stays unavailable -- backfillFailed holds it there even
    // once the window would otherwise have filled.
    expect(result.current.countState).toBe("unavailable");
  });

  it("(j) truncated backfill: backfillTruncated is true; countState is unaffected (still governed by the D-17 fill window)", async () => {
    const { result } = renderHook(() => usePulseWindow());
    h.queryDeferreds[0].resolve({ rows: [], truncated: true });
    await flush();
    expect(result.current.backfillTruncated).toBe(true);
    expect(result.current.countState).toBe("loading");
  });

  it("(j control) truncated:false with an otherwise identical response yields backfillTruncated=false", async () => {
    const { result } = renderHook(() => usePulseWindow());
    h.queryDeferreds[0].resolve({ rows: [], truncated: false });
    await flush();
    expect(result.current.backfillTruncated).toBe(false);
  });

  it("(c) reconnect: feedState -> unavailable, query called a SECOND time, countState -> loading, liveCount -> null", async () => {
    const { result, rerender } = renderHook(() => usePulseWindow());
    h.queryDeferreds[0].resolve({ rows: [], truncated: false });
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    act(() => {
      emit("docker_status", {}, Date.now() / 1000);
    });
    expect(result.current.countState).toBe("ready");
    expect(result.current.liveCount).toBe(1);
    expect(result.current.feedState).toBe("live");

    h.status = "reconnecting";
    rerender();
    expect(result.current.feedState).toBe("unavailable");

    h.status = "connected";
    rerender();

    expect(h.queryMock).toHaveBeenCalledTimes(2);
    expect(result.current.feedState).toBe("unavailable");
    expect(result.current.countState).toBe("loading");
    expect(result.current.liveCount).toBeNull();

    h.queryDeferreds[1].resolve({ rows: [], truncated: false });
    await flush();
  });
});
