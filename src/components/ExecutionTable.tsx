import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import StatusBadge from "./StatusBadge";
import ReplayButton from "./ReplayButton";
import CancelButton from "./CancelButton";

interface ExecutionRow {
  _id: string;
  executionId: string;
  toolName: string;
  origin: string;
  profileId: string;
  channelId?: string;
  status: string;
  queuedAt: number;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  errorMessage?: string;
  contextSnapshot?: any;
  parentExecutionId?: string;
  cancelRequested?: boolean;
}

interface ExecutionTableProps {
  executions: ExecutionRow[] | undefined;
  hasActiveFilters: boolean;
}

function formatTime(epochSeconds: number): string {
  const d = new Date(epochSeconds * 1000);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (isToday) {
    return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }
  return `${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getDate().toString().padStart(2, "0")} ${d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })}`;
}

function formatDuration(ms?: number): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTs(epochSeconds?: number): string {
  if (!epochSeconds) return "—";
  return new Date(epochSeconds * 1000).toLocaleString();
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="bg-gray-700/30 animate-pulse h-8 rounded flex-1" />
      ))}
    </div>
  );
}

export default function ExecutionTable({ executions, hasActiveFilters }: ExecutionTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Execution mode data: map executionId -> mode record
  const executionModeData = useQuery(api.executionModes.recent, { limit: 100 });
  const modeMap = useMemo(() => {
    const map = new Map<string, { mode: string; roundsDepth: number; fillerCount?: number; stalledAt?: number }>();
    executionModeData?.forEach((em) =>
      map.set(em.executionId, {
        mode: em.mode,
        roundsDepth: em.roundsDepth,
        fillerCount: em.fillerCount,
        stalledAt: em.stalledAt,
      })
    );
    return map;
  }, [executionModeData]);

  const handleRowClick = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  if (executions === undefined) {
    return (
      <div className="max-h-[360px] overflow-y-auto">
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    );
  }

  if (executions.length === 0) {
    return (
      <p className="text-base text-gray-500 py-6 text-center">
        {hasActiveFilters
          ? "No executions match these filters."
          : "No executions recorded yet. Tool calls will appear here as Astridr runs."}
      </p>
    );
  }

  return (
    <div className="max-h-[360px] overflow-y-auto">
      {/* Sticky header */}
      <div className="grid grid-cols-[100px_1fr_80px_80px_80px_70px_100px_80px_60px_140px] items-center gap-2 px-3 py-1.5 text-xs text-gray-500 uppercase tracking-wider border-b border-gray-700/30 bg-gray-800/80 sticky top-0 z-10">
        <span>Time</span>
        <span>Command</span>
        <span>Origin</span>
        <span>Channel</span>
        <span>Profile</span>
        <span>Duration</span>
        <span>Status</span>
        <span>Mode</span>
        <span>Depth</span>
        <span>Actions</span>
      </div>

      {/* Rows */}
      {executions.map((row, i) => {
        const isExpanded = expandedId === row._id;
        const isReplayable = ["failed", "cancelled", "timed_out"].includes(row.status);
        const isCancellable = row.status === "running";
        const modeData = modeMap.get(row.executionId);

        return (
          <div key={row._id}>
            <div
              className={`grid grid-cols-[100px_1fr_80px_80px_80px_70px_100px_80px_60px_140px] items-center gap-2 px-3 py-2 cursor-pointer transition-colors hover:bg-gray-800/50 ${
                i % 2 === 0 ? "bg-gray-800/30" : ""
              }`}
              onClick={() => handleRowClick(row._id)}
            >
              {/* Time */}
              <span className="text-sm text-gray-500 font-mono truncate">
                {formatTime(row.queuedAt)}
              </span>

              {/* Command */}
              <span className="text-sm text-gray-200 font-mono truncate">
                {row.toolName}
              </span>

              {/* Origin */}
              <span className="text-sm text-gray-400 truncate">
                {row.origin}
              </span>

              {/* Channel */}
              <span className="text-sm text-gray-400 truncate">
                {row.channelId ?? "—"}
              </span>

              {/* Profile */}
              <span className="text-sm text-gray-400 truncate">
                {row.profileId}
              </span>

              {/* Duration */}
              <span className="text-sm text-gray-400">
                {formatDuration(row.durationMs)}
              </span>

              {/* Status */}
              <span onClick={(e) => e.stopPropagation()}>
                <StatusBadge status={row.status} />
              </span>

              {/* Mode badge + filler/stall indicators */}
              <span className="flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
                {modeData?.mode ? (
                  <StatusBadge status={modeData.mode} />
                ) : (
                  <span className="text-sm text-gray-600">—</span>
                )}
                {(modeData?.fillerCount ?? 0) > 0 && (
                  <span className="text-xs" style={{ color: "var(--status-warn)" }}>
                    {modeData!.fillerCount} fillers
                  </span>
                )}
                {modeData?.stalledAt != null && (
                  <span className="text-xs" style={{ color: "var(--status-error)" }}>stalled</span>
                )}
              </span>

              {/* Rounds depth */}
              <span className="tabular-nums text-sm text-muted-foreground">
                {modeData?.roundsDepth != null ? `${modeData.roundsDepth}r` : "—"}
              </span>

              {/* Actions */}
              <span
                className="flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                {isReplayable && (
                  <ReplayButton
                    executionId={row.executionId}
                    profileId={row.profileId}
                    disabled={false}
                  />
                )}
                {isCancellable && (
                  <CancelButton executionId={row.executionId} />
                )}
              </span>
            </div>

            {/* Expanded detail panel */}
            {isExpanded && (
              <div className="bg-gray-900/40 rounded-lg p-4 ml-6 mr-3 mb-1 space-y-2 border border-gray-700/20">
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Command</span>
                  <pre className="text-sm font-mono text-gray-200 mt-0.5 whitespace-pre-wrap break-all">
                    {row.toolName}
                  </pre>
                </div>

                {row.contextSnapshot?.kwargs && (
                  <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Arguments</span>
                    <pre className="text-sm font-mono text-gray-400 mt-0.5 whitespace-pre-wrap break-all">
                      {JSON.stringify(row.contextSnapshot.kwargs, null, 2)}
                    </pre>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Origin: </span>
                    <span className="text-gray-300">{row.origin}</span>
                  </div>
                  {row.parentExecutionId && (
                    <div>
                      <span className="text-gray-500">Parent ID: </span>
                      <span className="text-gray-300 font-mono">{row.parentExecutionId}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Queued: </span>
                    <span className="text-gray-300">{formatTs(row.queuedAt)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Started: </span>
                    <span className="text-gray-300">{formatTs(row.startedAt)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Completed: </span>
                    <span className="text-gray-300">{formatTs(row.completedAt)}</span>
                  </div>
                </div>

                {modeData && (
                  <div className="grid grid-cols-3 gap-2 text-sm border-t border-gray-700/30 pt-2">
                    <div>
                      <span className="text-gray-500">Mode: </span>
                      <span className="text-gray-300 capitalize">{modeData.mode}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Rounds: </span>
                      <span className="tabular-nums text-gray-300">{modeData.roundsDepth}</span>
                    </div>
                    {(modeData.fillerCount ?? 0) > 0 && (
                      <div>
                        <span className="text-gray-500">Fillers: </span>
                        <span className="tabular-nums" style={{ color: "var(--status-warn)" }}>{modeData.fillerCount}</span>
                      </div>
                    )}
                    {modeData.stalledAt != null && (
                      <div>
                        <span className="text-gray-500">Stalled at: </span>
                        <span style={{ color: "var(--status-error)" }}>{formatTs(modeData.stalledAt)}</span>
                      </div>
                    )}
                  </div>
                )}

                {row.errorMessage && (
                  <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Error</span>
                    <p className="text-sm text-red-300 mt-0.5">{row.errorMessage}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
