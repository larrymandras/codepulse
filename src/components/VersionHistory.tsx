import { formatTimestamp } from "../lib/formatters";

interface VersionHistoryProps {
  versions: any[];
}

export default function VersionHistory({ versions }: VersionHistoryProps) {
  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide mb-4">
        Version History
      </h2>

      {versions.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">
          No version history recorded
        </p>
      ) : (
        <div className="space-y-1">
          {versions.map((v: any) => (
            <div
              key={v._id}
              className="flex items-center gap-3 bg-gray-900/30 rounded-lg px-4 py-2.5"
            >
              <span className="text-sm font-mono text-cyan-400 shrink-0">
                {v.version}
              </span>
              <span className="text-sm text-gray-300 font-mono truncate flex-1">
                {v.component}
              </span>
              {v.previousVersion && (
                <span className="text-xs text-gray-500 shrink-0">
                  from {v.previousVersion}
                </span>
              )}
              {v.changedBy && (
                <span className="text-xs text-gray-500 shrink-0">
                  {v.changedBy}
                </span>
              )}
              <span className="text-xs text-gray-500 font-mono shrink-0">
                {formatTimestamp(v.changedAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
