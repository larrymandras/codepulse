import { useDriftChanges, useDriftSummary } from "../hooks/useDrift";
import { usePrivacyMask } from "../hooks/usePrivacyMask";

function relativeTime(ts: number): string {
  const now = Date.now() / 1000;
  const diff = Math.max(0, now - ts);
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const changeTypeConfig: Record<string, { dot: string; label: string }> = {
  added: { dot: "bg-green-400", label: "Added" },
  removed: { dot: "bg-red-400", label: "Removed" },
  modified: { dot: "bg-yellow-400", label: "Modified" },
};

function VelocityBar({ data }: { data: number[] }) {
  if (data.length === 0) return null;
  const max = Math.max(...data, 1);

  return (
    <div className="flex items-end gap-1 h-8">
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t bg-indigo-500/60 transition-all"
          style={{ height: `${(v / max) * 100}%`, minHeight: v > 0 ? "2px" : "0" }}
          title={`${v} changes`}
        />
      ))}
    </div>
  );
}

export default function DriftTimeline() {
  const changes = useDriftChanges();
  const summary = useDriftSummary();
  const { mask } = usePrivacyMask();

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-300">Config Drift</h2>
          {summary.isDrifting && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 font-medium">
              DRIFTING
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-gray-500">
          <span>{summary.changesLastHour} / hr</span>
          <span>{summary.changesLast24h} / 24h</span>
        </div>
      </div>

      {/* Summary row: categories + velocity */}
      <div className="flex items-center gap-4 mb-3">
        {/* Category badges */}
        <div className="flex items-center gap-1.5 flex-wrap flex-1">
          {Object.entries(summary.byCategory).map(([cat, count]) => (
            <span
              key={cat}
              className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-300 border border-gray-600/30"
            >
              {cat}: {count}
            </span>
          ))}
          {Object.keys(summary.byCategory).length === 0 && (
            <span className="text-[10px] text-gray-500">No changes</span>
          )}
        </div>
        {/* Velocity chart */}
        <div className="w-20 shrink-0">
          <VelocityBar data={summary.velocity} />
          <p className="text-[9px] text-gray-600 text-center mt-0.5">24h velocity</p>
        </div>
      </div>

      {/* Timeline */}
      {changes.length === 0 ? (
        <p className="text-gray-500 text-sm">No data yet.</p>
      ) : (
        <div className="space-y-0 max-h-[300px] overflow-y-auto pr-1">
          {changes.slice(0, 30).map((c) => {
            const ct = changeTypeConfig[c.changeType] ?? changeTypeConfig.modified;
            const keyParts = c.configKey.split(":");
            const prefix = keyParts[0];
            const name = keyParts.slice(1).join(":") || c.configKey;

            return (
              <div key={c.id} className="flex items-start gap-3 py-1.5 border-b border-gray-700/30 last:border-0">
                {/* Timeline dot + line */}
                <div className="flex flex-col items-center pt-1.5 shrink-0">
                  <span className={`w-2 h-2 rounded-full ${ct.dot}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] px-1 py-0.5 rounded bg-gray-700/50 text-gray-400">
                      {prefix}
                    </span>
                    <span className="text-xs text-gray-200 font-medium truncate">
                      {name}
                    </span>
                    <span className={`text-[10px] ${ct.dot.replace("bg-", "text-")}`}>
                      {ct.label}
                    </span>
                  </div>
                  {c.changeType === "modified" && c.oldValue != null && (
                    <p className="text-[10px] text-gray-500 truncate mt-0.5">
                      {mask(typeof c.oldValue === "string" ? c.oldValue : JSON.stringify(c.oldValue))} →{" "}
                      {mask(typeof c.newValue === "string" ? c.newValue : JSON.stringify(c.newValue))}
                    </p>
                  )}
                </div>

                {/* Timestamp */}
                <span className="text-[10px] text-gray-600 shrink-0 pt-0.5">
                  {relativeTime(c.changedAt)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
