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
const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;
const ACK_TIMEOUT_MS = 10000;

interface QueuedCommand {
  cmd: Record<string, unknown>;
  resolve: (value: AckResponse) => void;
  reject: (reason: Error) => void;
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

    const wsUrl = (import.meta.env.VITE_ASTRIDR_WS_URL as string | undefined) ?? "ws://localhost:8765";
    const apiKey = (import.meta.env.VITE_ASTRIDR_API_KEY as string | undefined) ?? "";
    const url = `${wsUrl}/ws/telemetry?api_key=${encodeURIComponent(apiKey)}`;

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      scheduleRetry();
      return;
    }

    wsRef.current = ws;

    ws.onopen = () => {
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
      if (!mountedRef.current) return;
      rejectAllPending("connection closed");
      scheduleRetry();
    };

    ws.onerror = () => {
      // onclose fires after onerror — let onclose handle retry
    };
  }, [flushCommandQueue, rejectAllPending, setStatusSync]); // eslint-disable-line react-hooks/exhaustive-deps

  const scheduleRetry = useCallback(() => {
    if (!mountedRef.current) return;
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);

    retryCountRef.current += 1;
    if (retryCountRef.current > MAX_RETRIES) {
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

  // Initial connection
  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      rejectAllPending("component unmounted");
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent retry on intentional close
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Public API ─────────────────────────────────────────────────────────────

  const sendCommand = useCallback(
    (cmd: Record<string, unknown>): Promise<AckResponse> => {
      return new Promise<AckResponse>((resolve, reject) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          // Queue for when connection is restored
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

  return (
    <AstridrWSContext.Provider value={{ status, sendCommand, subscribe, subscribeEvent }}>
      {children}
    </AstridrWSContext.Provider>
  );
}
