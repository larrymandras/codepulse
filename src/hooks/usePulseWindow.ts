/**
 * usePulseWindow.ts — the Pulse ECG hero's data feed (SIGNAL-02, Phase 125
 * Plan 09).
 *
 * D-05: one bounded Convex read (the query exported by `convex/events.ts`
 * for exactly this purpose, called with an EMPTY args object — the window
 * and row cap are server-side module constants) backfills the trailing-60s
 * TRACE on mount and on every reconnect; the Ástríðr WS stream drives
 * everything after it. This is an IMPERATIVE `useConvex().query(...)` call
 * inside try/catch, never a live Convex subscription hook — a subscription
 * hook re-runs continuously against a high-churn table (a subscription
 * wearing a read's costume), and one that throws unmounts the whole React
 * tree, whereas a rejected promise here is caught and lands in the
 * already-designed `unavailable` state (CLAUDE.md's "Convex & Frontend
 * Lessons").
 *
 * D-17: the 40px numeral counts LIVE-WS events over the trailing 60s ONLY.
 * `run.*` and `chat.response` — the whole Ástríðr-violet family — reach
 * Convex through no path at all (`send_live()` never sends to the Convex
 * HTTP endpoint, per its own docstring), so the Convex backfill can contain
 * zero violet blips by construction. Counting only what the socket delivers
 * makes the numeral exact over ONE coherent event universe, at the honest
 * cost of a fill window: until `windowMs` has elapsed since mount or since
 * the last reconnect, the count is withheld (`countState === "loading"`)
 * rather than shown as a partial figure presented as complete — the exact
 * defect D-12 exists to remove.
 *
 * D-19 (see D-19-REVISED, 125-CONTEXT.md): the upstream `run.blocks`
 * single-emission fix was withdrawn — deleting either buffered `.send()`
 * call would have silently emptied `/live-run`'s persisted history
 * (`convex/runBlocks.ts:12` is that table's only writer). The client-side
 * dedup guard below (`dedupeLiveEvent`) is therefore the WHOLE mitigation
 * for the numeral, not a backup — see its own comment for the exact key.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useConvex } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAstridrWS, TOPIC_EVENT_MAP } from "@/contexts/AstridrWSContext";
import { eventTypeToHue } from "@/lib/eventHue";
import type { EcgBlip, EcgFeedState } from "@/components/PulseEcgCanvas";

export type CountState = "loading" | "unavailable" | "ready";

export interface PulseWindow {
  /** merged trace, trimmed to the window */
  blips: EcgBlip[];
  feedState: EcgFeedState;
  /** null unless countState === "ready" */
  liveCount: number | null;
  countState: CountState;
  /** true when the server's 500-row cap bound the backfill — the trace's
   *  pre-mount half is known incomplete. Never swallowed. */
  backfillTruncated: boolean;
}

const DEFAULT_WINDOW_MS = 60_000;

// D-19: the guard's own TTL — long enough to span the two paired emissions
// (measured ~ms apart in astridr-repo, tested here at 50ms), short enough
// that the dedup map cannot accumulate keys across unrelated bursts. Pruned
// on EVERY call, not on a timer, so the map's size is always bounded by
// "keys seen in the last DEDUPE_TTL_MS", never by the tab's uptime
// (T-125-09-03).
const DEDUPE_TTL_MS = 2000;

interface TraceRow {
  eventType: string;
  /** epoch ms, producer clock — NOT client arrival time. Matches the
   *  backfill's units so `mergeBackfill`'s exact-float identity rule is
   *  comparing like with like. */
  timestamp: number;
}

