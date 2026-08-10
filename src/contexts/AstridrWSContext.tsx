/**
 * AstridrWSContext — single shared WebSocket connection to Ástríðr /ws/telemetry.
 *
 * Provides subscribe/sendCommand/status to all panels via React context.
 * One connection is maintained for the entire app lifetime — navigating
 * between panels does not open/close connections.
 *
 * Phase 56: CPCC-01 through CPCC-07 foundation.
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
// VOICE_DEBUG_ENABLED (188.4-02, D-09) — the exported alias for the private
// VOICE_DEBUG const in useAstridrVoice.ts, gating __astridrInjectForeignSessionBlocks
// below exactly like that file's own debug-gated window instruments.
// Confirmed live 2026-08-10: this file previously imported nothing from
// useAstridrVoice.ts, and useAstridrVoice.ts imports nothing from this file —
// no import cycle (re-verified via `npx tsc --noEmit` after adding this).
import { VOICE_DEBUG_ENABLED } from "@/hooks/useAstridrVoice";

// ─── Types ───────────────────────────────────────────────────────────────────

export type WSStatus = "connected" | "reconnecting" | "disconnected";
type TopicCallback = (event: Record<string, unknown>) => void;

interface PendingAck {
  resolve: (value: AckResponse) => void;
  reject: (reason: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export interface AckResponse {
  type: "ack";
  request_id: string;
  status: "ok" | "error";
  error?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

interface AstridrWSContextValue {
  status: WSStatus;
  sendCommand: (cmd: Record<string, unknown>) => Promise<AckResponse>;
  subscribe: (topic: string, callback: TopicCallback) => () => void;
  subscribeEvent: (eventType: string, callback: TopicCallback) => () => void;
  reconnect: () => void;
}

// ─── Topic → event_type mapping (mirrors TOPIC_EVENT_MAP in ws_telemetry.py) ─

const TOPIC_EVENT_MAP: Record<string, Set<string>> = {
  health: new Set([
    "health_check",
    "docker_status",
    "supabase_health",
    "self_healing",
    "heartbeat_alerts",
    "mcp_connection",
    "context_cache",
  ]),
  security: new Set(["security_event", "secret_ref_event"]),
  executions: new Set([
    "command_execution",
    "pipeline_execution",
    "job_lifecycle",
    "worktree_event",
    "pipe_execution",
  ]),
  agents: new Set([
    "agent_coordination",
    "agent_lifecycle",
    "agent_created",
    "agent_destroyed",
    "agent_status_change",
    "approval_request",
  ]),
  "live-runs": new Set([
    "run.started",
    "run.thinking",
    "run.tool_call",
    "run.text",
    "run.completed",
    "run.error",
    "run.cancelled",
    "run.blocks",
    "chat.response",
  ]),
};

// Build reverse map: event_type -> set of topics
const EVENT_TO_TOPICS = new Map<string, Set<string>>();
for (const [topic, events] of Object.entries(TOPIC_EVENT_MAP)) {
  for (const evt of events) {
    if (!EVENT_TO_TOPICS.has(evt)) EVENT_TO_TOPICS.set(evt, new Set());
    EVENT_TO_TOPICS.get(evt)!.add(topic);
  }
}

// ─── Debug trace (188.4-02, D-08) ───────────────────────────────────────────
// Mirrors useAstridrVoice.ts's private `trace()` helper (:207-215) exactly —
// that function is not exported, so this file needs its own copy to push
// onto the SAME window.__astridrVoiceTrace ring buffer, the established
// disclosure channel for every debug-gated instrument in this phase.
function debugTrace(ev: string, d?: unknown) {
  if (!VOICE_DEBUG_ENABLED || typeof window === "undefined") return;
  const entry = { t: new Date().toISOString().slice(11, 23), ev, d };
  // eslint-disable-next-line no-console
  console.log(`[voice] ${entry.t} ${ev}`, d ?? "");
  const buf = (window.__astridrVoiceTrace ??= []);
  buf.push(entry);
  if (buf.length > 500) buf.shift();
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AstridrWSContext = createContext<AstridrWSContextValue | null>(null);

export function useAstridrWS(): AstridrWSContextValue {
  const ctx = useContext(AstridrWSContext);
  if (!ctx) throw new Error("useAstridrWS must be used within AstridrWSProvider");
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

const ALL_TOPICS = ["live-runs", "agents", "executions", "health", "security"];
const MAX_RETRIES = 10;
const BASE_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 15000;
const ACK_TIMEOUT_MS = 10000;
const MAX_QUEUE_DEPTH = 50;
// Storm guards (Phase 157 fix). A connection must stay OPEN at least this long before
// its success is allowed to reset the backoff counter. Without this, a flapping server
// (accept → quick drop, e.g. during agent restarts/rebuilds) resets retryCount on every
// onopen, so the backoff never grows and the client reconnects forever at BASE_BACKOFF
// spacing → the console connection storm.
const STABLE_RESET_MS = 10000;
// Hard floor between socket-creation attempts — a structural storm-stopper even if
// multiple provider instances or accumulated HMR module versions slip past the singleton.
const MIN_CONNECT_INTERVAL_MS = 1500;

interface QueuedCommand {
  cmd: Record<string, unknown>;
  resolve: (value: AckResponse) => void;
  reject: (reason: Error) => void;
}

// ─── Module-level singleton guard ─────────────────────────────────────────────
// Reconnect state lives at MODULE scope (not per-component-instance) so that:
//   - duplicate AstridrWSProvider mounts share ONE connection, not N parallel
//     retry chains, and
//   - an in-flight/open socket is never duplicated by a re-entrant connect().
// Without this, remounts (or, in dev, accumulated HMR module versions) each ran
// their own unbounded chain → hundreds of sockets → "Insufficient resources".
let moduleSocket: WebSocket | null = null;
let moduleConnecting = false;
// Reconnect/backoff state at MODULE scope (not per-component-instance) so duplicate
// provider mounts and accumulated HMR module versions share ONE retry chain — not N
// parallel chains, which was a primary multiplier of the connection storm.
let moduleRetryCount = 0;
let moduleRetryTimer: ReturnType<typeof setTimeout> | null = null;
let moduleStableTimer: ReturnType<typeof setTimeout> | null = null;
let moduleLastAttemptAt = 0;

// In dev, when Vite swaps this module, tear down the old module's socket so it
// can't keep reconnecting as a zombie behind the replacement module.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    moduleConnecting = false;
    if (moduleRetryTimer) { clearTimeout(moduleRetryTimer); moduleRetryTimer = null; }
    if (moduleStableTimer) { clearTimeout(moduleStableTimer); moduleStableTimer = null; }
    if (moduleSocket) {
      moduleSocket.onclose = null;
      moduleSocket.onerror = null;
      try {
        moduleSocket.close();
      } catch {
        /* already closing */
      }
      moduleSocket = null;
    }
  });
}

