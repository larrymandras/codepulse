import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface BriefingFeedItemProps {
  briefing: {
    _id: string;
    type: string;
    sessionId?: string;
    date?: string;
    narrative: string;
    summary?: string;
    totalCost?: number;
    anomaliesDetected?: number;
    generatedAt: number;
  };
}

function formatDate(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

export default function BriefingFeedItem({ briefing }: BriefingFeedItemProps) {
  const [expanded, setExpanded] = useState(false);
  const { type, sessionId, narrative, summary, totalCost, generatedAt } = briefing;

  return (
    <div className={type === "session" ? "ml-4" : ""}>
      {/* Collapsed row */}
      <div
        className="flex items-center gap-3 py-3 px-4 hover:bg-muted/50 cursor-pointer border-b border-border"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary font-medium shrink-0">
          {type === "daily_digest" ? "DIGEST" : "SESSION"}
        </span>
        <span className="text-xs text-muted-foreground font-mono shrink-0">
          {formatDate(generatedAt)}
        </span>
        <span className="text-sm flex-1 truncate">
          {summary || narrative.slice(0, 100)}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform shrink-0 ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 bg-muted/20">
          <p className="text-sm whitespace-pre-wrap">{narrative}</p>
          {type === "session" && sessionId && (
            <p className="font-mono text-xs text-muted-foreground mt-2">
              Session: {sessionId}
            </p>
          )}
          {totalCost !== undefined && totalCost > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Cost: {formatCost(totalCost)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