/**
 * Pure, exported for direct testing. Returns true if this live event should
 * be COUNTED (i.e. it is not a duplicate delivery of the same logical
 * `run.blocks` turn).
 *
 * Scoped to `run.blocks` ONLY — every other event type always returns true.
 * A blanket dedup would silently undercount ordinary same-type bursts (a
 * same-second `tool_call` pair is the ordinary shape of an agent burst, not
 * a duplicate); this guard exists for exactly one known double-emission,
 * not as a general de-noising layer.
 *
 * The key is the literal `run.blocks`, plus `data.round_num`, plus the
 * serialised `data.blocks` payload. It deliberately excludes any per-turn
 * identifier that the two emissions are not guaranteed to share — Ástríðr's
 * own paired call sites carry that identifier under two different
 * overrides, so a naive identity dedup keyed on it would miss the duplicate
 * this guard exists to catch (D-19, 125-CONTEXT.md).
 */
export function dedupeLiveEvent(
  seen: Map<string, number>,
  eventType: string,
  data: unknown,
  nowMs: number,
): boolean {
  // Prune expired entries on every call, regardless of eventType, so this
  // is the map's only mutator and its size is always TTL-bounded.
  for (const [key, ts] of seen) {
    if (nowMs - ts >= DEDUPE_TTL_MS) seen.delete(key);
  }

  if (eventType !== "run.blocks") return true;

  const payload = (data ?? {}) as Record<string, unknown>;
  let blocksKey: string;
  try {
    blocksKey = JSON.stringify(payload.blocks);
  } catch {
    // T-125-09-04: a circular or otherwise unstringifiable payload must not
    // throw inside the WS fan-out. Falling back to a constant means this one
    // malformed event risks being treated as a duplicate of another
    // malformed one within the TTL — failing to dedup a rare pathological
    // payload is strictly better than losing the socket.
    blocksKey = "__unstringifiable__";
  }
  const key = `run.blocks:${String(payload.round_num)}:${blocksKey}`;

  if (seen.has(key)) return false; // duplicate within the TTL — do not count
  seen.set(key, nowMs);
  return true;
}

/**
 * Pure, exported for direct testing. Merges the Convex backfill with the
 * buffered live rows for the TRACE (never for the count — D-17 keeps those
 * two universes separate).
 *
 * Identity rule: a buffered live row is dropped from the merge only when a
 * backfill row carries the EXACT same `eventType` AND the exact same
 * fractional `timestamp` float. Never floored or rounded — flooring would
 * manufacture the ambiguity this rule exists to avoid. This works because
 * RESEARCH R-1 established that the WS payload and the eventually-stored
 * Convex row carry the SAME producer float for buffered-path events
 * (`telemetry.py:214`) — there is no cross-clock comparison here.
 *
 * FAILURE MODE, stated plainly: two genuinely distinct events of the same
 * type carrying an identical timestamp float will merge to ONE,
 * under-drawing one blip in the trace. Acceptable for a qualitative trace —
 * and exactly why the live COUNT (`dedupeLiveEvent`) never uses this rule.
 */
export function mergeBackfill(
  backfill: readonly TraceRow[],
  buffered: readonly TraceRow[],
): TraceRow[] {
  const backfillKeys = new Set(backfill.map((r) => `${r.eventType}:${r.timestamp}`));
  const survivors = buffered.filter((r) => !backfillKeys.has(`${r.eventType}:${r.timestamp}`));
  return [...backfill, ...survivors];
}

