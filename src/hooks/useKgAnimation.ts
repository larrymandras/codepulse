/**
 * useKgAnimation — KG-11 Animate sub-mode (Plan 04)
 *
 * Synthesizes an evenly-spaced frame sequence from operator-picked
 * {rangeStart, rangeEnd, interval} — ZERO cross-repo dependency (D-07).
 * No fetchSnapshotDates(), no /api/kg/snapshots endpoint call.
 *
 * Frame cache: Map<string, KgGraphData> with 20-entry LRU eviction (D-09).
 * 2-frame lookahead prefetch; monotonic request token drops stale fetches (Pitfall 4).
 * Per-frame fetch failure degrades inline; other sub-modes unaffected (D-08).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchOverview } from "../lib/kgApi";
import {
  toGraphData,
  normalizeOverview,
  type KgGraphData,
} from "../lib/kg-graph";

// ── Frame synthesis helpers (exported for test reuse) ────────────────────────

export function intervalMs(interval: "day" | "week" | "month"): number {
  if (interval === "day") return 86_400_000;
  if (interval === "week") return 7 * 86_400_000;
  return 30 * 86_400_000; // month ≈ 30 days
}

/** Synthesize evenly-spaced ISO date strings (YYYY-MM-DD) inclusive of start. */
export function synthesizeFrames(
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

// ── LRU cache helper ─────────────────────────────────────────────────────────

const MAX_CACHE = 20; // D-09

function cacheSet(
  cache: Map<string, KgGraphData>,
  key: string,
  value: KgGraphData,
): void {
  if (cache.has(key)) cache.delete(key); // re-insert as newest
  cache.set(key, value);
  if (cache.size > MAX_CACHE) {
    // Evict oldest: Map.keys() is insertion-order
    const oldest = cache.keys().next().value as string;
    cache.delete(oldest);
  }
}

// ── Hook ────────────────────────────────────────────────────────────────────

export interface UseKgAnimationReturn {
  /** Synthesized evenly-spaced ISO date frames (D-07). Empty when range unset. */
  frames: string[];
  /** Index of the currently displayed frame. */
  currentFrameIndex: number;
  /** Graph data for the current frame (null while first fetch is in-flight). */
  currentGraph: KgGraphData | null;
  /** Whether playback is running. */
  isPlaying: boolean;
  /** Frames-per-second (default 1). */
  fps: number;
  /** Per-frame inline error (D-08). Does not block other sub-modes. */
  frameError: string | null;
  /** Start playback. */
  play: () => void;
  /** Pause playback. */
  pause: () => void;
  /** Advance one frame and pause. */
  stepForward: () => void;
  /** Retreat one frame and pause. */
  stepBack: () => void;
  /** Jump to a specific frame index and pause. */
  setFrameIndex: (i: number) => void;
  /** Set playback speed in frames-per-second. */
  setFps: (n: number) => void;
}

export function useKgAnimation({
  rangeStart,
  rangeEnd,
  interval,
}: {
  rangeStart: string | null;
  rangeEnd: string | null;
  interval: "day" | "week" | "month";
}): UseKgAnimationReturn {
  // ── Frame synthesis (D-07) ─────────────────────────────────────────────────
  // Client-synthesized from rangeStart/rangeEnd/interval — NO fetchSnapshotDates().
  const frames = useMemo(
    () => synthesizeFrames(rangeStart, rangeEnd, interval),
    [rangeStart, rangeEnd, interval],
  );

  // ── Playback state ─────────────────────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false);
  const [fps, setFpsState] = useState(1);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [currentGraph, setCurrentGraph] = useState<KgGraphData | null>(null);
  const [frameError, setFrameError] = useState<string | null>(null);

  // ── LRU cache (D-09) ──────────────────────────────────────────────────────
  const cacheRef = useRef<Map<string, KgGraphData>>(new Map());

  // ── Monotonic frame request token (Pitfall 4 — stale-drop) ────────────────
  const frameReqRef = useRef(0);

  // ── Reset frame index when frames change ──────────────────────────────────
  // Also reset current graph so the fetch effect fires for frame 0.
  const prevFramesRef = useRef<string[]>(frames);
  useEffect(() => {
    if (prevFramesRef.current !== frames) {
      prevFramesRef.current = frames;
      setCurrentFrameIndex(0);
      setCurrentGraph(null);
      setFrameError(null);
      setIsPlaying(false);
    }
  }, [frames]);

  // ── Per-frame fetch effect (Pitfall 4 — cache-check-before-fetch) ─────────
  useEffect(() => {
    const key = frames[currentFrameIndex];
    if (!key) {
      setCurrentGraph(null);
      return;
    }

    // Cache hit: serve immediately, no fetch (Pitfall 4)
    if (cacheRef.current.has(key)) {
      setCurrentGraph(cacheRef.current.get(key)!);
      setFrameError(null);

      // Prefetch ~2 frames ahead (cache-miss only, fire-and-forget)
      for (const offset of [1, 2]) {
        const ahead = frames[currentFrameIndex + offset];
        if (ahead && !cacheRef.current.has(ahead)) {
          const prefetchToken = ++frameReqRef.current;
          fetchOverview({ asOf: ahead })
            .then((resp) => {
              if (prefetchToken !== frameReqRef.current) return; // stale drop
              cacheSet(cacheRef.current, ahead, toGraphData(normalizeOverview(resp)));
            })
            .catch(() => {
              /* prefetch failure is silent — per-frame fetch error handles it if needed */
            });
        }
      }
      return;
    }

    // Cache miss: fetch with monotonic token
    const token = ++frameReqRef.current;
    fetchOverview({ asOf: key })
      .then((resp) => {
        if (token !== frameReqRef.current) return; // stale drop
        const g = toGraphData(normalizeOverview(resp));
        cacheSet(cacheRef.current, key, g);
        setCurrentGraph(g);
        setFrameError(null);
      })
      .catch((err) => {
        if (token !== frameReqRef.current) return; // stale drop
        // D-08 graceful-degrade: per-frame inline error, no hard block
        setFrameError(`Could not load snapshot for ${key}.`);
        // Keep currentGraph at last successful frame (don't null it)
      });

    // Prefetch ~2 frames ahead (fire-and-forget, cache-checked)
    for (const offset of [1, 2]) {
      const ahead = frames[currentFrameIndex + offset];
      if (ahead && !cacheRef.current.has(ahead)) {
        const prefetchToken = ++frameReqRef.current;
        fetchOverview({ asOf: ahead })
          .then((resp) => {
            if (prefetchToken !== frameReqRef.current) return;
            cacheSet(cacheRef.current, ahead, toGraphData(normalizeOverview(resp)));
          })
          .catch(() => {
            /* prefetch failure is silent */
          });
      }
    }
  }, [currentFrameIndex, frames]);

  // ── Playback timer (NOT requestAnimationFrame — 1fps cadence) ─────────────
  useEffect(() => {
    if (!isPlaying || frames.length === 0) return;
    const id = setInterval(() => {
      setCurrentFrameIndex((i) => {
        const next = i + 1;
        if (next >= frames.length) {
          // Reached last frame — stop
          setIsPlaying(false);
          return i;
        }
        return next;
      });
    }, 1000 / fps);
    return () => clearInterval(id);
  }, [isPlaying, fps, frames.length]);

  // ── Controls ──────────────────────────────────────────────────────────────

  const play = useCallback(() => {
    if (frames.length > 0) setIsPlaying(true);
  }, [frames.length]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const stepForward = useCallback(() => {
    setIsPlaying(false);
    setCurrentFrameIndex((i) => Math.min(i + 1, frames.length - 1));
  }, [frames.length]);

  const stepBack = useCallback(() => {
    setIsPlaying(false);
    setCurrentFrameIndex((i) => Math.max(i - 1, 0));
  }, []);

  const setFrameIndex = useCallback(
    (i: number) => {
      setIsPlaying(false);
      setCurrentFrameIndex(Math.max(0, Math.min(i, frames.length - 1)));
    },
    [frames.length],
  );

  const setFps = useCallback((n: number) => {
    setFpsState(n);
  }, []);

  return {
    frames,
    currentFrameIndex,
    currentGraph,
    isPlaying,
    fps,
    frameError,
    play,
    pause,
    stepForward,
    stepBack,
    setFrameIndex,
    setFps,
  };
}
