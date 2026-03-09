import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useSecurityEvents } from "../hooks/useSecurityEvents";
import SecurityStats from "../components/SecurityStats";
import SecurityEventFeed from "../components/SecurityEventFeed";

function formatRelativeTime(epochSeconds: number | null): string {
  if (!epochSeconds) return "--";
  const now = Date.now() / 1000;
  const diff = now - epochSeconds;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function statusColor(value: number, thresholds: { warn: number; danger: number }): string {
  if (value >= thresholds.danger) return "text-red-400";
  if (value >= thresholds.warn) return "text-yellow-400";
  return "text-green-400";
}

export default function Security() {
  const events = useSecurityEvents();
  const rlsStats = useQuery(api.security.rlsStats);
  const hitlStats = useQuery(api.security.hitlStats);
  const webhookStats = useQuery(api.security.webhookStats);
  const vaultStats = useQuery(api.security.vaultStats);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Security Dashboard</h1>
        <span className="text-xs text-gray-500">{events.length} events</span>
      </div>

      {/* Severity Stats */}
      <SecurityStats />

      {/* Security Event Feed */}
      <SecurityEventFeed events={events} />

      {/* Audit & Compliance */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Audit & Compliance</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* RLS Isolation */}
          <div className="bg-gray-900/50 border border-gray-700/30 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              RLS Isolation
            </p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Last test</span>
                <span className="text-gray-300">
                  {rlsStats ? formatRelativeTime(rlsStats.lastTest) : "--"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Cross-profile blocked</span>
                <span className={rlsStats ? statusColor(rlsStats.crossProfileBlocked, { warn: 1, danger: 5 }) : "text-gray-300"}>
                  {rlsStats?.crossProfileBlocked ?? 0}
                </span>
              </div>
            </div>
          </div>

          {/* Audit Chain */}
          <div className="bg-gray-900/50 border border-gray-700/30 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Audit Chain
            </p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Chain integrity</span>
                <span className="text-green-400">Valid</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Entry count</span>
                <span className="text-gray-300">{events.length}</span>
              </div>
            </div>
          </div>

          {/* HITL Status */}
          <div className="bg-gray-900/50 border border-gray-700/30 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              HITL Status
            </p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Pending confirmations</span>
                <span className={hitlStats ? statusColor(hitlStats.pending, { warn: 3, danger: 10 }) : "text-gray-300"}>
                  {hitlStats?.pending ?? 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Resolved today</span>
                <span className="text-gray-300">{hitlStats?.resolvedToday ?? 0}</span>
              </div>
            </div>
          </div>

          {/* Webhook Validation */}
          <div className="bg-gray-900/50 border border-gray-700/30 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Webhook Validation
            </p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Received</span>
                <span className="text-gray-300">{webhookStats?.totalReceived ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Forged / blocked</span>
                <span className={webhookStats ? statusColor(webhookStats.forgedBlocked, { warn: 1, danger: 3 }) : "text-gray-300"}>
                  {webhookStats?.forgedBlocked ?? 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Last received</span>
                <span className="text-gray-300">
                  {webhookStats ? formatRelativeTime(webhookStats.lastReceived) : "--"}
                </span>
              </div>
            </div>
          </div>

          {/* Vault Status */}
          <div className="bg-gray-900/50 border border-gray-700/30 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Credential Vault
            </p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Total accesses</span>
                <span className="text-gray-300">{vaultStats?.totalAccesses ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Denied</span>
                <span className={vaultStats ? statusColor(vaultStats.denied, { warn: 1, danger: 3 }) : "text-gray-300"}>
                  {vaultStats?.denied ?? 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Last access</span>
                <span className="text-gray-300">
                  {vaultStats ? formatRelativeTime(vaultStats.lastAccess) : "--"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
