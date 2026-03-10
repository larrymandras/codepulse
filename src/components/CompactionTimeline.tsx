import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

function relativeTime(ts: number): string {
  const diff = Math.max(0, Date.now() / 1000 - ts);
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CompactionTimeline() {
  const events = useQuery(api.compactionEvents.recent) ?? [];

  if (events.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide mb-4">
          Context Compaction Timeline
        </h2>
        <p className="text-sm text-gray-500 py-4 text-center">
          No compaction events recorded
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide mb-4">
        Context Compaction Timeline
      </h2>

      <div className="relative pl-6 space-y-3">
        {/* Vertical line */}
        <div className="absolute left-2.5 top-1 bottom-1 w-px bg-gray-700" />

        {events.map((event: any) => (
          <div key={event._id} className="relative flex items-start gap-3">
            {/* Dot */}
            <div className="absolute left-[-14px] top-1.5 w-3 h-3 rounded-full bg-amber-500/80 border-2 border-gray-800 shrink-0" />

            <div className="flex-1 bg-gray-900/30 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-200 font-medium">
                  Compaction
                </span>
                {event.trigger && (
                  <span className="text-[9px] uppercase tracking-wider font-semibold text-amber-400 bg-amber-600/10 rounded px-1.5 py-0.5">
                    {event.trigger}
                  </span>
                )}
                <span className="text-[10px] text-gray-500 ml-auto">
                  {relativeTime(event.timestamp)}
                </span>
              </div>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {formatTimestamp(event.timestamp)}
                {event.sessionId && (
                  <>
                    {" "}&middot;{" "}
                    <span className="font-mono">{event.sessionId.slice(0, 8)}</span>
                  </>
                )}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
