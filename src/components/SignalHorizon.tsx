/**
 * SignalHorizon.tsx — SIGNAL-01 (Phase 125-04): the fail-closed 5-state
 * (six-value) Signal Horizon state machine and its visual mount.
 *
 * D-01/D-02: Ástríðr is the ONLY source of truth for E-Stop armed state, via
 * a well-formed `estop_state` WS snapshot pushed on connect and on every
 * transition (astridr-repo, plan 125-03/125-12). Nothing here latches the
 * E-Stop button's own ack, nothing caches armed state across a reload, and
 * no Convex row is ever treated as the truth (F-1/125-CONTEXT.md).
 *
 * D-02/T-125-04-02: the whole point of this file is that it is FAIL-CLOSED.
 * `resolveHorizonState`'s ordered if-chain enters Unknown — never a
 * fallthrough to the calm aurora — on mount, on every reconnect, on a
 * connect-scoped snapshot timeout, and on a malformed payload. A
 * CONNECTED-but-unconfirmed socket must never paint calm while E-Stop could
 * be armed; that was the fail-OPEN defect an earlier version of this spec
 * shipped and the UI-checker caught.
 *
 * D-05: this component takes `alertLevel` as a PROP (hoisted from an
 * already-existing `api.alerts.countBySeverity` subscription, plan 125-08)
 * and issues zero data-fetching hook calls of its own — it adds no Convex
 * subscription to the every-route shell.
 *
 * This plan does NOT mount the component anywhere and adds no packet
 * spawning — see plan 125-08.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAstridrWS } from "@/contexts/AstridrWSContext";

// ─── Public contract (125-04-PLAN.md <interfaces> — 125-08 mounts against
// exactly this signature; do not change it without updating that plan) ─────

export type HorizonState = "critical" | "warn" | "dawn" | "unknown" | "offline" | "resting";
export type AlertLevel = "critical" | "warn" | "none" | "unknown";

export interface HorizonInput {
  wsStatus: "connected" | "reconnecting" | "disconnected";
  /** null = no valid well-formed snapshot for THIS connection. */
  snapshot: { armed: boolean } | null;
  /** epoch ms; non-null while the post-disarm amber ease is running. */
  dawnUntil: number | null;
  alertLevel: AlertLevel;
  now: number;
}

/**
 * Pure, exported for direct testing. Ordered if-chain, first match wins,
 * never a fallthrough to a calm default — the fail-closed contract lives
 * entirely in this function's ordering, so a regression here is the whole
 * ballgame (T-125-04-02's mitigation, proven by mutation (1) in
 * SignalHorizon.test.tsx).
 */
export function resolveHorizonState(input: HorizonInput): HorizonState {
  const { wsStatus, snapshot, dawnUntil, alertLevel, now } = input;

  // 1. A disconnected socket outranks a stale snapshot — the snapshot is
  //    stale by definition once the socket itself is down.
  if (wsStatus === "disconnected") return "offline";

  // 2. No well-formed snapshot for THIS connection. Covers mount, a
  //    reconnect (the component clears `snapshot` on every departure from
  //    "connected", so `wsStatus === "reconnecting"` always lands here, not
  //    on some stale remembered value), a connect-scoped freshness timeout,
  //    and a malformed payload (the component sets `snapshot = null` on any
  //    invalid shape rather than leaving the previous value in place). This
  //    is the fail-closed core: Unknown, never Resting.
  if (snapshot === null) return "unknown";

  // 3. An armed snapshot outranks alert severity — E-Stop is the stronger
  //    claim than an alert count.
  if (snapshot.armed === true) return "critical";

  // 4. Alert-severity overlay. `alertLevel === "unknown"` (counts still
  //    loading) deliberately falls through rather than blocking here — the
  //    E-Stop snapshot is the safety gate, alert counts are a severity
  //    overlay on top of an already-safe system (D-05's planner correction).
  if (alertLevel === "critical") return "critical";
  if (alertLevel === "warn") return "warn";

  // 5. The disarm ease — amber for DAWN_MS after a valid armed:true ->
  //    armed:false transition on this connection.
  if (dawnUntil !== null && now < dawnUntil) return "dawn";

  // 6. Calm aurora — reachable ONLY once every fail-closed gate above has
  //    cleared: connected, a fresh well-formed disarmed snapshot, no
  //    alert-severity override, and no disarm ease in flight.
  return "resting";
}

