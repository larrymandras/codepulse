import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function Capabilities() {
  const tools = useQuery(api.registry.listTools) ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Capabilities Registry</h1>

      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Discovered Tools</h2>
        {tools.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">
            No tools discovered yet. Tools are registered as events flow through the system.
          </p>
        ) : (
          <div className="space-y-1">
            {tools.map((t: any) => (
              <div
                key={t._id}
                className="flex items-center justify-between bg-gray-900/50 rounded-lg px-4 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-gray-200">{t.name}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-400">
                    {t.source}
                  </span>
                </div>
                <span className="text-xs text-gray-500">{t.usageCount} uses</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
