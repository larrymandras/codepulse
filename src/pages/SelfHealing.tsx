import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatTimestamp } from "../lib/formatters";

export default function SelfHealing() {
  const components = useQuery(api.selfHealing.componentHealth) ?? [];

  const outcomeStyle = (outcome: string) => {
    const styles: Record<string, string> = {
      resolved: "text-green-400 bg-green-400/10",
      failed: "text-red-400 bg-red-400/10",
      pending: "text-yellow-400 bg-yellow-400/10",
    };
    return styles[outcome] ?? "text-gray-400 bg-gray-400/10";
  };

  const actionIcon = (action: string) => {
    const icons: Record<string, string> = {
      restart: "↻",
      rollback: "↩",
      retry: "⟳",
      escalate: "⬆",
    };
    return icons[action] ?? "•";
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Self-Healing</h1>

      {components.length === 0 ? (
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-8 text-center">
          <p className="text-green-400 text-lg mb-1">All systems nominal</p>
          <p className="text-gray-500 text-sm">No self-healing events recorded</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {components.map((c: any) => (
            <div
              key={c._id}
              className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-mono text-gray-200">{c.component}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${outcomeStyle(c.outcome)}`}>
                  {c.outcome}
                </span>
              </div>
              <p className="text-sm text-gray-400 mb-2">{c.issue}</p>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>
                  {actionIcon(c.action)} {c.action}
                </span>
                <span>{formatTimestamp(c.timestamp)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