// ─── Wire validation ─────────────────────────────────────────────────────

// D-02/planner_corrections: the freshness timeout is CONNECT-SCOPED, not a
// rolling staleness timer. `ws_telemetry.py:194-207` has no heartbeat — a
// calm system emits nothing after its connect snapshot — so a rolling timer
// would drive every healthy console permanently to Unknown, making the
// aurora resting state unreachable. This timer is instead armed on mount
// and on each transition into `status === "connected"`, and disarmed by the
// first well-formed snapshot on THAT connection. Chosen above
// AstridrWSContext.tsx's ACK_TIMEOUT_MS (10000ms) so a slow-but-working
// handshake cannot flap the horizon.
const SNAPSHOT_TIMEOUT_MS = 15000;

// shell-and-dashboard.md §12 / UI-SPEC: the disarm eases back through amber
// over ~2.6s ("dawn"). The component owns this timing; src/index.css owns
// the look.
const DAWN_MS = 2600;

interface EstopSnapshot {
  armed: boolean;
}

/**
 * Validity gate (this plan's <interfaces> block): `data` must be a non-null
 * object AND `typeof data.armed === "boolean"`. Anything else — missing
 * `data`, `armed` as the string `"true"`, `armed` absent entirely — is
 * MALFORMED and returns null, which the caller must treat as Unknown, never
 * as "no change" (T-125-04-03).
 */
function parseEstopPayload(event: Record<string, unknown>): EstopSnapshot | null {
  const data = (event as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) return null;
  const armed = (data as Record<string, unknown>).armed;
  if (typeof armed !== "boolean") return null;
  return { armed };
}

// ─── Aria labelling — the safety cue is not colour-only ────────────────────
// `state === "critical"` covers two distinct causes (an armed snapshot, or
// an alert-severity overlay per rule 4) that the HorizonState type does not
// distinguish; this function reads the extra `armed` flag so the announced
// text stays accurate to which one actually happened, rather than always
// claiming an E-Stop that may not be armed.
function horizonAriaLabel(state: HorizonState, armed: boolean): string {
  switch (state) {
    case "critical":
      return armed ? "Emergency stop armed" : "Critical alert";
    case "warn":
      return "System attention required";
    case "dawn":
      return "Emergency stop disarmed, returning to nominal";
    case "unknown":
      return "System state unconfirmed";
    case "offline":
      return "Telemetry offline";
    case "resting":
      return "Nominal";
  }
}

// ─── Component ───────────────────────────────────────────────────────────

