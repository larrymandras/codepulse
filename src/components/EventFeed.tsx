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
  Tool: (t) => ["ToolUse", "Bash"].includes(t) || t.toLowerCase().includes("tool"),
  LLM: (t) => t === "llm_call" || t.toLowerCase().includes("llm"),
  File: (t) => ["Write", "Edit", "Read"].includes(t) || t.toLowerCase().includes("file"),
  Error: (t) => t === "security_event" || t.toLowerCase().includes("error"),
  Agent: (t) =>
    ["SubagentStart", "SubagentStop", "agent_coordination", "SessionStart", "SessionEnd"].includes(t),
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
    <div className="p-4">
      <SectionHeader
        title="Live Event Feed"
        action={<InfoTooltip text="Live stream of all telemetry events with type filtering" />}
      />

      {/* Filter bar */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        {EVENT_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-[10px] px-2 py-0.5 rounded-sm border transition-colors ${
              filter === f
                ? "bg-primary/10 border-primary/40 text-foreground"
                : "bg-muted/30 border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {events.length === 0 ? "Waiting for events..." : "No matching events"}
        </p>
      ) : (
        <div className="max-h-96 overflow-y-auto">
          {filtered.map((event: any, i: number) => (
            <div
              key={event._id ?? i}
              className={i < newCount && newCount > 0 ? "activity-entry-new" : ""}
            >
              <EntityRow
                icon={<span className="text-xs">{getEventIcon(event.eventType)}</span>}
                primary={event.eventType}
                secondary={event.toolName ?? undefined}
                trailing={
                  <span className="font-mono whitespace-nowrap">
                    {formatTimestamp(event.timestamp)}
                  </span>
                }
                onClick={
                  event.sessionId
                    ? () => navigate(`/sessions/${event.sessionId}`)
                    : undefined
                }
              />
            </div>
          ))}
        </div>
      )}
      <LoadMoreButton status={status} loadMore={loadMore} />
    </div>
  );
}
