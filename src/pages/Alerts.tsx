import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatTimestamp } from "../lib/formatters";

export default function Alerts() {
  const alerts = useQuery(api.alerts.listActive) ?? [];
  const acknowledge = useMutation(api.alerts.acknowledge);

  const severityStyle = (severity: string) => {
    const styles: Record<string, string> = {
      info: "text-blue-400 bg-blue-400/10 border-blue-400/20",
      warning: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
      error: "text-orange-400 bg-orange-400/10 border-orange-400/20",
      critical: "text-red-400 bg-red-400/10 border-red-400/20",
    };
    return styles[severity] ?? "text-gray-400 bg-gray-400/10 border-gray-400/20";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Alerts</h1>
        <span className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-400">
          {alerts.length} active
        </span>
      </div>

      {alerts.length === 0 ? (
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-8 text-center">
          <p className="text-green-400 text-lg mb-1">All clear</p>
          <p className="text-gray-500 text-sm">No active alerts</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((a: any) => (
            <div
              key={a._id}
              className={`border rounded-xl px-4 py-3 ${severityStyle(a.severity)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium uppercase">{a.severity}</span>
                    <span className="text-xs opacity-60">{a.source}</span>
                  </div>
                  <p className="text-sm">{a.message}</p>
                  <p className="text-xs opacity-50 mt-1">{formatTimestamp(a.createdAt)}</p>
                </div>
                <button
                  onClick={() => acknowledge({ id: a._id, acknowledgedBy: "dashboard" })}
                  className="text-xs px-3 py-1 rounded bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 transition-colors ml-3 shrink-0"
                >
                  Ack
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
