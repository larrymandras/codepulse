import { useMemo, useRef, useState } from "react";
import { usePrivacyMask } from "../hooks/usePrivacyMask";

interface Agent {
  agentId: string;
  agentType: string;
  status: string;
  startedAt: number;
  endedAt?: number;
  model?: string;
}

interface Event {
  _id: string;
  eventType: string;
  toolName?: string;
  filePath?: string;
  payload?: any;
  timestamp: number;
}

interface Props {
  events: Event[];
  agents: Agent[];
  sessionStart: number;
}

const EVENT_COLORS: Record<string, string> = {
  ToolUse: "#6366f1",
  Write: "#22c55e",
  Edit: "#eab308",
  Read: "#3b82f6",
  Bash: "#f97316",
  SubagentStart: "#a855f7",
  SubagentStop: "#a855f7",
  Error: "#ef4444",
  ToolError: "#ef4444",
  UserPrompt: "#06b6d4",
  SessionStart: "#6b7280",
  SessionEnd: "#6b7280",
  Prompt: "#06b6d4",
};

const STATUS_COLORS: Record<string, string> = {
  running: "#22c55e",
  completed: "#eab308",
  failed: "#ef4444",
};

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h${Math.floor((seconds % 3600) / 60)}m`;
}

export default function GanttTimeline({ events, agents, sessionStart }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredEvent, setHoveredEvent] = useState<Event | null>(null);
  const { redact } = usePrivacyMask();

  const now = Date.now() / 1000;

  const { timeRange, agentLanes, orphanLane, ticks } = useMemo(() => {
    const allTimestamps = events.map((e) => e.timestamp);
    const agentStarts = agents.map((a) => a.startedAt);
    const agentEnds = agents.filter((a) => a.endedAt).map((a) => a.endedAt!);
    const all = [...allTimestamps, ...agentStarts, ...agentEnds, sessionStart];

    const minTs = Math.min(...all);
    const maxTs = Math.max(...all, now);
    const range = Math.max(maxTs - minTs, 1);

    // Map events to agents via payload.agentId
    const agentEventMap = new Map<string, Event[]>();
    const orphanEvents: Event[] = [];

    for (const e of events) {
      const agentId = e.payload?.agentId;
      if (agentId && agents.some((a) => a.agentId === agentId)) {
        if (!agentEventMap.has(agentId)) agentEventMap.set(agentId, []);
        agentEventMap.get(agentId)!.push(e);
      } else {
        orphanEvents.push(e);
      }
    }

    // Sort agents: main (no parent) first, then by start time
    const sortedAgents = [...agents].sort((a, b) => a.startedAt - b.startedAt);

    const lanes = sortedAgents.map((agent) => ({
      agent,
      events: agentEventMap.get(agent.agentId) ?? [],
    }));

    // Generate tick marks
    const tickCount = 8;
    const tickArr: { pos: number; label: string }[] = [];
    for (let i = 0; i <= tickCount; i++) {
      const t = minTs + (range * i) / tickCount;
      tickArr.push({
        pos: ((t - minTs) / range) * 100,
        label: formatTime(t - minTs),
      });
    }

    return {
      timeRange: { min: minTs, max: maxTs, range },
      agentLanes: lanes,
      orphanLane: orphanEvents,
      ticks: tickArr,
    };
  }, [events, agents, sessionStart, now]);

  const toPercent = (ts: number) =>
    ((ts - timeRange.min) / timeRange.range) * 100;

  const ROW_HEIGHT = 36;
  const totalLanes = agentLanes.length + (orphanLane.length > 0 ? 1 : 0);

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-300">Gantt Timeline</h2>
        <div className="flex items-center gap-3 flex-wrap">
          {Object.entries(EVENT_COLORS)
            .filter(([k]) => !["SessionStart", "SessionEnd"].includes(k))
            .slice(0, 6)
            .map(([name, color]) => (
              <span key={name} className="flex items-center gap-1 text-[9px] text-gray-500">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                {name}
              </span>
            ))}
        </div>
      </div>

      {totalLanes === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">No agent data for Gantt view</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Time axis */}
            <div className="flex items-end ml-28 h-6 relative border-b border-gray-700/30 mb-1">
              {ticks.map((tick, i) => (
                <span
                  key={i}
                  className="absolute text-[9px] text-gray-600 font-mono"
                  style={{ left: `${tick.pos}%`, transform: "translateX(-50%)" }}
                >
                  {tick.label}
                </span>
              ))}
            </div>

            {/* Swim lanes */}
            <div ref={containerRef} className="relative">
              {agentLanes.map(({ agent, events: laneEvents }, li) => {
                const agentStart = toPercent(agent.startedAt);
                const agentEnd = toPercent(agent.endedAt ?? now);
                const barColor = STATUS_COLORS[agent.status] ?? "#6b7280";

                return (
                  <div
                    key={agent.agentId}
                    className="flex items-center group"
                    style={{ height: ROW_HEIGHT }}
                  >
                    {/* Agent label */}
                    <div className="w-28 shrink-0 pr-2 flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: barColor }}
                      />
                      <span className="text-[10px] text-gray-300 font-mono truncate">
                        {redact(agent.agentId, `A-${agent.agentId.slice(-4)}`)}
                      </span>
                    </div>

                    {/* Lane */}
                    <div className="flex-1 relative h-full">
                      {/* Grid line */}
                      <div className="absolute inset-x-0 top-1/2 h-px bg-gray-700/20" />

                      {/* Agent lifespan bar */}
                      <div
                        className="absolute h-3 rounded-sm opacity-20 top-1/2 -translate-y-1/2"
                        style={{
                          left: `${agentStart}%`,
                          width: `${Math.max(agentEnd - agentStart, 0.3)}%`,
                          backgroundColor: barColor,
                        }}
                      />

                      {/* Event markers */}
                      {laneEvents.map((e) => {
                        const pos = toPercent(e.timestamp);
                        const color = EVENT_COLORS[e.eventType] ?? "#6b7280";
                        return (
                          <div
                            key={e._id}
                            className="absolute top-1/2 -translate-y-1/2 cursor-pointer"
                            style={{ left: `${pos}%` }}
                            onMouseEnter={() => setHoveredEvent(e)}
                            onMouseLeave={() => setHoveredEvent(null)}
                          >
                            <div
                              className="w-2 h-2 rounded-full -ml-1 hover:scale-150 transition-transform"
                              style={{
                                backgroundColor: color,
                                boxShadow: `0 0 4px ${color}80`,
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Orphan events lane (no agent) */}
              {orphanLane.length > 0 && (
                <div className="flex items-center" style={{ height: ROW_HEIGHT }}>
                  <div className="w-28 shrink-0 pr-2">
                    <span className="text-[10px] text-gray-500">session</span>
                  </div>
                  <div className="flex-1 relative h-full">
                    <div className="absolute inset-x-0 top-1/2 h-px bg-gray-700/20" />
                    {orphanLane.map((e) => {
                      const pos = toPercent(e.timestamp);
                      const color = EVENT_COLORS[e.eventType] ?? "#6b7280";
                      return (
                        <div
                          key={e._id}
                          className="absolute top-1/2 -translate-y-1/2 cursor-pointer"
                          style={{ left: `${pos}%` }}
                          onMouseEnter={() => setHoveredEvent(e)}
                          onMouseLeave={() => setHoveredEvent(null)}
                        >
                          <div
                            className="w-2 h-2 rounded-full -ml-1 hover:scale-150 transition-transform"
                            style={{
                              backgroundColor: color,
                              boxShadow: `0 0 4px ${color}80`,
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Hover tooltip */}
            {hoveredEvent && (
              <div className="mt-2 bg-gray-900/90 border border-gray-700/50 rounded-lg px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: EVENT_COLORS[hoveredEvent.eventType] ?? "#6b7280" }}
                  />
                  <span className="text-gray-200 font-medium">{hoveredEvent.eventType}</span>
                  {hoveredEvent.toolName && (
                    <span className="text-gray-500">{hoveredEvent.toolName}</span>
                  )}
                  <span className="text-gray-600 font-mono ml-auto">
                    +{formatTime(hoveredEvent.timestamp - timeRange.min)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
