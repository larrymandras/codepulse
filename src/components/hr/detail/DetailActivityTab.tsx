import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface DetailActivityTabProps {
  agentId: string;
}

const eventTypeColors: Record<string, string> = {
  handoff: "text-purple-400 bg-purple-400/10",
  message: "text-blue-400 bg-blue-400/10",
  delegation: "text-cyan-400 bg-cyan-400/10",
  result: "text-green-400 bg-green-400/10",
};

function relativeTime(ts: number): string {
  const now = Date.now() / 1000;
  const diff = Math.max(0, now - ts);
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function DetailActivityTab({ agentId }: DetailActivityTabProps) {
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

  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No activity recorded for this agent.
      </p>
    );
  }

  return (
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
  );
}

export default DetailActivityTab;
