import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatTimestamp } from "../lib/formatters";
import InfoTooltip from "./InfoTooltip";

const severityStyles: Record<string, { badge: string; icon: string }> = {
  critical: { badge: "text-red-400 bg-red-400/10", icon: "!!" },
  high: { badge: "text-orange-400 bg-orange-400/10", icon: "!" },
  medium: { badge: "text-yellow-400 bg-yellow-400/10", icon: "~" },
  low: { badge: "text-blue-400 bg-blue-400/10", icon: "i" },
};

interface SecurityEventFeedProps {
  events: any[];
}

export default function SecurityEventFeed({ events }: SecurityEventFeedProps) {
  const acknowledgeEvent = useMutation(api.security.acknowledgeEvent);

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">Security Event Feed<InfoTooltip text="Security events with severity, description, source, and acknowledge actions" /></h2>
      {events.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">No security events recorded</p>
      ) : (
        <div className="max-h-96 overflow-y-auto space-y-1">
          {events.map((e: any, i: number) => {
            const style = severityStyles[e.severity] ?? { badge: "text-gray-400 bg-gray-400/10", icon: "?" };
            return (
              <div
                key={e._id ?? i}
                className={`flex items-center gap-3 px-2 py-1.5 rounded text-xs ${
                  i % 2 === 0 ? "bg-gray-800/30" : ""
                }`}
              >
                <span className="text-gray-600 font-mono whitespace-nowrap">
                  {formatTimestamp(e.timestamp)}
                </span>
                <span className={`px-1.5 py-0.5 rounded font-mono font-bold ${style.badge}`}>
                  {style.icon}
                </span>
                <span className={`px-2 py-0.5 rounded font-medium ${style.badge}`}>
                  {e.severity}
                </span>
                <span className="font-mono text-gray-400">{e.eventType}</span>
                <span className="text-gray-300 truncate flex-1 min-w-0">{e.description}</span>
                <span className="text-gray-500 whitespace-nowrap">{e.source}</span>
                {e._id && (
                  e.mitigated ? (
                    <span className="text-[10px] text-green-500/70 whitespace-nowrap">Reviewed</span>
                  ) : (
                    <button
                      onClick={() => acknowledgeEvent({ eventId: e._id })}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20 transition-colors whitespace-nowrap"
                    >
                      Acknowledge
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
