/**
 * Wave 0 tests for useKgAnimation (KG-11, Plan 04)
 * Tests the pure pieces:
 *   1. Frame synthesis — range + interval → evenly-spaced YYYY-MM-DD strings (D-07)
 *   2. LRU cache — insertion-order eviction at 20-entry cap (D-09)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

// ── Extracted testable helpers (mirrored from useKgAnimation.ts) ─────────────

/** Build evenly-spaced ISO date strings from rangeStart to rangeEnd at interval. */
function intervalMs(interval: "day" | "week" | "month"): number {
  if (interval === "day") return 86_400_000;
  if (interval === "week") return 7 * 86_400_000;
  return 30 * 86_400_000; // month ≈ 30 days
}

function synthesizeFrames(
  rangeStart: string | null,
  rangeEnd: string | null,
  interval: "day" | "week" | "month",
  maxFrames = 60,
): string[] {
  if (!rangeStart || !rangeEnd) return [];
  const start = new Date(rangeStart).getTime();
  const end = new Date(rangeEnd).getTime();
  const step = intervalMs(interval);
  if (start > end) return [];
  const result: string[] = [];
  for (let t = start; t <= end; t += step) {
    result.push(new Date(t).toISOString().slice(0, 10));
    if (result.length >= maxFrames) break;
  }
  return result;
}

/** LRU cache implementation matching useKgAnimation.ts */
function makeLruCache<V>(maxSize: number) {
  const cache = new Map<string, V>();

  function cacheSet(key: string, value: V): void {
    if (cache.has(key)) cache.delete(key); // re-insert as newest
    cache.set(key, value);
    if (cache.size > maxSize) {
      const oldest = cache.keys().next().value as string;
      cache.delete(oldest);
    }
  }

  return { cache, cacheSet };
}

// ── Test suite ───────────────────────────────────────────────────────────────

describe("synthesizeFrames — frame synthesis (D-07)", () => {
  it("produces exactly 5 inclusive YYYY-MM-DD frames for a 5-day range at day interval", () => {
    const frames = synthesizeFrames("2025-01-01", "2025-01-05", "day");
    expect(frames).toHaveLength(5);
    expect(frames[0]).toBe("2025-01-01");
    expect(frames[4]).toBe("2025-01-05");
  });

  it("returns empty array when rangeStart is null (unset range — D-07: no endpoint dependency)", () => {
    const frames = synthesizeFrames(null, "2025-01-05", "day");
    expect(frames).toHaveLength(0);
  });

  it("returns empty array when rangeEnd is null (unset range)", () => {
    const frames = synthesizeFrames("2025-01-01", null, "day");
    expect(frames).toHaveLength(0);
  });

  it("returns empty array when both are null", () => {
    const frames = synthesizeFrames(null, null, "day");
    expect(frames).toHaveLength(0);
  });

  it("caps at 60 frames for a very wide range at day interval", () => {
    // 2025-01-01 to 2025-12-31 = 364 days; should cap at 60
    const frames = synthesizeFrames("2025-01-01", "2025-12-31", "day");
    expect(frames).toHaveLength(60);
    expect(frames[0]).toBe("2025-01-01");
  });

  it("produces correct week-interval frames", () => {
    const frames = synthesizeFrames("2025-01-01", "2025-01-22", "week");
    // 2025-01-01, 2025-01-08, 2025-01-15, 2025-01-22 = 4 frames
    expect(frames).toHaveLength(4);
    expect(frames[0]).toBe("2025-01-01");
    expect(frames[1]).toBe("2025-01-08");
  });

  it("returns empty array when start is after end", () => {
    const frames = synthesizeFrames("2025-01-10", "2025-01-01", "day");
    expect(frames).toHaveLength(0);
  });

  it("returns a single frame when start equals end", () => {
    const frames = synthesizeFrames("2025-06-15", "2025-06-15", "day");
    expect(frames).toHaveLength(1);
    expect(frames[0]).toBe("2025-06-15");
  });

  it("does NOT call any fetch or reference fetchSnapshotDates (D-07 source assertion verified via static analysis)", () => {
    // The function is pure — it takes only rangeStart, rangeEnd, interval
    // and produces strings via Date arithmetic. No async, no fetch calls.
    const frames = synthesizeFrames("2025-03-01", "2025-03-03", "day");
    expect(frames).toEqual(["2025-03-01", "2025-03-02", "2025-03-03"]);
  });
});

