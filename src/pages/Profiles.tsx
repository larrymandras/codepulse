import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function Profiles() {
  const overview = useQuery(api.profiles.overview) ?? {};
  const profiles = Object.entries(overview);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Agent Profiles</h1>

      {profiles.length === 0 ? (
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-8 text-center">
          <p className="text-gray-500">No profile metrics recorded yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {profiles.map(([profileId, metrics]) => (
            <div
              key={profileId}
              className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4"
            >
              <h3 className="text-sm font-mono text-gray-200 mb-2">{profileId}</h3>
              <div className="space-y-1">
                {(metrics as any[]).slice(0, 10).map((m: any) => (
                  <div key={m._id} className="flex justify-between text-xs">
                    <span className="text-gray-500">{m.metric}</span>
                    <span className="text-gray-300">{m.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