export default function SignalHorizon({ alertLevel }: { alertLevel: AlertLevel }) {
  const { status, subscribeEvent } = useAstridrWS();

  const [snapshot, setSnapshot] = useState<EstopSnapshot | null>(null);
  const [dawnUntil, setDawnUntil] = useState<number | null>(null);
  // Only bumped when the dawn timer expires — resolveHorizonState's `now <
  // dawnUntil` compare only needs `now` to eventually catch up past a fresh
  // future `dawnUntil`, not to track wall-clock time continuously.
  const [now, setNow] = useState<number>(() => Date.now());

  // Mirrors `snapshot` synchronously (state updates are async) so the
  // true->false dawn-transition check inside handleFrame always compares
  // against the value from the PREVIOUS frame, not a stale render closure.
  const snapshotRef = useRef<EstopSnapshot | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dawnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const armDawn = useCallback(() => {
    if (dawnTimerRef.current) clearTimeout(dawnTimerRef.current);
    setDawnUntil(Date.now() + DAWN_MS);
    dawnTimerRef.current = setTimeout(() => {
      dawnTimerRef.current = null;
      setDawnUntil(null);
      setNow(Date.now());
    }, DAWN_MS);
  }, []);

  // The SAME parse path the WS subscription and the DEV simulation hook
  // both call — the stub must not be able to bypass validation (T-125-04-05).
  const handleFrame = useCallback(
    (event: Record<string, unknown>) => {
      try {
        const parsed = parseEstopPayload(event);
        if (parsed === null) {
          // Malformed — Unknown, never "no change" (T-125-04-03). Never
          // leave the previous value in place.
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          snapshotRef.current = null;
          setSnapshot(null);
          return;
        }
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        const wasArmed = snapshotRef.current?.armed === true;
        snapshotRef.current = parsed;
        setSnapshot(parsed);
        // Dawn only on a genuine true -> false transition on this
        // connection — a disarmed frame arriving when the machine was
        // never armed must go straight to resting.
        if (wasArmed && parsed.armed === false) {
          armDawn();
        }
      } catch {
        // A throw here runs inside AstridrWSContext's ws.onmessage fan-out
        // (:294-343) and would take down the whole telemetry stream for
        // every subscriber if rethrown (T-125-04-04). Any parse failure —
        // foreseen or not — is treated as malformed, never rethrown.
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        snapshotRef.current = null;
        setSnapshot(null);
      }
    },
    [armDawn]
  );

  useEffect(() => {
    const unsubscribe = subscribeEvent("estop_state", handleFrame);
    return unsubscribe;
  }, [subscribeEvent, handleFrame]);

  // Connect-scoped freshness timeout + reconnect invalidation. Keyed on
  // `status` so it re-runs (and thus re-arms) on mount AND on every
  // transition into "connected" — a single effect covers both, since a
  // useEffect with a dependency also fires on the initial render.
  useEffect(() => {
    if (status === "connected") {
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        // No well-formed snapshot arrived within SNAPSHOT_TIMEOUT_MS. This
        // is a fail-closed backstop, not a state-changing branch in the
        // common case (snapshot is already null here) — it guarantees
        // Unknown regardless of any future change to the reset path.
        snapshotRef.current = null;
        setSnapshot(null);
      }, SNAPSHOT_TIMEOUT_MS);
    } else {
      // Leaving "connected" (reconnecting or disconnected) invalidates any
      // snapshot inherited from the prior connection — a pre-disconnect
      // "all clear" must never survive past its own connection (D-02,
      // T-125-04-01's structural mitigation against a replayed stale frame).
      snapshotRef.current = null;
      setSnapshot(null);
    }
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [status]);

  // Dawn timer cleanup on unmount only — armDawn re-arms/clears its own
  // timer on every call, this is just the unmount safety net.
  useEffect(() => {
    return () => {
      if (dawnTimerRef.current) {
        clearTimeout(dawnTimerRef.current);
        dawnTimerRef.current = null;
      }
    };
  }, []);

  // DEV-only simulation hook (T-125-04-05). Routes through the SAME
  // handleFrame parse path as the WS handler — a malformed stub payload
  // lands in Unknown exactly like a malformed wire payload. Gated on
  // `import.meta.env.DEV`, which Vite statically replaces so the whole
  // branch is dead-code-eliminated from the production bundle (verified by
  // a build-output grep, not by reading this source).
  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") return;
    const w = window as unknown as {
      __signalHorizonStub?: (payload: Record<string, unknown>) => void;
    };
    w.__signalHorizonStub = (payload: Record<string, unknown>) => handleFrame(payload);
    return () => {
      delete w.__signalHorizonStub;
    };
  }, [handleFrame]);

  const state = resolveHorizonState({
    wsStatus: status,
    snapshot,
    dawnUntil,
    alertLevel,
    now,
  });

  return (
    <div
      className="signal-horizon"
      data-horizon-state={state}
      role="status"
      aria-label={horizonAriaLabel(state, snapshot?.armed === true)}
    />
  );
}