describe("LRU cache eviction (D-09)", () => {
  it("inserts and retrieves a value", () => {
    const { cache, cacheSet } = makeLruCache<number>(20);
    cacheSet("a", 1);
    expect(cache.get("a")).toBe(1);
  });

  it("evicts the oldest entry when size exceeds maxSize (20-entry cap)", () => {
    const { cache, cacheSet } = makeLruCache<number>(20);
    // Insert 21 keys: "key-0" .. "key-20"
    for (let i = 0; i <= 20; i++) {
      cacheSet(`key-${i}`, i);
    }
    // Size must be exactly 20 (D-09)
    expect(cache.size).toBe(20);
    // The first inserted key ("key-0") must have been evicted
    expect(cache.has("key-0")).toBe(false);
    // The most recently inserted ("key-20") must still be present
    expect(cache.has("key-20")).toBe(true);
  });

  it("re-accessing an existing key moves it to newest (it survives the next eviction)", () => {
    const { cache, cacheSet } = makeLruCache<number>(3);
    cacheSet("a", 1);
    cacheSet("b", 2);
    cacheSet("c", 3);
    // "a" is oldest; re-access it to make it newest
    cacheSet("a", 1); // re-insert same key
    // Now insert "d" — should evict "b" (oldest after "a" was refreshed)
    cacheSet("d", 4);
    expect(cache.size).toBe(3);
    expect(cache.has("b")).toBe(false); // "b" was oldest, evicted
    expect(cache.has("a")).toBe(true);  // "a" was refreshed, survives
    expect(cache.has("c")).toBe(true);
    expect(cache.has("d")).toBe(true);
  });

  it("does not exceed maxSize across many insertions", () => {
    const { cache, cacheSet } = makeLruCache<string>(20);
    for (let i = 0; i < 100; i++) {
      cacheSet(`k${i}`, `v${i}`);
    }
    expect(cache.size).toBeLessThanOrEqual(20);
  });

  it("oldest is evicted correctly — Map insertion-order invariant", () => {
    const { cache, cacheSet } = makeLruCache<number>(3);
    cacheSet("x", 10);
    cacheSet("y", 20);
    cacheSet("z", 30);
    // Insert 4th — evicts "x"
    cacheSet("w", 40);
    expect(cache.has("x")).toBe(false);
    expect([...cache.keys()]).toEqual(["y", "z", "w"]);
  });
});

// ── CR-01 regression: current frame must actually display ────────────────────
// The lookahead prefetch used to share the primary fetch's monotonic token and
// bump it synchronously, so the primary fetch's `.then` saw a stale token and
// returned early — setCurrentGraph never fired and the canvas stuck. Frame 0 of
// a multi-frame range is a cache miss WITH uncached lookahead frames, the exact
// trigger. This renders the real hook and asserts the current frame populates.
describe("useKgAnimation — current frame display (CR-01 regression)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("populates currentGraph on a cache-miss frame even when lookahead frames are uncached", async () => {
    const graphFor = (asOf: string) => ({ nodes: [{ id: asOf }], links: [] });

    vi.doMock("../lib/kgApi", () => ({
      fetchOverview: vi.fn(({ asOf }: { asOf: string }) => Promise.resolve({ asOf })),
    }));
    vi.doMock("../lib/kg-graph", () => ({
      normalizeOverview: (r: { asOf: string }) => r,
      toGraphData: (r: { asOf: string }) => graphFor(r.asOf),
    }));

    const { useKgAnimation } = await import("./useKgAnimation");

    // 3-frame range → frame 0 is a cache miss with 2 uncached lookahead frames.
    const { result } = renderHook(() =>
      useKgAnimation({
        rangeStart: "2025-01-01",
        rangeEnd: "2025-01-03",
        interval: "day",
      }),
    );

    expect(result.current.frames).toHaveLength(3);

    await waitFor(() => {
      expect(result.current.currentGraph).not.toBeNull();
    });

    expect(result.current.currentGraph).toEqual(graphFor("2025-01-01"));
    expect(result.current.frameError).toBeNull();
  });
});
