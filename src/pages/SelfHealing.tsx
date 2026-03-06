import MetricCard from "../components/MetricCard";
import ComponentHealthGrid from "../components/ComponentHealthGrid";
import RecoveryTimeline from "../components/RecoveryTimeline";
import VersionHistory from "../components/VersionHistory";
import {
  useComponentHealth,
  useRecentRecoveries,
  useUptimeStats,
  useVersionHistory,
} from "../hooks/useSelfHealing";

const ESCALATION_LEVELS = [
  { level: 1, label: "Auto-retry", detail: "3 attempts" },
  { level: 2, label: "Auto-failover", detail: "Switch to backup" },
  { level: 3, label: "Auto-restart", detail: "Service restart" },
  { level: 4, label: "HITL escalation", detail: "Human-in-the-loop" },
  { level: 5, label: "Git commit + version tag", detail: "Permanent fix recorded" },
];

export default function SelfHealing() {
  const components = useComponentHealth();
  const recoveries = useRecentRecoveries();
  const stats = useUptimeStats();
  const versions = useVersionHistory();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Self-Healing</h1>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Events" value={stats?.total ?? 0} />
        <MetricCard label="Resolved" value={stats?.resolved ?? 0} trend="up" />
        <MetricCard label="Failed" value={stats?.failed ?? 0} trend="down" />
        <MetricCard label="Pending" value={stats?.pending ?? 0} />
      </div>

      {/* Component Health Grid */}
      <ComponentHealthGrid components={components} />

      {/* Recovery Stats */}
      {stats && Object.keys(stats.actionCounts).length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide mb-4">
            Recovery Actions
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(stats.actionCounts).map(([action, count]) => (
              <div
                key={action}
                className="bg-gray-900/30 rounded-lg p-3 text-center"
              >
                <p className="text-lg font-semibold text-gray-100">{count}</p>
                <p className="text-xs text-gray-400 capitalize">{action}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recovery Timeline */}
      <RecoveryTimeline events={recoveries} />

      {/* Version History */}
      <VersionHistory versions={versions} />

      {/* Escalation Chain */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide mb-4">
          Escalation Chain
        </h2>
        <div className="space-y-2">
          {ESCALATION_LEVELS.map((esc) => (
            <div
              key={esc.level}
              className="flex items-center gap-3 bg-gray-900/30 rounded-lg px-4 py-2.5"
            >
              <span className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs font-semibold text-gray-300 shrink-0">
                {esc.level}
              </span>
              <span className="text-sm text-gray-200 font-medium flex-1">
                {esc.label}
              </span>
              <span className="text-xs text-gray-500">{esc.detail}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
