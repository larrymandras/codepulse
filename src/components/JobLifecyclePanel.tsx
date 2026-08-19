import { useState } from "react";
import { formatTimestamp, relativeTime } from "../lib/formatters";
import InfoTooltip from "./InfoTooltip";

interface JobLifecyclePanelProps {
  jobs: any[];
}

function statusColor(status: string): string {
  switch (status) {
    case "completed": return "text-green-400";
    case "running": return "text-blue-400";
    case "pending": return "text-yellow-400";
    case "failed": return "text-red-400";
    case "cancelled": return "text-muted-foreground";
    default: return "text-muted-foreground";
  }
}

function statusDot(status: string): string {
  switch (status) {
    case "completed": return "bg-green-400";
    case "running": return "bg-blue-400";
    case "pending": return "bg-yellow-400";
    case "failed": return "bg-red-400";
    case "cancelled": return "bg-muted-foreground";
    default: return "bg-muted-foreground";
  }
}

export default function JobLifecyclePanel({ jobs }: JobLifecyclePanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Group by jobId, show latest status per group
  const grouped = new Map<string, any[]>();
  for (const job of jobs) {
    const list = grouped.get(job.jobId) || [];
    list.push(job);
    grouped.set(job.jobId, list);
  }

  const entries = Array.from(grouped.entries()).map(([jobId, events]) => {
    const sorted = [...events].sort((a, b) => b.timestamp - a.timestamp);
    return { jobId, latest: sorted[0], events: sorted };
  });

  return (
    <div className="bg-card/50 border border-border/50 rounded-xl p-4">
      <h2 className="text-sm font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">
        Job Lifecycle
        <span className="ml-2 text-sm text-muted-foreground font-normal">{entries.length}</span>
        <InfoTooltip text="Async jobs tracked by Astridr runtime — pipelines, delegated tasks, and background operations." />
      </h2>
      {entries.length === 0 ? (
        <p className="text-base text-muted-foreground py-6 text-center">No jobs recorded yet</p>
      ) : (
        <div className="space-y-1 max-h-[360px] overflow-y-auto">
          {entries.map(({ jobId, latest, events }) => {
            const isExpanded = expandedId === jobId;
            return (
              <div key={jobId}>
                <div
                  onClick={() => setExpandedId(isExpanded ? null : jobId)}
                  className="flex items-center justify-between bg-background/50 rounded-lg px-4 py-2.5 cursor-pointer hover:bg-[var(--surface-3)]/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot(latest.status)}`} />
                    <span className="text-base font-mono text-foreground truncate">{jobId}</span>
                    <span className={`text-sm capitalize flex-shrink-0 ${statusColor(latest.status)}`}>
                      {latest.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                    {latest.trigger && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {latest.trigger}
                      </span>
                    )}
                    <span className="text-sm text-muted-foreground">{relativeTime(latest.timestamp)}</span>
                    <span className="text-muted-foreground text-sm">{isExpanded ? "\u25B2" : "\u25BC"}</span>
                  </div>
                </div>
                {isExpanded && (
                  <div className="ml-5 mt-1 mb-2 bg-popover/80 border border-border/40 rounded-lg px-4 py-3 text-sm">
                    <span className="text-muted-foreground block mb-1">State Transitions</span>
                    <div className="space-y-0.5">
                      {events.map((evt: any, i: number) => (
                        <div key={evt._id} className={`flex items-center gap-3 px-2 py-1 rounded ${i % 2 === 0 ? "bg-muted/30" : ""}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusDot(evt.status)}`} />
                          <span className="text-muted-foreground font-mono w-20">{formatTimestamp(evt.timestamp)}</span>
                          <span className={`capitalize ${statusColor(evt.status)}`}>{evt.status}</span>
                          {evt.error && <span className="text-red-400 truncate">{evt.error}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
