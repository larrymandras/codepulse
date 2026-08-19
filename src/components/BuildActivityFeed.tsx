import { formatTimestamp } from "../lib/formatters";

interface ActivityEntry {
  _id: string;
  component: string;
  phase: string;
  status: string;
  message?: string;
  updatedAt: number;
}

const STATUS_COLORS: Record<string, string> = {
  completed: "text-green-400",
  in_progress: "text-blue-400",
  pending: "text-muted-foreground",
  failed: "text-red-400",
};

const STATUS_DOT: Record<string, string> = {
  completed: "bg-green-400",
  in_progress: "bg-blue-400",
  pending: "bg-muted-foreground",
  failed: "bg-red-400",
};

function statusDescription(status: string, component: string): string {
  switch (status) {
    case "completed":
      return `${component} completed`;
    case "in_progress":
      return `${component} started building`;
    case "failed":
      return `${component} failed`;
    case "pending":
      return `${component} queued`;
    default:
      return `${component} updated to ${status}`;
  }
}

export default function BuildActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="bg-card/50 border border-border/50 rounded-xl p-4 text-center text-muted-foreground text-base">
        No recent activity
      </div>
    );
  }

  return (
    <div className="bg-card/50 border border-border/50 rounded-xl p-4">
      <h3 className="text-sm font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">Recent Activity</h3>
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {entries.slice(0, 20).map((entry) => (
          <div
            key={entry._id}
            className="flex items-start gap-2 py-1.5 border-b border-border/30 last:border-0"
          >
            <span
              className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${STATUS_DOT[entry.status] ?? STATUS_DOT.pending}`}
            />
            <div className="flex-1 min-w-0">
              <p className={`text-base ${STATUS_COLORS[entry.status] ?? "text-muted-foreground"}`}>
                {statusDescription(entry.status, entry.component)}
              </p>
              {entry.message && (
                <p className="text-sm text-muted-foreground truncate">{entry.message}</p>
              )}
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm text-muted-foreground">
                  {formatTimestamp(entry.updatedAt)}
                </span>
                <span className="text-sm px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">
                  {entry.phase}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
