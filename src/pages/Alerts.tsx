import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import MetricCard from "../components/MetricCard";
import { useActiveAlerts, useAllAlerts, useAlertCounts } from "../hooks/useAlerts";
import AlertRulesEngine from "../components/AlertRulesEngine";

type SeverityFilter = "all" | "critical" | "error" | "warning" | "info";

function relativeTime(ts: number): string {
  const now = Date.now() / 1000;
  const diff = Math.max(0, now - ts);
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const severityColors: Record<string, { dot: string; badge: string; text: string }> = {
  critical: {
    dot: "bg-red-500",
    badge: "text-red-400 bg-red-400/10 border-red-400/20",
    text: "text-red-400",
  },
  error: {
    dot: "bg-orange-500",
    badge: "text-orange-400 bg-orange-400/10 border-orange-400/20",
    text: "text-orange-400",
  },
  warning: {
    dot: "bg-yellow-500",
    badge: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
    text: "text-yellow-400",
  },
  info: {
    dot: "bg-blue-500",
    badge: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    text: "text-blue-400",
  },
};

export default function Alerts() {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [showAll, setShowAll] = useState(false);

  const activeAlerts = useActiveAlerts();
  const allAlerts = useAllAlerts(200);
  const counts = useAlertCounts();

  const acknowledge = useMutation(api.alerts.acknowledge);
  const dismissAll = useMutation(api.alerts.dismissAll);

  const baseAlerts = showAll ? allAlerts : activeAlerts;
  const filtered =
    severityFilter === "all"
      ? baseAlerts
      : baseAlerts.filter((a: any) => a.severity === severityFilter);

  const tabs: { label: string; value: SeverityFilter }[] = [
    { label: "All", value: "all" },
    { label: "Critical", value: "critical" },
    { label: "Error", value: "error" },
    { label: "Warning", value: "warning" },
    { label: "Info", value: "info" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Alerts</h1>
        {activeAlerts.length > 0 && (
          <button
            onClick={() => dismissAll()}
            className="text-xs px-3 py-1.5 rounded-lg bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 transition-colors border border-gray-600/50"
          >
            Dismiss All
          </button>
        )}
      </div>

      {/* Severity Count Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Critical" value={counts.critical} trend={counts.critical > 0 ? "down" : "neutral"} />
        <MetricCard label="Error" value={counts.error} trend={counts.error > 0 ? "down" : "neutral"} />
        <MetricCard label="Warning" value={counts.warning} trend={counts.warning > 0 ? "down" : "neutral"} />
        <MetricCard label="Info" value={counts.info} trend="neutral" />
      </div>

      {/* Filter Controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Severity Tabs */}
        <div className="flex items-center gap-1 bg-gray-800/50 border border-gray-700/50 rounded-xl p-1">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setSeverityFilter(tab.value)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                severityFilter === tab.value
                  ? "bg-gray-700 text-gray-100"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Active / All Toggle */}
        <div className="flex items-center gap-2 bg-gray-800/50 border border-gray-700/50 rounded-xl p-1">
          <button
            onClick={() => setShowAll(false)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
              !showAll ? "bg-gray-700 text-gray-100" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setShowAll(true)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
              showAll ? "bg-gray-700 text-gray-100" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            All
          </button>
        </div>
      </div>

      {/* Alert List */}
      {filtered.length === 0 ? (
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-8 text-center">
          <div className="text-3xl mb-2 text-green-400">&#10003;</div>
          <p className="text-green-400 text-lg mb-1">All clear — no active alerts</p>
          <p className="text-gray-500 text-sm">The system is operating normally</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a: any) => {
            const colors = severityColors[a.severity] ?? severityColors.info;
            const isAcked = a.acknowledged;

            return (
              <div
                key={a._id}
                className={`bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 transition-opacity ${
                  isAcked ? "opacity-50" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {/* Severity badge */}
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                        <span className={`text-xs font-medium uppercase ${colors.text}`}>
                          {a.severity}
                        </span>
                      </span>
                      {/* Source tag */}
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-400 border border-gray-600/30">
                        {a.source}
                      </span>
                    </div>
                    <p className={`text-sm text-gray-200 ${isAcked ? "line-through text-gray-500" : ""}`}>
                      {a.message}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{relativeTime(a.createdAt)}</p>
                  </div>
                  {!isAcked && (
                    <button
                      onClick={() => acknowledge({ id: a._id, acknowledgedBy: "dashboard" })}
                      className="text-xs px-3 py-1.5 rounded-lg bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 transition-colors border border-gray-600/30 shrink-0"
                    >
                      Acknowledge
                    </button>
                  )}
                  {isAcked && (
                    <span className="text-xs text-gray-600 shrink-0">Acknowledged</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Alert Rules Engine */}
      <AlertRulesEngine />
    </div>
  );
}
