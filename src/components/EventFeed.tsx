import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useRecentEvents } from "../hooks/useRecentEvents";
import { getEventIcon } from "../lib/eventIcons";
import { formatTimestamp } from "../lib/formatters";
import { EntityRow } from "./EntityRow";
import { SectionHeader } from "./SectionHeader";
import InfoTooltip from "./InfoTooltip";
import LoadMoreButton from "./LoadMoreButton";

const EVENT_FILTERS = ["All", "Tool", "LLM", "File", "Error", "Agent"] as const;
type EventFilter = (typeof EVENT_FILTERS)[number];

const filterMatchers: Record<EventFilter, (eventType: string) => boolean> = {
  All: () => true,
  Tool: (t) =>
    ["ToolUse", "Bash", "PostToolUse", "PostToolUseFailure", "command_execution", "tool_execution"].includes(t) ||
    t.toLowerCase().includes("tool"),
  LLM: (t) =>
    ["llm_call", "provider_health", "provider.state_change", "compaction", "agent_metric", "advisor_event"].includes(t) ||
    t.toLowerCase().includes("llm"),
  File: (t) =>
    ["Write", "Edit", "Read", "git_commit", "ConfigChange", "InstructionsLoaded"].includes(t) ||
    t.toLowerCase().includes("file"),
  Error: (t) =>
    ["security_event", "sandbox_violation", "PostToolUseFailure", "heartbeat_alerts"].includes(t) ||
    t.toLowerCase().includes("error"),
  Agent: (t) =>
    ["SubagentStart", "SubagentStop", "agent_coordination", "SessionStart", "SessionEnd",
     "startup_event", "capability_sync", "mcp_connection", "plugin_loaded"].includes(t),
};

export default function EventFeed() {
  const { events, status, loadMore } = useRecentEvents(50);
  const navigate = useNavigate();
  const [filter, setFilter] = useState<EventFilter>("All");
  const prevCountRef = useRef(0);

  const filtered = events.filter((e: any) => filterMatchers[filter](e.eventType));

  // Track new entries for slide-in animation
  const newCount = filtered.length - prevCountRef.current;
  useEffect(() => {
    prevCountRef.current = filtered.length;
  }, [filtered.length]);

  return (
    <div className="glow-card bg-[#09090b] border border-border/50 rounded-xl p-6 relative overflow-hidden flex flex-col h-full">
      {/* Scanline specifically for this terminal */}
      <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden mix-blend-overlay opacity-30">
        <div className="w-full h-[2px] bg-primary/40 animate-scanline" />
      </div>

      <div className="flex flex-wrap items-center justify-between mb-4 pb-4 border-b border-border/30 gap-4">
        <h2 className="text-xs font-mono tracking-widest text-primary uppercase flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          tail -f /var/log/events
        </h2>
        
        {/* Filter bar */}
        <div className="flex items-center gap-1.5 flex-wrap z-20 relative">
          {EVENT_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[10px] px-2 py-0.5 rounded-sm border font-mono transition-colors ${
                filter === f
                  ? "bg-primary/20 border-primary text-primary"
                  : "bg-muted/30 border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs font-mono text-muted-foreground py-8 text-center flex-1">
          {events.length === 0 ? "Waiting for events..." : "No matching events"}
        </p>
      ) : (
        <div className="max-h-[300px] overflow-y-auto font-mono text-xs space-y-1 z-20 relative flex-1 pr-2">
          {filtered.map((event: any, i: number) => {
            const isError = filterMatchers.Error(event.eventType);
            const isTool = filterMatchers.Tool(event.eventType);
            const eventColor = isError ? "text-red-500" : isTool ? "text-primary" : "text-muted-foreground";
            
            return (
              <div
                key={event._id ?? i}
                onClick={
                  event.sessionId
                    ? () => navigate(`/sessions/${event.sessionId}`)
                    : undefined
                }
                className={`flex items-start gap-3 p-1.5 hover:bg-white/5 cursor-pointer rounded transition-colors group ${
                  i < newCount && newCount > 0 ? "activity-entry-new" : ""
                }`}
              >
                <span className="text-muted-foreground/50 shrink-0 mt-0.5">
                  {formatTimestamp(event.timestamp)}
                </span>
                <span className={`shrink-0 w-4 text-center ${eventColor}`}>
                  {getEventIcon(event.eventType)}
                </span>
                <div className="flex-1 flex flex-col gap-0.5 overflow-hidden">
                  <div className="flex items-baseline gap-2">
                    <span className={`font-bold tracking-tight truncate ${eventColor}`}>
                      [{event.eventType}]
                    </span>
                    {event.toolName && (
                      <span className="text-foreground/80 truncate">
                        {event.toolName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-4 z-20 relative border-t border-border/30 pt-4">
        <LoadMoreButton status={status} loadMore={loadMore} />
      </div>
    </div>
  );
}
