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

// In dev, when Vite swaps this module, tear down the old module's socket so it
// can't keep reconnecting as a zombie behind the replacement module.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    moduleConnecting = false;
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
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    moduleConnecting = true;

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
      retryCountRef.current = 0;

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
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);

    retryCountRef.current += 1;
    if (retryCountRef.current > MAX_RETRIES) {
      console.warn(
        "Ástríðr backend unavailable — live telemetry disabled. Restart to reconnect."
      );
      setStatusSync("disconnected");
      return;
    }

    setStatusSync("reconnecting");
    const delay = Math.min(
      BASE_BACKOFF_MS * Math.pow(2, retryCountRef.current - 1),
      MAX_BACKOFF_MS
    );
    retryTimerRef.current = setTimeout(() => {
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
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
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
    // Clear any pending retry timer
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    // Reset retry count so reconnect gets full backoff budget
    retryCountRef.current = 0;
    // Signal reconnecting state then open fresh connection
    setStatusSync("reconnecting");
    connect();
  }, [connect, setStatusSync]);

  return (
    <AstridrWSContext.Provider value={{ status, sendCommand, subscribe, subscribeEvent, reconnect }}>
      {children}
    </AstridrWSContext.Provider>
  );
}
