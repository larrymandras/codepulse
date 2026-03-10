import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRecentEvents } from "../hooks/useRecentEvents";
import { getEventIcon, getEventColor } from "../lib/eventIcons";
import { formatTimestamp } from "../lib/formatters";
import InfoTooltip from "./InfoTooltip";

const EVENT_FILTERS = ["All", "Tool", "LLM", "File", "Error", "Agent"] as const;
type EventFilter = (typeof EVENT_FILTERS)[number];

const filterMatchers: Record<EventFilter, (eventType: string) => boolean> = {
  All: () => true,
  Tool: (t) => ["ToolUse", "Bash"].includes(t) || t.toLowerCase().includes("tool"),
  LLM: (t) => t === "llm_call" || t.toLowerCase().includes("llm"),
  File: (t) => ["Write", "Edit", "Read"].includes(t) || t.toLowerCase().includes("file"),
  Error: (t) => t === "security_event" || t.toLowerCase().includes("error"),
  Agent: (t) =>
    ["SubagentStart", "SubagentStop", "agent_coordination", "SessionStart", "SessionEnd"].includes(t),
};

export default function EventFeed() {
  const events = useRecentEvents(50);
  const navigate = useNavigate();
  const [filter, setFilter] = useState<EventFilter>("All");

  const filtered = events.filter((e: any) => filterMatchers[filter](e.eventType));

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">Live Event Feed<InfoTooltip text="Live stream of all telemetry events with type filtering" /></h2>

      {/* Filter bar */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        {EVENT_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
              filter === f
                ? "bg-indigo-500/20 border-indigo-400/40 text-indigo-300"
                : "bg-gray-700/30 border-gray-600/30 text-gray-400 hover:text-gray-300"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          {events.length === 0 ? "Waiting for events..." : "No matching events"}
        </p>
      ) : (
        <div className="max-h-96 overflow-y-auto space-y-1">
          {filtered.map((event: any, i: number) => (
            <div
              key={event._id ?? i}
              onClick={() => {
                if (event.sessionId) navigate(`/sessions/${event.sessionId}`);
              }}
              className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${
                i % 2 === 0 ? "bg-gray-800/30" : ""
              } ${event.sessionId ? "cursor-pointer hover:bg-gray-700/40 transition-colors" : ""}`}
            >
              <span>{getEventIcon(event.eventType)}</span>
              <span className={`font-mono ${getEventColor(event.eventType)}`}>
                {event.eventType}
              </span>
              {event.toolName && (
                <span className="text-gray-500 truncate max-w-[100px]">
                  {event.toolName}
                </span>
              )}
              <span className="ml-auto text-gray-600 font-mono whitespace-nowrap">
                {formatTimestamp(event.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