export function usePulseWindow(windowMs: number = DEFAULT_WINDOW_MS): PulseWindow {
  const convex = useConvex();
  const { status, subscribe } = useAstridrWS();

  const [blips, setBlips] = useState<EcgBlip[]>([]);
  const [feedState, setFeedState] = useState<EcgFeedState>("unavailable");
  const [countState, setCountState] = useState<CountState>("unavailable");
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const [backfillTruncated, setBackfillTruncated] = useState(false);

  const mountedRef = useRef(true);
  const connStatusRef = useRef(status);

  // The accumulating data. React state above is a PROJECTION of these,
  // recomputed by recompute() — never mutated directly from state setters.
  const backfillRowsRef = useRef<TraceRow[]>([]);
  const bufferedLiveRef = useRef<TraceRow[]>([]); // for the TRACE merge
  const liveCountTimestampsRef = useRef<number[]>([]); // for the NUMERAL (client Date.now())
  const dedupeSeenRef = useRef<Map<string, number>>(new Map());
  // AstridrWSContext hands the IDENTICAL msg object to every matching
  // callback — both for a genuine multi-topic delivery and for its
  // unknown-event-type fan-out-to-all branch — so a msg object already
  // handled once is a repeat delivery of the same wire event, never a
  // second event (same rationale as SignalHorizon.tsx's packet spawner). A
  // WeakSet holds no strong reference, so transient per-message objects are
  // never retained past their own garbage collection.
  const seenMsgsRef = useRef<WeakSet<object>>(new WeakSet());

  const windowStartedAtRef = useRef<number>(Date.now());
  const mergeReadyRef = useRef(false); // has the current connect-epoch's backfill resolved?
  const backfillFailedRef = useRef(false);
  const epochRef = useRef(0); // bumped on every transition into "connected"
  const readyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const recompute = useCallback(() => {
    if (!mountedRef.current) return;
    const now = Date.now();

    // T-125-09-03: bounded memory — both the merge buffer and the
    // live-count array are trimmed to the window on every recompute, never
    // left to grow for the lifetime of the tab.
    bufferedLiveRef.current = bufferedLiveRef.current.filter((r) => now - r.timestamp < windowMs);
    liveCountTimestampsRef.current = liveCountTimestampsRef.current.filter((t) => now - t < windowMs);

    const connected = connStatusRef.current === "connected";

    if (mergeReadyRef.current) {
      const merged = mergeBackfill(backfillRowsRef.current, bufferedLiveRef.current).filter(
        (r) => now - r.timestamp < windowMs,
      );
      setBlips(merged.map((r) => ({ t: r.timestamp, hue: eventTypeToHue(r.eventType) })));
      setFeedState(!connected ? "unavailable" : merged.length > 0 ? "live" : "idle");
    } else {
      setBlips([]);
      setFeedState("unavailable");
    }

    if (!connected || backfillFailedRef.current) {
      setCountState("unavailable");
      setLiveCount(null);
    } else if (now - windowStartedAtRef.current < windowMs) {
      // D-17's cost, honoured: for the first `windowMs` after mount or after
      // the last reconnect, the window has not filled yet — the numeral
      // must render as withheld, never as a partial count presented as
      // complete.
      setCountState("loading");
      setLiveCount(null);
    } else {
      setCountState("ready");
      setLiveCount(liveCountTimestampsRef.current.length);
    }
  }, [windowMs]);

  const handleLiveEvent = useCallback(
    (msg: Record<string, unknown>) => {
      try {
        if (seenMsgsRef.current.has(msg)) return;
        seenMsgsRef.current.add(msg);

        const eventType = msg.event_type;
        if (typeof eventType !== "string") return; // malformed — nothing to draw or count

        // estop_state is a state transition the Signal Horizon already
        // visualises — it is not traffic, so it is excluded from both the
        // trace and the count.
        if (eventType === "estop_state") return;

        const rawTs = msg.timestamp;
        const producerMs = typeof rawTs === "number" ? rawTs * 1000 : Date.now();
        bufferedLiveRef.current.push({ eventType, timestamp: producerMs });

        const nowMs = Date.now();
        if (dedupeLiveEvent(dedupeSeenRef.current, eventType, msg.data, nowMs)) {
          liveCountTimestampsRef.current.push(nowMs);
        }

        recompute();
      } catch {
        // This handler runs inside AstridrWSContext's synchronous
        // ws.onmessage fan-out (T-125-09-04-adjacent) — a throw here would
        // take down the whole telemetry stream for every subscriber if
        // rethrown. Never rethrow.
      }
    },
    [recompute],
  );

  // ─── Subscribe before you read ────────────────────────────────────────────
  // Registered once, before any backfill is ever issued (declared ahead of
  // the connect-cycle effect below so React runs it first on the same
  // commit) — nothing emitted during the backfill's round trip is lost.
  // Persists across underlying WS reconnects (AstridrWSContext's own
  // subscriber maps are not cleared on socket close), so this never needs
  // to re-subscribe on reconnect; only the accumulated data resets, in the
  // effect below.
  useEffect(() => {
    const unsubscribers = Object.keys(TOPIC_EVENT_MAP).map((topic) => subscribe(topic, handleLiveEvent));
    return () => {
      for (const unsub of unsubscribers) unsub();
    };
  }, [subscribe, handleLiveEvent]);

  // ─── Connect-cycle: one bounded read per mount and per reconnect ─────────
  useEffect(() => {
    connStatusRef.current = status;

    if (status !== "connected") {
      if (readyTimerRef.current) {
        clearTimeout(readyTimerRef.current);
        readyTimerRef.current = null;
      }
      recompute();
      return;
    }

    // A transition INTO "connected" — covers both the initial connect and
    // every reconnect. The epoch bump means a slow-resolving backfill
    // promise from a PRIOR connection cannot land after this one has
    // already reset state (case: rapid disconnect/reconnect).
    const epoch = ++epochRef.current;

    // Reconnect: clear the buffer and the merged trace rather than silently
    // resuming with a gap — a stale pre-reconnect buffer merged against a
    // freshly authoritative backfill would double-count or misplace events
    // from before the drop. Harmless no-op on the very first connect, since
    // both arrays are already empty.
    bufferedLiveRef.current = [];
    liveCountTimestampsRef.current = [];
    mergeReadyRef.current = false;
    backfillFailedRef.current = false;
    windowStartedAtRef.current = Date.now();
    setBackfillTruncated(false);
    recompute(); // immediately reflect "unavailable" trace / "loading" count for this window

    if (readyTimerRef.current) clearTimeout(readyTimerRef.current);
    readyTimerRef.current = setTimeout(() => {
      readyTimerRef.current = null;
      recompute(); // flips countState loading -> ready once the window has filled
    }, windowMs);

    void (async () => {
      try {
        // The argument object is EMPTY: the window and the row cap are
        // server-side module constants (convex/events.ts) and the query
        // exposes no parameter — a client-supplied window argument would be
        // calling a parameter the deployed function does not have, and the
        // whole point (an unauthenticated-reachable read cannot widen its
        // own scan) would be defeated by inventing one here.
        const result = await convex.query(api.events.listRecentRuntimeWindow, {});
        if (!mountedRef.current || epochRef.current !== epoch) return; // superseded

        backfillRowsRef.current = result.rows.map((r) => ({
          eventType: r.eventType,
          timestamp: r.timestamp * 1000, // producer seconds -> ms
        }));
        setBackfillTruncated(result.truncated);
        mergeReadyRef.current = true;
        recompute();
      } catch (err) {
        if (!mountedRef.current || epochRef.current !== epoch) return; // superseded

        // Convex redacts plain Error messages to "Server Error" client-side
        // — read err.data before err.message (CLAUDE.md's ConvexError
        // rule). Never throws out of this effect.
        const reason =
          err && typeof err === "object" && "data" in err
            ? (err as { data?: unknown }).data
            : err instanceof Error
              ? err.message
              : String(err);
        // eslint-disable-next-line no-console
        console.error("[usePulseWindow] backfill query rejected:", reason);
        backfillFailedRef.current = true;
        mergeReadyRef.current = false;
        recompute();
      }
    })();

    return () => {
      if (readyTimerRef.current) {
        clearTimeout(readyTimerRef.current);
        readyTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, windowMs, convex, recompute]);

  return { blips, feedState, liveCount, countState, backfillTruncated };
}
