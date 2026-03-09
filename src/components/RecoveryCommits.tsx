import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

function relativeTime(ts: number): string {
  const diff = Math.max(0, Date.now() / 1000 - ts);
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function RecoveryCommits() {
  const commits = useQuery(api.git.recentCommits, { limit: 15 }) ?? [];

  // Filter to self-healing commits
  const recoveryCommits = commits.filter(
    (c: any) =>
      c.author === "astridr-self-healing" ||
      c.message.startsWith("[self-healing]")
  );

  if (recoveryCommits.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">
          Recovery Commits
        </h2>
        <p className="text-sm text-gray-500 py-4 text-center">
          No recovery commits recorded yet
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">
        Recovery Commits
      </h2>
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {recoveryCommits.map((c: any) => (
          <div
            key={c._id}
            className="flex items-start gap-3 bg-gray-900/30 rounded-lg px-3 py-2"
          >
            <div className="mt-1 w-6 h-6 rounded-full bg-emerald-600/20 flex items-center justify-center shrink-0">
              <svg
                className="w-3.5 h-3.5 text-emerald-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
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
                <span>
                  {c.filesChanged} file{c.filesChanged !== 1 ? "s" : ""}
                </span>
                <span className="ml-auto">{relativeTime(c.timestamp)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
