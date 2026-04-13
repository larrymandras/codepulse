/**
 * useLiveState — unified transient real-time state hook with topic-based selectors.
 *
 * Manages all transient WebSocket state via useReducer. Clears all state on
 * disconnect or reconnecting (D-05, T-02-03). Validates all incoming payloads
 * before dispatching (T-02-01).
 *
 * Phase 02: RT-02, RT-03, RT-04, RT-08
 */

import { useReducer, useEffect } from "react";
import { useAstridrWS, type WSStatus } from "@/contexts/AstridrWSContext";

// ─── Types ───────────────────────────────────────────────────────────────────

export type LiveStateSlice = {
  agentStatus: "idle" | "running" | "paused" | null;
  activeRunId: string | null;
  activeRunProgress: number | null;
  liveMetricDeltas: Record<string, number>;
  connectionHealth: WSStatus;
};

type LiveStateAction =
  | { type: "SET_AGENT_STATUS"; payload: LiveStateSlice["agentStatus"] }
  | { type: "SET_ACTIVE_RUN"; payload: { id: string | null; progress: number | null } }
  | { type: "SET_METRIC_DELTA"; payload: { key: string; value: number } }
  | { type: "SET_CONNECTION_HEALTH"; payload: WSStatus }
  | { type: "CLEAR_ALL" };

const INITIAL_STATE: LiveStateSlice = {
  agentStatus: null,
  activeRunId: null,
  activeRunProgress: null,
  liveMetricDeltas: {},
  connectionHealth: "disconnected",
};

// ─── Reducer ─────────────────────────────────────────────────────────────────

function liveStateReducer(state: LiveStateSlice, action: LiveStateAction): LiveStateSlice {
  switch (action.type) {
    case "SET_AGENT_STATUS":
      return { ...state, agentStatus: action.payload };
    case "SET_ACTIVE_RUN":
      return {
        ...state,
        activeRunId: action.payload.id,
        activeRunProgress: action.payload.progress,
      };
    case "SET_METRIC_DELTA":
      return {
        ...state,
        liveMetricDeltas: {
          ...state.liveMetricDeltas,
          [action.payload.key]: action.payload.value,
        },
      };
    case "SET_CONNECTION_HEALTH":
      return { ...state, connectionHealth: action.payload };
    case "CLEAR_ALL":
      // Preserve connectionHealth — it is updated by a separate SET_CONNECTION_HEALTH dispatch
      return { ...INITIAL_STATE, connectionHealth: state.connectionHealth };
    default:
      return state;
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

const VALID_AGENT_STATUSES = new Set(["idle", "running", "paused"]);

interface UseLiveStateOptions {
  /** Topics to activate subscriptions for. Pass a stable (memoized) array. */
  topics: string[];
}

export function useLiveState({ topics }: UseLiveStateOptions): {
  state: LiveStateSlice;
  isLive: boolean;
} {
  const { status: wsStatus, subscribeEvent } = useAstridrWS();
  const [state, dispatch] = useReducer(liveStateReducer, {
    ...INITIAL_STATE,
    connectionHealth: wsStatus,
  });

  // Effect 1: sync connection health + clear stale data on disconnect/reconnecting (D-05, T-02-03)
  useEffect(() => {
    if (wsStatus !== "connected") {
      dispatch({ type: "CLEAR_ALL" });
    }
    dispatch({ type: "SET_CONNECTION_HEALTH", payload: wsStatus });
  }, [wsStatus]);

  // Effect 2: agents topic — subscribe to agent_status_change events
  useEffect(() => {
    if (!topics.includes("agents")) return;

    const unsubscribe = subscribeEvent("agent_status_change", (msg) => {
      // T-02-01: validate payload before dispatch
      const data = msg.data as Record<string, unknown> | undefined;
      if (!data || typeof data !== "object") return;
      const status = data.status;
      if (!VALID_AGENT_STATUSES.has(status as string)) return;
      dispatch({
        type: "SET_AGENT_STATUS",
        payload: status as LiveStateSlice["agentStatus"],
      });
    });

    return unsubscribe;
  }, [topics, subscribeEvent]);

  // Effect 3: health topic — subscribe to metric_delta events
  useEffect(() => {
    if (!topics.includes("health")) return;

    const unsubscribe = subscribeEvent("metric_delta", (msg) => {
      // T-02-01: validate payload
      const data = msg.data as Record<string, unknown> | undefined;
      if (!data || typeof data !== "object") return;
      if (typeof data.key !== "string" || typeof data.value !== "number") return;
      dispatch({
        type: "SET_METRIC_DELTA",
        payload: { key: data.key, value: data.value },
      });
    });

    return unsubscribe;
  }, [topics, subscribeEvent]);

  // Effect 4: live-runs topic — subscribe to run lifecycle events
  useEffect(() => {
    if (!topics.includes("live-runs")) return;

    const unsubStarted = subscribeEvent("run.started", (msg) => {
      const data = msg.data as Record<string, unknown> | undefined;
      const id = typeof data?.id === "string" ? data.id : null;
      dispatch({ type: "SET_ACTIVE_RUN", payload: { id, progress: 0 } });
    });

    const unsubCompleted = subscribeEvent("run.completed", () => {
      dispatch({ type: "SET_ACTIVE_RUN", payload: { id: null, progress: null } });
    });

    return () => {
      unsubStarted();
      unsubCompleted();
    };
  }, [topics, subscribeEvent]);

  return {
    state,
    isLive: state.connectionHealth === "connected",
  };
}
