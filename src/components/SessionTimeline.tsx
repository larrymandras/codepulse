import { useState } from "react";
import { getEventIcon, getEventColor } from "../lib/eventIcons";
import { formatTimestamp } from "../lib/formatters";

interface SessionTimelineProps {
  events: any[];
  agents: any[];
}

const EVENT_TYPES = [
  "SessionStart",
  "SessionEnd",
  "ToolUse",
  "SubagentStart",
  "SubagentStop",
  "Write",
  "Edit",
  "Read",
  "Bash",
  "Error",
  "ToolError",
  "UserPrompt",
];

export default function SessionTimeline({ events, agents }: SessionTimelineProps) {
  const [activeAgents, setActiveAgents] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState("");

  const toggleAgent = (agentId: string) => {
    setActiveAgents((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return next;
    });
  };

  const filtered = events.filter((e) => {
    if (activeAgents.size > 0 && e.payload?.agentId && !activeAgents.has(e.payload.agentId)) {
      return false;
    }
    if (typeFilter && e.eventType !== typeFilter) {
      return false;
    }
    return true;
  });

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {agents.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {agents.map((a: any) => (
              <button
                key={a._id}
                onClick={() => toggleAgent(a.agentId)}
                className={`text-xs px-2 py-1 rounded font-mono transition-colors ${
                  activeAgents.has(a.agentId)
                    ? "bg-purple-400/20 text-purple-300 border border-purple-500/40"
                    : "bg-gray-700/50 text-gray-400 border border-gray-600/30 hover:bg-gray-700/80"
                }`}
              >
                {a.agentId}
              </button>
            ))}
          </div>
        )}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="ml-auto text-xs bg-gray-900/80 border border-gray-600/50 text-gray-300 rounded px-2 py-1"
        >
          <option value="">All types</option>
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">No events match filters</p>
      ) : (
        <div className="max-h-[600px] overflow-y-auto space-y-1">
          {filtered.map((e: any) => (
            <div
              key={e._id}
              className="flex items-start gap-3 px-3 py-2 rounded hover:bg-gray-700/20 group"
            >
              <span className="text-xs font-mono text-gray-600 shrink-0 pt-0.5 w-20">
                {formatTimestamp(e.timestamp)}
              </span>
              <div className="w-px h-full bg-gray-700/50 shrink-0" />
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className={getEventColor(e.eventType)}>{getEventIcon(e.eventType)}</span>
                <span className="text-xs font-mono text-gray-300 shrink-0">{e.eventType}</span>
                {e.toolName && (
                  <span className="text-xs text-gray-500 shrink-0">{e.toolName}</span>
                )}
                {e.payload && (
                  <span className="text-xs text-gray-600 truncate">
                    {typeof e.payload === "string"
                      ? e.payload.slice(0, 80)
                      : e.payload.command
                        ? String(e.payload.command).slice(0, 80)
                        : e.payload.file_path
                          ? String(e.payload.file_path).slice(0, 80)
                          : ""}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
