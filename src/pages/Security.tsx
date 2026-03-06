import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatTimestamp } from "../lib/formatters";

export default function Security() {
  const events = useQuery(api.security.recentEvents) ?? [];

  const severityStyle = (severity: string) => {
    const styles: Record<string, string> = {
      low: "text-blue-400 bg-blue-400/10",
      medium: "text-yellow-400 bg-yellow-400/10",
      high: "text-orange-400 bg-orange-400/10",
      critical: "text-red-400 bg-red-400/10",
    };
    return styles[severity] ?? "text-gray-400 bg-gray-400/10";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Security Events</h1>
        <span className="text-xs text-gray-500">{events.length} events</span>
      </div>

      {events.length === 0 ? (
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-8 text-center">
          <p className="text-gray-500">No security events recorded</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((e: any) => (
            <div
              key={e._id}
              className="bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${severityStyle(e.severity)}`}>
                      {e.severity}
                    </span>
                    <span className="text-xs font-mono text-gray-400">{e.eventType}</span>
                  </div>
                  <p className="text-sm text-gray-200">{e.description}</p>
                  <p className="text-xs text-gray-500 mt-1">Source: {e.source}</p>
                </div>
                <div className="text-xs text-gray-500 ml-4 shrink-0">
                  {formatTimestamp(e.timestamp)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
