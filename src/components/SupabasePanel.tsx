import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatTimestamp } from "../lib/formatters";

export default function SupabasePanel() {
  const healthRecords = useQuery(api.supabase.currentHealth) ?? [];

  const statusColor = (status: string) => {
    if (status === "healthy") return "text-green-400 bg-green-400/10";
    if (status === "degraded") return "text-yellow-400 bg-yellow-400/10";
    return "text-red-400 bg-red-400/10";
  };

  const localRecords = healthRecords.filter(
    (r: any) => !r.projectRef || r.projectRef === "local"
  );
  const cloudRecords = healthRecords.filter(
    (r: any) => r.projectRef && r.projectRef !== "local"
  );

  const renderSection = (title: string, records: any[]) => (
    <div>
      <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
        {title}
      </h3>
      {records.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center">
          No health checks recorded
        </p>
      ) : (
        <div className="space-y-2">
          {records.map((s: any) => (
            <div
              key={s._id}
              className="flex items-center justify-between bg-gray-900/50 rounded-lg px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono text-gray-200">
                  {s.service}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${statusColor(s.status)}`}
                >
                  {s.status}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                {s.responseTimeMs != null && <span>{s.responseTimeMs}ms</span>}
                <span>{formatTimestamp(s.checkedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">
        Supabase Health
      </h2>
      <div className="space-y-4">
        {renderSection("Local", localRecords)}
        {renderSection("Cloud", cloudRecords)}
      </div>
    </div>
  );
}
