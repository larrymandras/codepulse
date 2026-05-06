import { useState, useEffect, useCallback } from "react";
import { useAstridrWS } from "../contexts/AstridrWSContext";
import { useRecentAgentStatus } from "../hooks/useAgentStatus";
import { AGENT_ROSTER } from "../lib/agentRoster";
import AgentStatusTile, { type AgentState } from "./AgentStatusTile";
import InfoTooltip from "./InfoTooltip";
import { relativeTime } from "../lib/formatters";

const IDLE_THRESHOLD_MS = 5 * 60 * 1000;

interface AgentEvent {
  agentId: string;
  state: string;
  currentTask?: string;
  errorCount?: number;
  timestamp: number;
}

function deriveState(event: AgentEvent | undefined, now: number): AgentState {
  if (!event) return "idle";
  if (now - event.timestamp * 1000 > IDLE_THRESHOLD_MS) return "idle";
  const s = event.state as AgentState;
  if (s === "active" || s === "waiting" || s === "recent") return s;
  return "idle";
}

export default function StatusHeartbeatGrid() {
  const recentEvents = useRecentAgentStatus();
  const { subscribeEvent } = useAstridrWS();
  const [liveStates, setLiveStates] = useState<Record<string, AgentEvent>>({});
  const [now, setNow] = useState(Date.now());
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const unsub = subscribeEvent("agent_status", (e) => {
      const agentId = (e.agentId ?? e.agent_id ?? "unknown") as string;
      setLiveStates((prev) => ({
        ...prev,
        [agentId]: {
          agentId,
          state: (e.state as string) ?? "idle",
          currentTask: (e.currentTask ?? e.current_task) as string | undefined,
          errorCount: (e.errorCount ?? e.error_count) as number | undefined,
          timestamp: (e.timestamp as number) ?? Date.now() / 1000,
        },
      }));
    });
    return unsub;
  }, [subscribeEvent]);

  const getLatestEvent = useCallback(
    (agentId: string): AgentEvent | undefined => {
      const live = liveStates[agentId];
      const convex = recentEvents.find((e) => e.agentId === agentId);
      if (!live && !convex) return undefined;
      if (!live) return convex as AgentEvent;
      if (!convex) return live;
      return live.timestamp >= (convex as AgentEvent).timestamp ? live : (convex as AgentEvent);
    },
    [liveStates, recentEvents]
  );

  const selectedAgent = AGENT_ROSTER.find((a) => a.id === selectedAgentId);
  const selectedEvent = selectedAgentId ? getLatestEvent(selectedAgentId) : undefined;
  const agentHistory = selectedAgentId
    ? recentEvents.filter((e) => e.agentId === selectedAgentId).slice(0, 5)
    : [];

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">
        Agent Status <InfoTooltip text="Real-time status of all configured Astridr agent types. Tiles pulse when active." />
      </h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-3">
        {AGENT_ROSTER.map((agent) => {
          const event = getLatestEvent(agent.id);
          const state = deriveState(event, now);
          return (
            <AgentStatusTile
              key={agent.id}
              agentId={agent.id}
              agentName={agent.name}
              state={state}
              currentTask={event?.currentTask}
              selected={selectedAgentId === agent.id}
              onClick={() => setSelectedAgentId((prev) => (prev === agent.id ? null : agent.id))}
            />
          );
        })}
      </div>
      {selectedAgentId && selectedAgent && (
        <div className="mt-3 bg-gray-900/50 border border-gray-700/40 rounded-lg px-4 py-3 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-200">{selectedAgent.name} Detail</h3>
            <button onClick={() => setSelectedAgentId(null)} className="text-gray-500 hover:text-gray-300 text-xs">Close</button>
          </div>
          <div className="space-y-1 text-xs text-gray-400">
            <p>Current Task: {selectedEvent?.currentTask ?? "None"}</p>
            <p>Error Count: {selectedEvent?.errorCount ?? 0}</p>
            <p className="text-[10px] text-gray-500 mt-2">Last 5 heartbeats:</p>
            {agentHistory.length === 0 ? (
              <p className="text-[10px] text-gray-600">No heartbeat history</p>
            ) : (
              <ul className="space-y-0.5">
                {agentHistory.map((e, i) => (
                  <li key={i} className="text-[10px] text-gray-500">
                    {e.state} — {relativeTime(e.timestamp)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
