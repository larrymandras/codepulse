import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatTimestamp } from "../lib/formatters";

export default function BuildProgress() {
  const components = useQuery(api.build.phaseProgress) ?? [];

  const statusStyle = (status: string) => {
    const styles: Record<string, string> = {
      completed: "text-green-400 bg-green-400/10",
      in_progress: "text-blue-400 bg-blue-400/10",
      pending: "text-gray-400 bg-gray-400/10",
      failed: "text-red-400 bg-red-400/10",
    };
    return styles[status] ?? "text-gray-400 bg-gray-400/10";
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Build Progress</h1>

      {components.length === 0 ? (
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-8 text-center">
          <p className="text-gray-500">No build components tracked yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {components.map((c: any) => (
            <div
              key={c._id}
              className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-gray-200">{c.component}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${statusStyle(c.status)}`}>
                    {c.status}
                  </span>
                </div>
                <span className="text-xs text-gray-500">{c.phase}</span>
              </div>
              {c.progress != null && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Progress</span>
                    <span>{c.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-700/50 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${c.progress}%` }}
                    />
                  </div>
                </div>
              )}
              {c.message && (
                <p className="text-xs text-gray-500 mt-2">{c.message}</p>
              )}
              <p className="text-xs text-gray-600 mt-1">{formatTimestamp(c.updatedAt)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