export function AstridrWSProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<WSStatus>("reconnecting");

  // Stable refs — never cause re-renders
  const wsRef = useRef<WebSocket | null>(null);
  const pendingAcksRef = useRef<Map<string, PendingAck>>(new Map());
  const topicSubsRef = useRef<Map<string, Set<TopicCallback>>>(new Map());
  const eventSubsRef = useRef<Map<string, Set<TopicCallback>>>(new Map());
  const commandQueueRef = useRef<QueuedCommand[]>([]);
  const mountedRef = useRef(true);

  // Use refs for callbacks to avoid stale closures
  const statusRef = useRef<WSStatus>("reconnecting");
  const setStatusSync = useCallback((s: WSStatus) => {
    statusRef.current = s;
    setStatus(s);
  }, []);

  const rejectAllPending = useCallback((reason: string) => {
    for (const [, pending] of pendingAcksRef.current) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(reason));
    }
    pendingAcksRef.current.clear();
  }, []);

  const flushCommandQueue = useCallback((ws: WebSocket) => {
    const queue = commandQueueRef.current.splice(0);
    for (const { cmd, resolve, reject } of queue) {
      const requestId = crypto.randomUUID();
      const payload = { ...cmd, request_id: requestId };
      const timeout = setTimeout(() => {
        pendingAcksRef.current.delete(requestId);
        reject(new Error("Command timeout"));
      }, ACK_TIMEOUT_MS);
      pendingAcksRef.current.set(requestId, { resolve, reject, timeout });
      ws.send(JSON.stringify(payload));
    }
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    // Singleton guard: never open a second socket while one is already connecting
    // or open. This is the core storm-stopper — re-entrant connect() calls (from
    // duplicate mounts / fast retries) become no-ops instead of new sockets.
    if (moduleConnecting) return;
    if (
      moduleSocket &&
      (moduleSocket.readyState === WebSocket.CONNECTING ||
        moduleSocket.readyState === WebSocket.OPEN)
    ) {
      return;
    }
    // Hard min-interval floor: drop redundant connect() calls (duplicate mounts,
    // reconnect spam) that arrive within MIN_CONNECT_INTERVAL_MS of the last attempt.
    // The legitimate retry chain (scheduleRetry, ≥ BASE_BACKOFF_MS apart) is never blocked.
    if (Date.now() - moduleLastAttemptAt < MIN_CONNECT_INTERVAL_MS) return;
    moduleConnecting = true;
    moduleLastAttemptAt = Date.now();

    const wsUrl = (import.meta.env.VITE_ASTRIDR_WS_URL as string | undefined) ?? "ws://localhost:8181";
    const url = `${wsUrl}/ws/telemetry`;

    const apiKey = (import.meta.env.VITE_ASTRIDR_API_KEY as string | undefined) ?? "";
    const protocols = apiKey
      ? [`bearer.${btoa(apiKey).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`]
      : undefined;

    let ws: WebSocket;
    try {
      ws = new WebSocket(url, protocols);
    } catch {
      moduleConnecting = false;
      scheduleRetry();
      return;
    }

    wsRef.current = ws;
    moduleSocket = ws;

    ws.onopen = () => {
      moduleConnecting = false;
      if (!mountedRef.current) { ws.close(); return; }
      // Stability-gated backoff reset: only clear the retry counter once the connection
      // has stayed OPEN for STABLE_RESET_MS. A flapping socket that drops sooner leaves
      // the counter climbing, so the backoff grows and MAX_RETRIES eventually caps it
      // (→ "disconnected") instead of an infinite tight reconnect loop / console storm.
      if (moduleStableTimer) clearTimeout(moduleStableTimer);
      moduleStableTimer = setTimeout(() => {
        moduleStableTimer = null;
        moduleRetryCount = 0;
      }, STABLE_RESET_MS);

      setStatusSync("connected");

      // Subscribe to all topics
      ws.send(JSON.stringify({ action: "subscribe", topics: ALL_TOPICS }));

      // Flush queued commands
      flushCommandQueue(ws);
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(event.data) as Record<string, unknown>;
      } catch {
        return;
      }

      // Ack resolution
      if (msg.type === "ack") {
        const ack = msg as unknown as AckResponse;
        const pending = pendingAcksRef.current.get(ack.request_id);
        if (pending) {
          clearTimeout(pending.timeout);
          pendingAcksRef.current.delete(ack.request_id);
          if (ack.status === "ok") {
            pending.resolve(ack);
          } else {
            pending.reject(new Error(ack.error ?? "Command failed"));
          }
        }
        return;
      }

      // Event fan-out
      const eventType = msg.event_type as string | undefined;
      if (!eventType) return;

      // Fan out to event-level subscribers
      const eventSubs = eventSubsRef.current.get(eventType);
      if (eventSubs) {
        for (const cb of eventSubs) cb(msg);
      }

      // Fan out to topic-level subscribers
      const topics = EVENT_TO_TOPICS.get(eventType);
      if (topics) {
        for (const topic of topics) {
          const subs = topicSubsRef.current.get(topic);
          if (subs) {
            for (const cb of subs) cb(msg);
          }
        }
      } else {
        // Unknown event type — deliver to all topic subscribers (best-effort)
        for (const [, subs] of topicSubsRef.current) {
          for (const cb of subs) cb(msg);
        }
      }
    };

    ws.onclose = () => {
      moduleConnecting = false;
      if (moduleSocket === ws) moduleSocket = null;
      // Cancel the pending stability reset — this socket did not survive long enough,
      // so its backoff counter must keep climbing (no reset).
      if (moduleStableTimer) { clearTimeout(moduleStableTimer); moduleStableTimer = null; }
      if (!mountedRef.current) return;
      rejectAllPending("connection closed");
      scheduleRetry();
    };

    ws.onerror = () => {
      // onclose fires after onerror — let onclose handle retry.
    };
  }, [flushCommandQueue, rejectAllPending, setStatusSync]); // eslint-disable-line react-hooks/exhaustive-deps

  const scheduleRetry = useCallback(() => {
    if (!mountedRef.current) return;
    if (moduleRetryTimer) clearTimeout(moduleRetryTimer);

    moduleRetryCount += 1;
    if (moduleRetryCount > MAX_RETRIES) {
      console.warn(
        "Ástríðr backend unavailable — live telemetry disabled. Restart to reconnect."
      );
      setStatusSync("disconnected");
      return;
    }

    setStatusSync("reconnecting");
    const delay = Math.min(
      BASE_BACKOFF_MS * Math.pow(2, moduleRetryCount - 1),
      MAX_BACKOFF_MS
    );
    moduleRetryTimer = setTimeout(() => {
      moduleRetryTimer = null;
      if (mountedRef.current) connect();
    }, delay);
  }, [connect, setStatusSync]);

  // Initial connection — delayed to survive React StrictMode double-mount.
  // StrictMode runs mount→cleanup→remount synchronously; without the delay
  // the first mount creates a WebSocket that gets closed mid-handshake,
  // causing the browser to throttle subsequent connections to the same URL.
  useEffect(() => {
    mountedRef.current = true;
    const connectTimer = setTimeout(() => connect(), 50);
    return () => {
      mountedRef.current = false;
      clearTimeout(connectTimer);
      if (moduleRetryTimer) { clearTimeout(moduleRetryTimer); moduleRetryTimer = null; }
      if (moduleStableTimer) { clearTimeout(moduleStableTimer); moduleStableTimer = null; }
      rejectAllPending("component unmounted");
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      moduleConnecting = false;
      if (moduleSocket) {
        moduleSocket.onclose = null;
        moduleSocket.close();
        moduleSocket = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Public API ─────────────────────────────────────────────────────────────

  const sendCommand = useCallback(
    (cmd: Record<string, unknown>): Promise<AckResponse> => {
      return new Promise<AckResponse>((resolve, reject) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          // Queue for when connection is restored, but cap depth to avoid unbounded growth
          if (commandQueueRef.current.length >= MAX_QUEUE_DEPTH) {
            reject(new Error("Command queue full — too many pending commands while disconnected"));
            return;
          }
          commandQueueRef.current.push({ cmd, resolve, reject });
          return;
        }

        const requestId = crypto.randomUUID();
        const payload = { ...cmd, request_id: requestId };
        const timeout = setTimeout(() => {
          pendingAcksRef.current.delete(requestId);
          reject(new Error("Command timeout"));
        }, ACK_TIMEOUT_MS);
        pendingAcksRef.current.set(requestId, { resolve, reject, timeout });
        ws.send(JSON.stringify(payload));
      });
    },
    []
  );

  const subscribe = useCallback(
    (topic: string, callback: TopicCallback): (() => void) => {
      if (!topicSubsRef.current.has(topic)) {
        topicSubsRef.current.set(topic, new Set());
      }
      topicSubsRef.current.get(topic)!.add(callback);
      return () => {
        topicSubsRef.current.get(topic)?.delete(callback);
      };
    },
    []
  );

  const subscribeEvent = useCallback(
    (eventType: string, callback: TopicCallback): (() => void) => {
      if (!eventSubsRef.current.has(eventType)) {
        eventSubsRef.current.set(eventType, new Set());
      }
      eventSubsRef.current.get(eventType)!.add(callback);
      return () => {
        eventSubsRef.current.get(eventType)?.delete(callback);
      };
    },
    []
  );

  const reconnect = useCallback(() => {
    // Close existing WebSocket if open
    if (wsRef.current) {
      wsRef.current.onclose = null; // prevent scheduleRetry from firing
      wsRef.current.close();
      wsRef.current = null;
    }
    moduleConnecting = false;
    moduleSocket = null;
    // Clear any pending retry/stability timers
    if (moduleRetryTimer) { clearTimeout(moduleRetryTimer); moduleRetryTimer = null; }
    if (moduleStableTimer) { clearTimeout(moduleStableTimer); moduleStableTimer = null; }
    // Reset retry count + attempt clock so a user-initiated reconnect gets a fresh
    // full backoff budget and is not dropped by the min-interval floor.
    moduleRetryCount = 0;
    moduleLastAttemptAt = 0;
    // Signal reconnecting state then open fresh connection
    setStatusSync("reconnecting");
    connect();
  }, [connect, setStatusSync]);

  // ─── D-08 (188.4-02) — foreign-session injector on the real event bus ──────
  // Publishes a synthetic `run.blocks` frame through the SAME eventSubsRef
  // fan-out (:313-317 below) a real WS frame arrives on, carrying a foreign
  // session_id — exercising the D-10 session gate
  // (useAstridrChat.ts:285-307), the lastSessionRef comparison, and the
  // fail-open branch exactly as production does. This is the closest
  // reachable substitute for the two-session setup 188.3 could not stage
  // (188.4-CONTEXT.md D-08).
  //
  // Does NOT call useAstridrChat's run.blocks handler directly, and does NOT
  // add a `publish` entry to this provider's public context value — D-08
  // rejected the direct-call route by name: it skips the subscription/
  // dispatch layer and would prove only the gate's logic, a WEAKER claim
  // than the existing fixtures already make.
  //
  // Scope note (D-08a): this instrument makes UAT-8 reachable. It does NOT
  // close UAT-8 by itself — that is 188.4-04's live checkpoint.
  //
  // Debug-gated on VOICE_DEBUG_ENABLED (imported — the private VOICE_DEBUG
  // const in useAstridrVoice.ts is not exported), same useEffect + window
  // attach + cleanup delete shape as __astridrForceRecognizerReset /
  // __astridrInjectForeignFinal.
  useEffect(() => {
    if (!VOICE_DEBUG_ENABLED || typeof window === "undefined") return;
    const w = window as unknown as {
      __astridrInjectForeignSessionBlocks?: (sessionId?: string, text?: string) => void;
    };
    w.__astridrInjectForeignSessionBlocks = (
      sessionId: string = "debug-foreign-session-9x7q2",
      text: string = "[debug injected foreign-session block]"
    ) => {
      const eventType = "run.blocks";
      // Shape mirrors a real backend frame: event_type + a data envelope
      // carrying session_id/blocks (useAstridrChat.ts:286-288 unwraps
      // `event.data ?? event`).
      const message = {
        event_type: eventType,
        data: {
          session_id: sessionId,
          blocks: [{ type: "text", text }],
        },
      };
      const eventSubs = eventSubsRef.current.get(eventType);
      // The subscriber count matters: a zero here means the injection
      // reached nobody, which reads identically to a correctly-gated drop
      // unless it is recorded (T-188.4-07).
      debugTrace("debug.inject-foreign-session-blocks", {
        sessionId,
        subscriberCount: eventSubs ? eventSubs.size : 0,
        traceLengthBefore: (window.__astridrVoiceTrace ?? []).length,
      });
      if (eventSubs) {
        for (const cb of eventSubs) cb(message);
      }
    };
    return () => {
      delete w.__astridrInjectForeignSessionBlocks;
    };
  }, []);

  return (
    <AstridrWSContext.Provider value={{ status, sendCommand, subscribe, subscribeEvent, reconnect }}>
      {children}
    </AstridrWSContext.Provider>
  );
}
