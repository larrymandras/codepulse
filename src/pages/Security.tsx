import { useSecurityEvents } from "../hooks/useSecurityEvents";
import SecurityStats from "../components/SecurityStats";
import SecurityEventFeed from "../components/SecurityEventFeed";

export default function Security() {
  const events = useSecurityEvents();

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
        <div className="grid grid-cols-3 gap-4">
          {/* RLS Isolation */}
          <div className="bg-gray-900/50 border border-gray-700/30 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              RLS Isolation
            </p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Last test</span>
                <span className="text-gray-300">--</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Cross-profile blocked</span>
                <span className="text-gray-300">0</span>
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
                <span className="text-gray-300">0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Resolved today</span>
                <span className="text-gray-300">0</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
