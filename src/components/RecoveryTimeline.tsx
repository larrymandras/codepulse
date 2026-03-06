import { useState } from "react";
import { formatTimestamp } from "../lib/formatters";

interface RecoveryTimelineProps {
  events: any[];
}

export default function RecoveryTimeline({ events }: RecoveryTimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const outcomeStyle = (outcome: string) => {
    const styles: Record<string, string> = {
      resolved: "text-green-400 bg-green-400/10",
      failed: "text-red-400 bg-red-400/10",
      pending: "text-yellow-400 bg-yellow-400/10",
    };
    return styles[outcome] ?? "text-gray-400 bg-gray-400/10";
  };

  const actionIcon = (action: string) => {
    const icons: Record<string, string> = {
      restart: "\u21BB",
      rollback: "\u21A9",
      retry: "\u27F3",
      escalate: "\u2B06",
    };
    return icons[action] ?? "\u2022";
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide mb-4">
        Recovery Timeline
      </h2>

      {events.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">
          No recovery events recorded
        </p>
      ) : (
        <div className="max-h-96 overflow-y-auto space-y-1 pr-1">
          {events.map((e: any) => {
            const isExpanded = expandedId === e._id;
            return (
              <div key={e._id}>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : e._id)}
                  className="w-full text-left bg-gray-900/30 hover:bg-gray-900/50 rounded-lg px-4 py-2.5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 font-mono shrink-0 w-20">
                      {formatTimestamp(e.timestamp)}
                    </span>
                    <span className="text-sm text-gray-200 font-mono truncate flex-1">
                      {e.component}
                    </span>
                    <span className="text-sm shrink-0" title={e.action}>
                      {actionIcon(e.action)}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded shrink-0 ${outcomeStyle(e.outcome)}`}
                    >
                      {e.outcome}
                    </span>
                    <span className="text-gray-600 text-xs shrink-0">
                      {isExpanded ? "\u25B2" : "\u25BC"}
                    </span>
                  </div>
                </button>
                {isExpanded && (
                  <div className="ml-4 border-l border-gray-700/50 pl-4 py-2 text-sm space-y-1">
                    <p className="text-gray-400">
                      <span className="text-gray-500">Issue:</span> {e.issue}
                    </p>
                    <p className="text-gray-400">
                      <span className="text-gray-500">Action:</span> {e.action}
                    </p>
                    {e.details && (
                      <pre className="text-xs text-gray-500 bg-gray-900/50 rounded p-2 overflow-x-auto">
                        {typeof e.details === "string"
                          ? e.details
                          : JSON.stringify(e.details, null, 2)}
                      </pre>
                    )}
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
