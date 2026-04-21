import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MetricsDashboard, type TimeWindow } from "./MetricsDashboard";

interface DetailActivityTabProps {
  agentId: string;
}

const eventTypeColors: Record<string, string> = {
  handoff: "text-purple-400 bg-purple-400/10",
  message: "text-blue-400 bg-blue-400/10",
  delegation: "text-cyan-400 bg-cyan-400/10",
  result: "text-green-400 bg-green-400/10",
};

const TIME_WINDOWS = {
  "1h": 3600,
  "24h": 86400,
  "7d": 604800,
  "30d": 2592000,
} as const;

function relativeTime(ts: number): string {
  const now = Date.now() / 1000;
  const diff = Math.max(0, now - ts);
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function DetailActivityTab({ agentId }: DetailActivityTabProps) {
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("24h");
  const windowStart = useMemo(
    () => Date.now() / 1000 - TIME_WINDOWS[timeWindow],
    [timeWindow],
  );
  const metrics =
    useQuery(api.agentMetrics.forAgent, { agentId, windowStart }) ?? [];

  const detail = useQuery(api.agents.detail, { agentId }) ?? null;

  const events = useMemo(() => {
    if (!detail) return [];
    const coords = (detail.coordination ?? []) as Array<{
      fromAgent: string;
      toAgent: string;
      eventType: string;
      timestamp: number;
      status?: string;
    }>;

    return [...coords]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 50);
  }, [detail]);

  return (
    <div className="space-y-6">
      {/* Section 1: Performance Metrics Dashboard */}
      <MetricsDashboard
        metrics={metrics}
        timeWindow={timeWindow}
        onWindowChange={setTimeWindow}
      />

      {/* Section 2: Activity Feed (existing coordination events) */}
      <div>
        <h3 className="text-base font-semibold mb-3">Activity Feed</h3>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No activity recorded for this agent.
          </p>
        ) : (
          <ScrollArea className="h-[400px] pr-2">
            <div className="space-y-1">
              {events.map((event, idx) => {
                const isOutgoing = event.fromAgent === agentId;
                const other = isOutgoing ? event.toAgent : event.fromAgent;
                const etClass =
                  eventTypeColors[event.eventType] ??
                  "text-gray-400 bg-gray-700/30";

                return (
                  <div
                    key={idx}
                    className="flex items-start gap-2 py-2 border-b border-border/50 last:border-0"
                  >
                    <span className="text-xs mt-0.5 shrink-0 text-muted-foreground">
                      {isOutgoing ? "\u2192" : "\u2190"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge
                          variant="secondary"
                          className={`text-[9px] px-1.5 py-0 ${etClass}`}
                        >
                          {event.eventType}
                        </Badge>
                        <span className="text-xs text-muted-foreground truncate">
                          {other}
                        </span>
                      </div>
                      {event.status && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {event.status}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {relativeTime(event.timestamp)}
                    </span>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

export default DetailActivityTab;
