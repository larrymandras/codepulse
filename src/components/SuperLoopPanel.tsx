import { useState } from "react";
import InfoTooltip from "./InfoTooltip";

interface SuperLoopIteration {
  loopId: string;
  profileId: string;
  goal?: string;
  cycleNum: number;
  goalComplete: boolean;
  confidence: number;
  outcome?: string;
  status?: string;
  totalCycles?: number;
  timestamp: number;
}

interface SuperLoopPanelProps {
  iterations: SuperLoopIteration[];
}

const statusColors: Record<string, string> = {
  running: "text-indigo-400 bg-indigo-400/10",
  completed: "text-green-400 bg-green-400/10",
  max_reached: "text-yellow-400 bg-yellow-400/10",
  cancelled: "text-gray-500 bg-gray-800/50",
  failed: "text-red-400 bg-red-400/10",
};

const dotColors: Record<string, string> = {
  running: "bg-indigo-400",
  completed: "bg-green-400",
  max_reached: "bg-yellow-400",
  cancelled: "bg-gray-500",
  failed: "bg-red-400",
};

function getStatusLabel(iteration: SuperLoopIteration): string {
  const status = iteration.status ?? "running";
  const cycle = iteration.cycleNum;
  const total = iteration.totalCycles;

  if (status === "running") {
    return total ? `Cycle ${cycle}/${total}` : `Cycle ${cycle}`;
  }
  if (status === "completed") {
    return `Goal reached in ${total ?? cycle} cycles`;
  }
  if (status === "cancelled") {
    return `Cancelled at cycle ${cycle}`;
  }
  if (status === "failed" || status === "max_reached") {
    return `Stopped after ${total ?? cycle} cycles`;
  }
  return `Cycle ${cycle}`;
}

function sortLoops(
  loops: Map<string, SuperLoopIteration[]>
): [string, SuperLoopIteration[]][] {
  const entries = Array.from(loops.entries());
  return entries.sort(([, aIters], [, bIters]) => {
    const aLatest = aIters[0];
    const bLatest = bIters[0];
    const aStatus = aLatest?.status ?? "running";
    const bStatus = bLatest?.status ?? "running";

    const order = (s: string) => {
      if (s === "running") return 0;
      if (s === "completed" || s === "max_reached") return 2;
      return 1;
    };
    const oa = order(aStatus);
    const ob = order(bStatus);
    if (oa !== ob) return oa - ob;
    return (bLatest?.timestamp ?? 0) - (aLatest?.timestamp ?? 0);
  });
}

export default function SuperLoopPanel({ iterations }: SuperLoopPanelProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpand(loopId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(loopId)) {
        next.delete(loopId);
      } else {
        next.add(loopId);
      }
      return next;
    });
  }

  // Group iterations by loopId; sort each group by cycleNum desc (latest first)
  const loopMap = new Map<string, SuperLoopIteration[]>();
  for (const iter of iterations) {
    const existing = loopMap.get(iter.loopId) ?? [];
    existing.push(iter);
    loopMap.set(iter.loopId, existing);
  }
  for (const [id, iters] of loopMap.entries()) {
    loopMap.set(
      id,
      iters.sort((a, b) => b.cycleNum - a.cycleNum)
    );
  }

  const sortedLoops = sortLoops(loopMap);

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">
        Super Loops{" "}
        <span className="ml-2 text-xs text-gray-500 font-normal">
          {sortedLoops.length}
        </span>
        <InfoTooltip text="Autonomous multi-cycle agent loops — agents iterate toward a goal, carrying forward structured learnings each cycle" />
      </h2>

      {sortedLoops.length === 0 ? (
        <div>
          <p className="text-sm text-gray-500 py-6 text-center">No active loops</p>
          <p className="text-xs text-gray-600 text-center">
            Agents can start a super loop using the start_super_loop tool. Each loop
            runs up to N cycles toward a stated goal.
          </p>
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-0">
          {sortedLoops.map(([loopId, iters]) => {
            const latest = iters[0];
            const status = latest?.status ?? "running";
            const isRunning = status === "running";
            const isExpanded = expanded.has(loopId);
            const dotClass = dotColors[status] ?? "bg-gray-500";
            const statusClass = statusColors[status] ?? "text-gray-500 bg-gray-800/50";

            return (
              <div key={loopId}>
                {/* Loop row */}
                <div
                  className="flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer hover:bg-gray-700/20 rounded"
                  onClick={() => toggleExpand(loopId)}
                >
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${dotClass}${isRunning ? " animate-pulse" : ""}`}
                  />
                  <span className="font-mono text-xs text-indigo-400 shrink-0 w-16">
                    {getStatusLabel(latest)}
                  </span>
                  {latest?.goal && (
                    <span className="text-gray-200 truncate flex-1">{latest.goal}</span>
                  )}
                  {!latest?.goal && (
                    <span className="text-gray-500 truncate flex-1 italic">
                      {loopId.slice(0, 16)}
                    </span>
                  )}
                  <span className="text-[10px] text-gray-500 bg-gray-900/50 px-1.5 py-0.5 rounded shrink-0">
                    {latest?.profileId}
                  </span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${statusClass}`}
                  >
                    {status}
                  </span>
                </div>

                {/* Expanded cycle list */}
                {isExpanded && (
                  <div className="ml-4 max-h-48 overflow-y-auto">
                    <p className="text-[10px] text-gray-500 px-2 py-1 font-semibold uppercase tracking-wide">
                      Cycle Learnings
                    </p>
                    {iters.map((iter) => (
                      <div
                        key={`${iter.loopId}-${iter.cycleNum}`}
                        className="px-2 py-1.5 space-y-1"
                      >
                        <div className="flex items-center gap-2 text-xs">
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              iter.goalComplete ? "bg-green-400" : "bg-gray-500"
                            }`}
                          />
                          <span className="text-gray-400 shrink-0">
                            Cycle {iter.cycleNum}
                          </span>
                          {iter.outcome && (
                            <span className="text-gray-300 truncate flex-1">
                              {iter.outcome}
                            </span>
                          )}
                          <span className="text-[10px] text-gray-500 shrink-0">
                            {Math.round(iter.confidence * 100)}%
                          </span>
                        </div>
                        {/* Confidence bar */}
                        <div className="w-full h-1 bg-gray-900/50 rounded-full">
                          <div
                            className="h-1 bg-indigo-400 rounded-full"
                            style={{ width: `${Math.min(iter.confidence * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
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
