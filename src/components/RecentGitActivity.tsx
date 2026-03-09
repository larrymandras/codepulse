import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

function relativeTime(ts: number): string {
  const diff = Math.max(0, Date.now() / 1000 - ts);
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function RecentGitActivity() {
  const commits = useQuery(api.git.recentCommits, { limit: 20 }) ?? [];

  if (commits.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide mb-4">
          Recent Git Activity
        </h2>
        <p className="text-sm text-gray-500 py-4 text-center">
          No git commits recorded yet
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide mb-4">
        Recent Git Activity
      </h2>
      <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
        {commits.map((c: any) => {
          const isSelfHealing =
            c.author === "astridr-self-healing" ||
            c.message.startsWith("[self-healing]");
          return (
            <div
              key={c._id}
              className="flex items-start gap-3 bg-gray-900/30 rounded-lg px-4 py-2.5"
            >
              <div
                className={`mt-1 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                  isSelfHealing
                    ? "bg-emerald-600/20"
                    : "bg-blue-600/20"
                }`}
              >
                <svg
                  className={`w-3.5 h-3.5 ${
                    isSelfHealing ? "text-emerald-400" : "text-blue-400"
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {isSelfHealing ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                    />
                  )}
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-200 truncate">{c.message}</p>
                <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                  <span className="font-mono">
                    {c.sha?.slice(0, 7) ?? "\u2014"}
                  </span>
                  <span>&middot;</span>
                  <span>{c.branch}</span>
                  <span>&middot;</span>
                  <span className="text-gray-400">{c.author}</span>
                  <span>&middot;</span>
                  <span>
                    {c.filesChanged} file{c.filesChanged !== 1 ? "s" : ""}
                  </span>
                  <span className="ml-auto">{relativeTime(c.timestamp)}</span>
                </div>
              </div>
              {isSelfHealing && (
                <span className="mt-1 text-[9px] uppercase tracking-wider font-semibold text-emerald-400 bg-emerald-600/10 rounded px-1.5 py-0.5 shrink-0">
                  recovery
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
