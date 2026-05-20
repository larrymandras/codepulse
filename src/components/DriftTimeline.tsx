import { useState, useMemo } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useDriftChanges, useDriftSummary } from "../hooks/useDrift";
import { usePrivacyMask } from "../hooks/usePrivacyMask";
import type { Id } from "../../convex/_generated/dataModel";
import InfoTooltip from "./InfoTooltip";

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

const CHANGE_TYPES = ["All", "Added", "Modified", "Removed"] as const;

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

function PillButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-[10px] px-2 py-0.5 rounded-sm border font-mono transition-colors uppercase tracking-widest ${
        active
          ? "bg-primary/20 text-primary border-primary"
          : "bg-muted/30 text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/50"
      }`}
    >
      {children}
    </button>
  );
}

export default function DriftTimeline() {
  const changes = useDriftChanges();
  const summary = useDriftSummary();
  const { mask } = usePrivacyMask();
  const acknowledge = useMutation(api.drift.acknowledgeChange);
  const acknowledgeAll = useMutation(api.drift.acknowledgeAll);
  const [fadingIds, setFadingIds] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [changeTypeFilter, setChangeTypeFilter] = useState<string>("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmingAckAll, setConfirmingAckAll] = useState(false);

  // Derive categories dynamically from data
  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const c of changes) {
      const prefix = c.configKey.split(":")[0] || "other";
      cats.add(prefix);
    }
    return ["All", ...Array.from(cats).sort()];
  }, [changes]);

  // Filter changes
  const filteredChanges = useMemo(() => {
    return changes.filter((c) => {
      if (categoryFilter !== "All") {
        const prefix = c.configKey.split(":")[0] || "other";
        if (prefix !== categoryFilter) return false;
      }
      if (changeTypeFilter !== "All") {
        if (c.changeType !== changeTypeFilter.toLowerCase()) return false;
      }
      return true;
    });
  }, [changes, categoryFilter, changeTypeFilter]);

  const handleAcknowledge = async (id: string) => {
    setFadingIds((prev) => new Set(prev).add(id));
    setTimeout(async () => {
      await acknowledge({ id: id as Id<"configChanges"> });
    }, 300);
  };

  const handleAcknowledgeAll = async () => {
    if (!confirmingAckAll) {
      setConfirmingAckAll(true);
      return;
    }
    const ids = filteredChanges.map((c) => c.id as Id<"configChanges">);
    if (ids.length === 0) return;
    const idSet = new Set(ids.map((id) => String(id)));
    setFadingIds((prev) => new Set([...prev, ...idSet]));
    setTimeout(async () => {
      await acknowledgeAll({ ids });
      setConfirmingAckAll(false);
    }, 300);
  };

  const handleToggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="glow-card bg-card/60 backdrop-blur-md border border-border/50 rounded-xl p-6 relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 border-b border-border/30 pb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-mono tracking-widest text-primary uppercase flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Config Drift
            <InfoTooltip text="Configuration change timeline tracking drift across MCP servers, plugins, and settings" />
          </h2>
          {summary.isDrifting && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-500 border border-yellow-500/40 font-mono uppercase tracking-widest animate-pulse">
              DRIFTING
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {filteredChanges.length > 0 && (
            <button
              onClick={handleAcknowledgeAll}
              onBlur={() => setConfirmingAckAll(false)}
              className={`text-[10px] px-3 py-1 rounded border font-mono uppercase tracking-widest transition-colors ${
                confirmingAckAll
                  ? "bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30"
                  : "bg-background/50 text-muted-foreground border-border/30 hover:text-foreground hover:border-border/50"
              }`}
            >
              {confirmingAckAll
                ? `Confirm (${filteredChanges.length})`
                : `Ack All (${filteredChanges.length})`}
            </button>
          )}
          <div className="flex items-center gap-3 text-[10px] font-mono tracking-widest uppercase text-muted-foreground">
            <span className="flex gap-1.5"><span className="text-primary/70">{summary.changesLastHour}</span> / hr</span>
            <span className="flex gap-1.5"><span className="text-primary/70">{summary.changesLast24h}</span> / 24h</span>
          </div>
        </div>
      </div>

      {/* Category filter pills */}
      {categories.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          {categories.map((cat) => (
            <PillButton
              key={cat}
              active={categoryFilter === cat}
              onClick={() => setCategoryFilter(cat)}
            >
              {cat}
              {cat !== "All" && summary.byCategory[cat] != null && (
                <span className="ml-1 opacity-60">{summary.byCategory[cat]}</span>
              )}
            </PillButton>
          ))}
        </div>
      )}

      {/* Change type filter pills */}
      <div className="flex items-center gap-1.5 mb-3">
        {CHANGE_TYPES.map((ct) => (
          <PillButton
            key={ct}
            active={changeTypeFilter === ct}
            onClick={() => setChangeTypeFilter(ct)}
          >
            {ct}
          </PillButton>
        ))}
      </div>

      {/* Summary row: categories + velocity */}
      <div className="flex items-center gap-4 mb-3">
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
        <div className="w-20 shrink-0">
          <VelocityBar data={summary.velocity} />
          <p className="text-[9px] text-gray-600 text-center mt-0.5">24h velocity</p>
        </div>
      </div>

      {/* Timeline */}
      {filteredChanges.length === 0 ? (
        <p className="text-gray-500 text-sm">
          {changes.length === 0 ? "No data yet." : "No changes match filters."}
        </p>
      ) : (
        <div className="space-y-0 max-h-[300px] overflow-y-auto pr-1">
          {filteredChanges.slice(0, 30).map((c) => {
            const ct = changeTypeConfig[c.changeType] ?? changeTypeConfig.modified;
            const keyParts = c.configKey.split(":");
            const prefix = keyParts[0];
            const name = keyParts.slice(1).join(":") || c.configKey;
            const isFading = fadingIds.has(String(c.id));
            const isExpanded = expandedId === String(c.id);

            return (
              <div
                key={String(c.id)}
                className={`border-b border-gray-700/30 last:border-0 transition-opacity duration-300 ${
                  isFading ? "opacity-0" : "opacity-100"
                }`}
              >
                <div
                  className="flex items-start gap-3 py-1.5 cursor-pointer hover:bg-gray-700/20 rounded px-1 -mx-1"
                  onClick={() => handleToggleExpand(String(c.id))}
                >
                  {/* Timeline dot */}
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
                      <span className="text-[10px] text-gray-600 ml-auto">
                        {isExpanded ? "▾" : "▸"}
                      </span>
                    </div>
                    {!isExpanded && c.changeType === "modified" && c.oldValue != null && (
                      <p className="text-[10px] text-gray-500 truncate mt-0.5">
                        {mask(typeof c.oldValue === "string" ? c.oldValue : JSON.stringify(c.oldValue))}{" "}
                        →{" "}
                        {mask(typeof c.newValue === "string" ? c.newValue : JSON.stringify(c.newValue))}
                      </p>
                    )}
                  </div>

                  {/* Acknowledge button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAcknowledge(String(c.id));
                    }}
                    disabled={isFading}
                    className="text-gray-600 hover:text-green-400 transition-colors text-xs px-1 pt-0.5 shrink-0"
                    title="Acknowledge change"
                  >
                    ✓
                  </button>

                  {/* Timestamp */}
                  <span className="text-[10px] text-gray-600 shrink-0 pt-0.5">
                    {relativeTime(c.changedAt)}
                  </span>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="ml-7 mb-2 p-2 bg-gray-900/40 rounded-lg border border-gray-700/30 text-[11px]">
                    {c.oldValue != null && (
                      <div className="mb-1.5">
                        <span className="text-gray-500 font-medium">Old value:</span>
                        <pre className="text-red-300/80 mt-0.5 whitespace-pre-wrap break-all bg-gray-900/50 rounded px-2 py-1">
                          {mask(typeof c.oldValue === "string" ? c.oldValue : JSON.stringify(c.oldValue, null, 2))}
                        </pre>
                      </div>
                    )}
                    {c.newValue != null && (
                      <div className="mb-1.5">
                        <span className="text-gray-500 font-medium">New value:</span>
                        <pre className="text-green-300/80 mt-0.5 whitespace-pre-wrap break-all bg-gray-900/50 rounded px-2 py-1">
                          {mask(typeof c.newValue === "string" ? c.newValue : JSON.stringify(c.newValue, null, 2))}
                        </pre>
                      </div>
                    )}
                    {c.changedBy && (
                      <div>
                        <span className="text-gray-500 font-medium">Changed by:</span>{" "}
                        <span className="text-gray-300">{c.changedBy}</span>
                      </div>
                    )}
                    {!c.oldValue && !c.newValue && !c.changedBy && (
                      <span className="text-gray-500">No additional details available.</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
