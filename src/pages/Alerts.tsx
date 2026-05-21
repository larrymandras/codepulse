import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import MetricCard from "../components/MetricCard";
import { useGroupedAlerts, useAllAlertsPaginated, useAlertCounts } from "../hooks/useAlerts";
import AlertRulesEngine from "../components/AlertRulesEngine";
import LoadMoreButton from "../components/LoadMoreButton";
import { AlertLifecycleActions } from "../components/AlertLifecycleActions";
import { WebhookStatusBadge } from "../components/WebhookStatusBadge";
import { Clock } from "lucide-react";

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

// ─── Per-row component (isolates per-alert mute query) ────────────────────────

function AlertRow({ a }: { a: any }) {
  const muteState = useQuery(api.alertMutes.isTargetMutedPublic, {
    targetType: "alert",
    targetId: a._id,
  });
  const isMuted = muteState ?? false;

  const colors = severityColors[a.severity] ?? severityColors.info;
  const isAcked = a.status === "acknowledged" || a.acknowledged;
  const isResolved = a.status === "resolved";

  let rowOpacity = "";
  if (isResolved) rowOpacity = "opacity-40";
  else if (isAcked) rowOpacity = "opacity-60";
  else if (isMuted) rowOpacity = "opacity-50";

  return (
    <div
      className={`bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 transition-opacity duration-200 ease-out ${rowOpacity}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
              <span className={`text-xs font-medium uppercase ${colors.text}`}>
                {a.severity}
              </span>
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-400 border border-gray-600/30">
              {a.source}
            </span>
            {isAcked && (
              <span className="text-xs px-2 bg-muted rounded text-muted-foreground">
                Acknowledged
              </span>
            )}
            {isResolved && (
              <span className="text-xs px-2 bg-muted rounded text-muted-foreground">
                Auto-resolved
              </span>
            )}
            {isMuted && !isAcked && !isResolved && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-4 h-4" />
                Muted
              </span>
            )}
          </div>
          <p className={`text-sm text-gray-200 ${isAcked ? "line-through text-gray-500" : ""}`}>
            {a.message}
            {a.groupCount > 1 && (
              <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-400">
                x{a.groupCount}
              </span>
            )}
          </p>
          <p className="text-xs text-gray-500 mt-1">{relativeTime(a.createdAt)}</p>
          {a.webhookStatus && (
            <div className="mt-1">
              <WebhookStatusBadge
                status={a.webhookStatus}
                deliveredAt={a.webhookDeliveredAt}
                attempts={a.webhookAttempts}
              />
            </div>
          )}
        </div>
        <AlertLifecycleActions
          alertId={a._id}
          alertTitle={a.message}
          alertSeverity={a.severity}
          status={a.status}
          isMuted={isMuted}
        />
      </div>
    </div>
  );
}

export default function Alerts() {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [showAll, setShowAll] = useState(false);

  const groupedAlerts = useGroupedAlerts();
  const { alerts: allAlerts, status: alertStatus, loadMore: loadMoreAlerts } = useAllAlertsPaginated();
  const counts = useAlertCounts();

  const baseAlerts = showAll ? allAlerts : groupedAlerts;
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
      </div>

      {/* Severity Count Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Critical" value={counts.critical} numericValue={counts.critical} trend={counts.critical > 0 ? "down" : "neutral"} severity="critical" />
        <MetricCard label="Error" value={counts.error} numericValue={counts.error} trend={counts.error > 0 ? "down" : "neutral"} severity="error" />
        <MetricCard label="Warning" value={counts.warning} numericValue={counts.warning} trend={counts.warning > 0 ? "down" : "neutral"} severity="warning" />
        <MetricCard label="Info" value={counts.info} numericValue={counts.info} trend="neutral" severity="info" />
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
        <div className="relative overflow-hidden bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-transparent border border-green-500/20 rounded-2xl p-12 text-center backdrop-blur-sm shadow-[0_0_30px_rgba(16,185,129,0.1)]">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
          <div className="relative z-10 flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/30 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
              <span className="text-3xl text-green-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]">&#10003;</span>
            </div>
            <div>
              <p className="text-green-400 text-xl font-medium tracking-wide mb-1 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]">No active alerts</p>
              <p className="text-gray-400 text-sm">All monitored thresholds are within normal range.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a: any) => (
            <AlertRow key={a._id} a={a} />
          ))}
        </div>
      )}

      {showAll && <LoadMoreButton status={alertStatus} loadMore={loadMoreAlerts} />}

      {/* Alert Rules Engine */}
      <AlertRulesEngine />
    </div>
  );
}
