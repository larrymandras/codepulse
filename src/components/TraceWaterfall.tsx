import { useMemo } from "react";
import { useQuery } from "convex/react";
import { ChevronRight } from "lucide-react";
import { api } from "../../convex/_generated/api";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import MetricCard from "./MetricCard";
import { formatCost, formatDurationMs } from "../lib/formatters";

// ─── Types ────────────────────────────────────────────────────────────────

/** Row shape returned by api.llm.sessionCalls (convex/schema.ts llmMetrics). */
export interface LlmCallRow {
  _id?: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number; // MILLISECONDS
  cost?: number;
  sessionId?: string;
  timestamp: number; // UNIX SECONDS (not ms)
  agentId?: string;
  toolName?: string;
  billingType?: string;
  goalId?: string;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
  traceId?: string;
}

export type CacheBadgeState = "HIT" | "MISS" | "NO_DATA";

export interface TraceGroup {
  traceId: string | undefined;
  rows: LlmCallRow[];
  earliestTimestamp: number;
}

// ─── Pure helpers (Task 1 — the testable contract) ─────────────────────────

const UNTRACED_KEY = "__untraced__";

/**
 * Group rows by traceId. Rows sharing a traceId land in one group keyed by
 * that traceId. Rows with traceId === undefined land in a single untraced
 * bucket. Groups are ordered by their earliest row timestamp; the untraced
 * bucket is always last regardless of its own earliest timestamp.
 */
