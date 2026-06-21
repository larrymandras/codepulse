/**
 * CostBreakdown — per-goal cost total + table + sparkline + runaway warning + model-tier flag.
 *
 * Phase 149-04 — PULSE-04.
 * Implements D-10 (cost depth: total + per-model table + sparkline),
 * D-11 (configurable runaway threshold + warning state),
 * D-12 (explicit per-goal model-tier flag).
 *
 * Replaces the legacy CostBreakdown stub (which used api.llm.costByModel).
 * Now goal-scoped via useCostByGoal(goalId) → api.aggregates.costByGoalPeriod.
 */

import { DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FlexBarChart } from "./FlexBarChart";
import { useCostByGoal, useLlmByGoal } from "../hooks/useCostByGoal";

// ── D-11: Configurable runaway threshold (module constant per threat model T-149-10) ──
export const RUNAWAY_THRESHOLD = 0.50;

// ── Model-tier flag logic ───────────────────────────────────────────────────
type TierFlag = "TIER OK" | "OPUS WORKER" | "CHECKING...";

/**
 * Determine the model-tier flag state from raw llmByGoal rows.
 * - "OPUS WORKER" (red) if any non-queen agentId has a model containing "opus"
 * - "TIER OK" (green) if data is loaded and no such worker found
 * - "CHECKING..." (muted) if no data yet / goalId null
 */
function computeTierFlag(
  llmRows: Array<{ agentId?: string; model: string }>,
  goalId: string | null | undefined
): TierFlag {
  if (!goalId) return "CHECKING...";
  // Empty rows with a valid goalId means still loading — show CHECKING...
  if (llmRows.length === 0) return "CHECKING...";
  const hasOpusWorker = llmRows.some(
    (r) => r.agentId !== "queen" && r.model.toLowerCase().includes("opus")
  );
  return hasOpusWorker ? "OPUS WORKER" : "TIER OK";
}

// ── Tier flag visual classes ────────────────────────────────────────────────
const tierFlagConfig: Record<TierFlag, { dotClass: string; labelClass: string }> = {
  "TIER OK": {
    dotClass: "w-2 h-2 rounded-full bg-[#10b981]",
    labelClass: "text-[10px] font-mono text-[#10b981]",
  },
  "OPUS WORKER": {
    dotClass: "w-2 h-2 rounded-full bg-[#ef4444] animate-pulse",
    labelClass: "text-[10px] font-mono text-[#ef4444]",
  },
  "CHECKING...": {
    dotClass: "w-2 h-2 rounded-full bg-muted-foreground/50",
    labelClass: "text-[10px] font-mono text-muted-foreground",
  },
};

interface CostBreakdownProps {
  goalId?: string | null | undefined;
}

export default function CostBreakdown({ goalId }: CostBreakdownProps) {
  const { rows, totalCost } = useCostByGoal(goalId);
  const llmRows = useLlmByGoal(goalId);

  const isRunaway = totalCost > RUNAWAY_THRESHOLD;
  const tierFlag = computeTierFlag(llmRows, goalId);
  const { dotClass, labelClass } = tierFlagConfig[tierFlag];

  // Sparkline data: one bar per cost row (label=model, value=cost)
  const sparklineData = rows.map((r) => ({
    label: r.model,
    value: r.cost,
  }));

  return (
    <div
      className={
        isRunaway
          ? "border border-[#eab308]/40 shadow-[0_0_15px_rgba(234,179,8,0.15)] rounded-xl p-1"
          : ""
      }
    >
      {/* Header: COST label + live-pulse dot + runaway warning badge + tier flag */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2
            className={`text-[10px] font-mono uppercase tracking-widest flex items-center gap-2 ${
              isRunaway ? "text-[#eab308]" : "text-primary"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full animate-pulse ${
                isRunaway ? "bg-[#eab308]" : "bg-primary"
              }`}
            />
            COST
          </h2>
          {isRunaway && (
            <Badge
              variant="outline"
              className="border-[#eab308]/60 text-[#eab308] bg-[#eab308]/10 text-[10px] font-mono"
            >
              COST WARNING
            </Badge>
          )}
        </div>

        {/* Model-tier flag */}
        <div className="flex items-center gap-1.5">
          <span className={dotClass} />
          <span className={labelClass}>{tierFlag}</span>
        </div>
      </div>

      {rows.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
          <DollarSign className="h-6 w-6 text-muted-foreground/50" />
          <p className="text-xs font-medium text-foreground">No cost data yet</p>
          <p className="text-xs text-muted-foreground">
            Costs will accumulate as LLM calls are made during the swarm run.
          </p>
        </div>
      ) : (
        <div className="flex gap-4">
          {/* Left column (60%): total cost + per-model table */}
          <div className="flex-[3] min-w-0">
            {/* Total cost metric */}
            <div className="mb-3">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-0.5">
                TOTAL COST
              </p>
              <p
                className={`text-xl font-semibold tabular-nums ${
                  isRunaway ? "text-[#eab308]" : "text-foreground"
                }`}
              >
                ${totalCost.toFixed(4)}
              </p>
            </div>

            {/* Per-(provider, model) table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground h-7 px-1">
                    Provider
                  </TableHead>
                  <TableHead className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground h-7 px-1">
                    Model
                  </TableHead>
                  <TableHead className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground h-7 px-1">
                    Cost
                  </TableHead>
                  <TableHead className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground h-7 px-1">
                    %
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => {
                  const isOpus = row.model.toLowerCase().includes("opus");
                  const pct =
                    totalCost > 0
                      ? ((row.cost / totalCost) * 100).toFixed(1)
                      : "0.0";
                  return (
                    <TableRow
                      key={`${row.provider}-${row.model}-${i}`}
                      className={isOpus ? "bg-amber-500/10" : ""}
                    >
                      <TableCell
                        className={`text-xs tabular-nums px-1 py-1 ${isOpus ? "text-amber-300" : ""}`}
                      >
                        {row.provider}
                      </TableCell>
                      <TableCell
                        className={`text-xs tabular-nums px-1 py-1 ${isOpus ? "text-amber-300" : ""}`}
                      >
                        {row.model}
                      </TableCell>
                      <TableCell
                        className={`text-xs tabular-nums px-1 py-1 ${isOpus ? "text-amber-300" : ""}`}
                      >
                        ${row.cost.toFixed(4)}
                      </TableCell>
                      <TableCell
                        className={`text-xs tabular-nums px-1 py-1 ${isOpus ? "text-amber-300" : ""}`}
                      >
                        {pct}%
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Right column (40%): sparkline + label */}
          <div className="flex-[2] min-w-0 flex flex-col gap-2">
            <FlexBarChart data={sparklineData} height={48} />
            <p className="text-[10px] font-mono text-muted-foreground">cost trend</p>
          </div>
        </div>
      )}
    </div>
  );
}
