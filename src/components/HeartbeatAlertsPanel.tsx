import { useState } from "react";
import { formatTimestamp, relativeTime } from "../lib/formatters";
import InfoTooltip from "./InfoTooltip";

interface HeartbeatAlertsPanelProps {
  heartbeats: any[];
}

export default function HeartbeatAlertsPanel({ heartbeats }: HeartbeatAlertsPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">
        Heartbeat Alerts
        <span className="ml-2 text-xs text-gray-500 font-normal">{heartbeats.length}</span>
        <InfoTooltip text="Periodic health checks from Astridr's heartbeat system. Each beat runs all registered checks and reports alerts." />
      </h2>
      {heartbeats.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">No heartbeat data yet</p>
      ) : (
        <div className="space-y-1 max-h-[360px] overflow-y-auto">
          {heartbeats.map((hb: any) => {
            const isExpanded = expandedId === hb._id;
            const alertCount = hb.alertCount ?? 0;
            const isClean = alertCount === 0;

            return (
              <div key={hb._id}>
                <div
                  onClick={() => setExpandedId(isExpanded ? null : hb._id)}
                  className="flex items-center justify-between bg-gray-900/50 rounded-lg px-4 py-2.5 cursor-pointer hover:bg-gray-700/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isClean ? "bg-green-400" : "bg-red-400"}`} />
                    <span className="text-xs text-gray-500 font-mono">{formatTimestamp(hb.timestamp)}</span>
                    <span className={`text-xs ${isClean ? "text-green-400" : "text-red-400"}`}>
                      {isClean ? "All checks passed" : `${alertCount} alert${alertCount !== 1 ? "s" : ""}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                    <span className="text-xs text-gray-600">{relativeTime(hb.timestamp)}</span>
                    <span className="text-gray-600 text-xs">{isExpanded ? "\u25B2" : "\u25BC"}</span>
                  </div>
                </div>
                {isExpanded && (
                  <div className="ml-5 mt-1 mb-2 bg-gray-900/80 border border-gray-700/40 rounded-lg px-4 py-3 text-xs">
                    {Array.isArray(hb.alerts) && hb.alerts.length > 0 ? (
                      <div className="space-y-1">
                        {hb.alerts.map((alert: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 py-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                            <span className="text-gray-400 font-mono">{alert._check ?? alert.check ?? "unknown"}</span>
                            {alert.error && <span className="text-red-300 truncate">{alert.error}</span>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-600">No alert details available</p>
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