export function groupByTrace(rows: LlmCallRow[]): TraceGroup[] {
  const groups = new Map<string, LlmCallRow[]>();

  for (const row of rows) {
    const key = row.traceId ?? UNTRACED_KEY;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  const traced: TraceGroup[] = [];
  let untraced: TraceGroup | undefined;

  for (const [key, groupRows] of groups) {
    const earliestTimestamp = Math.min(...groupRows.map((r) => r.timestamp));
    if (key === UNTRACED_KEY) {
      untraced = { traceId: undefined, rows: groupRows, earliestTimestamp };
    } else {
      traced.push({ traceId: key, rows: groupRows, earliestTimestamp });
    }
  }

  traced.sort((a, b) => a.earliestTimestamp - b.earliestTimestamp);

  return untraced ? [...traced, untraced] : traced;
}

/**
 * Bar math for a single call row. timestamp is in SECONDS, latencyMs is in
 * MILLISECONDS — start/width are both computed in the seconds domain.
 */
export function barMetrics(row: {
  timestamp: number;
  latencyMs: number;
}): { start: number; width: number } {
  const width = row.latencyMs / 1000;
  const start = row.timestamp - width;
  return { start, width };
}

/**
 * Three-state cache badge. Never conflates undefined (no cache data at all,
 * legacy row) with 0 (cache fields present, zero cache reads).
 */
export function cacheBadge(row: {
  cacheReadInputTokens?: number;
}): CacheBadgeState {
  if (row.cacheReadInputTokens === undefined) return "NO_DATA";
  return row.cacheReadInputTokens > 0 ? "HIT" : "MISS";
}

/**
 * Cost label. Never estimates — a missing cost renders as "n/a", not a
 * computed/guessed number.
 */
export function costLabel(row: { cost?: number }): string {
  return typeof row.cost === "number" ? formatCost(row.cost) : "n/a";
}

// ─── Render-only helpers ────────────────────────────────────────────────────

const ROW_HEIGHT = 36; // inherited verbatim from the sibling swimlane component's row-height constant (house exception)

/** Session-wide time axis: seconds domain, right edge extends to "now" so a live session's axis keeps growing. */
function computeTimeRange(rows: LlmCallRow[]) {
  const now = Date.now() / 1000;
  const starts = rows.map((r) => barMetrics(r).start);
  const ends = rows.map((r) => r.timestamp);
  const minTs = Math.min(...starts, ...ends);
  const maxTs = Math.max(...ends, now);
  const range = Math.max(maxTs - minTs, 1);
  return { minTs, maxTs, range };
}

/** Summary-strip aggregates, computed only from real measured fields — no estimation. */
function computeSummary(rows: LlmCallRow[]) {
  let totalCost = 0;
  let callsWithoutCost = 0;
  let totalTokens = 0;
  let cacheReadSum = 0;
  let promptTokenSum = 0;

  for (const row of rows) {
    if (typeof row.cost === "number") {
      totalCost += row.cost;
    } else {
      callsWithoutCost += 1;
    }
    totalTokens += row.totalTokens;
    if (typeof row.cacheReadInputTokens === "number") {
      cacheReadSum += row.cacheReadInputTokens;
    }
    promptTokenSum += row.promptTokens;
  }

  const cacheDenominator = cacheReadSum + promptTokenSum;
  const cacheRatio = cacheDenominator > 0 ? cacheReadSum / cacheDenominator : 0;

  return { totalCost, callsWithoutCost, totalTokens, cacheRatio };
}

/** Aggregate cost for a group of rows — "n/a" only when every row in the group is missing cost (D-14). */
function groupCostLabel(rows: LlmCallRow[]): string {
  const defined = rows.filter((r) => typeof r.cost === "number");
  if (defined.length === 0) return "n/a";
  const sum = defined.reduce((acc, r) => acc + (r.cost as number), 0);
  return formatCost(sum);
}

/** Per-row "X% cached" label — only meaningful when cacheBadge(row) === "HIT". */
function rowCachePercent(row: LlmCallRow): number {
  const read = row.cacheReadInputTokens ?? 0;
  const denominator = read + row.promptTokens;
  return denominator > 0 ? Math.round((read / denominator) * 100) : 0;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function TraceWaterfall({ sessionId }: { sessionId: string }) {
  const rows = useQuery(api.llm.sessionCalls, { sessionId }) as
    | LlmCallRow[]
    | undefined;

  const groups = useMemo(() => groupByTrace(rows ?? []), [rows]);
  const timeRange = useMemo(() => computeTimeRange(rows ?? []), [rows]);
  const summary = useMemo(() => computeSummary(rows ?? []), [rows]);

  if (rows === undefined) {
    return null;
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm font-semibold">No LLM calls yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          This session hasn&apos;t made any LLM calls. Once Ástríðr&apos;s
          agent loop runs, calls will appear here automatically — no refresh
          needed.
        </p>
      </div>
    );
  }

  const toPercent = (ts: number) =>
    ((ts - timeRange.minTs) / timeRange.range) * 100;

  let turnNumber = 0;

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6">
        {/* Summary strip (D-15) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <MetricCard label="Total Cost" value={formatCost(summary.totalCost)} />
            {summary.callsWithoutCost > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {summary.callsWithoutCost} calls without cost
              </p>
            )}
          </div>
          <MetricCard label="Call Count" value={rows.length} />
          <MetricCard label="Total Tokens" value={summary.totalTokens.toLocaleString()} />
          <MetricCard
            label="Cache Read Ratio"
            value={`${Math.round(summary.cacheRatio * 100)}%`}
          />
        </div>

        {/* Trace groups */}
        <div className="flex flex-col gap-4">
          {groups.map((group) => {
            const isUntraced = group.traceId === undefined;
            const groupDurationMs = group.rows.reduce(
              (sum, r) => sum + r.latencyMs,
              0
            );

            if (isUntraced) {
              return (
                <div
                  key={UNTRACED_KEY}
                  className="rounded-lg border border-border p-4"
                  style={{ backgroundColor: "var(--muted)" }}
                >
                  <h3
                    className="text-sm font-mono tracking-widest uppercase font-semibold"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    Untraced calls · {group.rows.length}
                  </h3>
                  <div className="mt-2 flex flex-col gap-0.5">
                    {group.rows.map((row, i) => (
                      <TraceCallRow
                        key={row._id ?? i}
                        row={row}
                        toPercent={toPercent}
                      />
                    ))}
                  </div>
                </div>
              );
            }

            turnNumber += 1;
            const thisTurn = turnNumber;

            return (
              <Collapsible
                key={group.traceId}
                defaultOpen
                className="rounded-lg border border-border bg-card"
              >
                <CollapsibleTrigger className="group flex w-full items-center justify-between p-4 text-left">
                  <span className="text-sm font-mono tracking-widest uppercase font-semibold">
                    Turn {thisTurn} · {group.rows.length} ·{" "}
                    {formatDurationMs(groupDurationMs)} ·{" "}
                    {groupCostLabel(group.rows)}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
                </CollapsibleTrigger>
                <CollapsibleContent className="px-4 pb-4 flex flex-col gap-0.5">
                  {group.rows.map((row, i) => (
                    <TraceCallRow
                      key={row._id ?? i}
                      row={row}
                      toPercent={toPercent}
                    />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}

// ─── Call bar row ───────────────────────────────────────────────────────────

function TraceCallRow({
  row,
  toPercent,
}: {
  row: LlmCallRow;
  toPercent: (ts: number) => number;
}) {
  const { start, width } = barMetrics(row);
  const left = toPercent(start);
  const barWidth = Math.max(toPercent(start + width) - left, 0.5);
  const badge = cacheBadge(row);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="relative w-full" style={{ height: ROW_HEIGHT }}>
          <div
            className="absolute inset-y-1.5 rounded-sm flex items-center px-2 text-xs whitespace-nowrap overflow-hidden"
            style={{
              left: `${left}%`,
              width: `${barWidth}%`,
              minWidth: "60px",
              backgroundColor: "var(--chart-1)",
            }}
          >
            <span className="truncate">
              {row.model} · {costLabel(row)}
              {badge === "HIT" && (
                <span style={{ color: "var(--status-ok)" }}>
                  {" "}
                  · {rowCachePercent(row)}% cached
                </span>
              )}
              {badge === "MISS" && (
                <span style={{ color: "var(--status-warn)" }}> · uncached</span>
              )}
            </span>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="flex flex-col gap-0.5 text-xs">
          <span>Provider: {row.provider}</span>
          <span>Model: {row.model}</span>
          {row.toolName && <span>Tool: {row.toolName}</span>}
          {row.billingType && <span>Billing: {row.billingType}</span>}
          <span>
            Tokens: {row.promptTokens} in / {row.completionTokens} out
          </span>
          <span>
            Cache read: {row.cacheReadInputTokens ?? "n/a"} · Cache
            creation: {row.cacheCreationInputTokens ?? "n/a"}
          </span>
          <span>Latency: {formatDurationMs(row.latencyMs)}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export default TraceWaterfall;
