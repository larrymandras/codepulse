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
  round?: number; // Phase 105 D-10 — per-round trace-waterfall join key
}

export type CacheBadgeState = "HIT" | "MISS" | "NO_DATA";

export interface TraceGroup {
  traceId: string | undefined;
  rows: LlmCallRow[];
  earliestTimestamp: number;
}

/** Row shape returned by the tool-executions list-by-session query (convex/schema.ts toolExecutions table). */
export interface ToolExecRow {
  _id?: string;
  sessionId?: string;
  toolName: string;
  durationMs?: number;
  success: boolean;
  errorMessage?: string;
  timestamp: number; // UNIX SECONDS (not ms)
  provider?: string;
  traceId?: string;
  round?: number;
}

/** One round of a trace: the LLM call(s) that ran in it, then the tools they triggered. */
export interface TraceRound {
  round: number;
  llmRows: LlmCallRow[];
  toolRows: ToolExecRow[];
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

/**
 * Per-turn cache ratio (D-11) — the IDENTICAL read/(read+creation+prompt)
 * denominator as this file's own `computeSummary` (session-wide) and
 * `shapeCacheAcc` in convex/llm.ts:59-69 (server-side). This is deliberately
 * the ONLY place that formula is re-typed a third time: if the
 * "DENOMINATOR PARITY" test in TraceWaterfall.test.tsx ever fails, one of
 * these three implementations has drifted and must be reconciled back to
 * this one, not the other way around.
 */
export function groupCacheRatio(rows: LlmCallRow[]): number {
  let cacheReadSum = 0;
  let cacheCreationSum = 0;
  let promptTokenSum = 0;

  for (const row of rows) {
    if (typeof row.cacheReadInputTokens === "number") {
      cacheReadSum += row.cacheReadInputTokens;
    }
    if (typeof row.cacheCreationInputTokens === "number") {
      cacheCreationSum += row.cacheCreationInputTokens;
    }
    promptTokenSum += row.promptTokens;
  }

  const denominator = cacheReadSum + cacheCreationSum + promptTokenSum;
  return denominator > 0 ? cacheReadSum / denominator : 0;
}

/**
 * Partitions a trace group's LLM rows and the session's tool rows into
 * per-round buckets (D-09/D-10, finding F1). The second nesting level is the
 * ROUND, not an individual LLM call: the reported join key is
 * (traceId, round), and a single round can hold more than one `llm_call` row
 * (a retry, an advisor pass) — attaching tool rows to ONE specific LLM row
 * inside a multi-call round would be an inference D-10 explicitly forbids
 * ("a wrong parent renders exactly as confidently as a right one with
 * nothing on screen to signal doubt"). Do not "fix" this back into a
 * per-call attachment.
 *
 * A tool row joins a round ONLY when its traceId equals this group's traceId
 * AND its round is a real number matching that round — guarded with
 * `typeof === "number"` throughout so round 0 is never mistaken for absent.
 * A tool row whose traceId matches this group but whose round does not is
 * scoped into `unattributedToolRows` for THIS group only; a tool row whose
 * traceId does not match this group at all is ignored here entirely (it is
 * some other group's concern, or the component-level "Untraced tool calls"
 * bucket's, never guessed onto this one).
 */
export function groupRoundsForTrace(
  group: TraceGroup,
  toolRows: ToolExecRow[]
): {
  rounds: TraceRound[];
  unroundedLlmRows: LlmCallRow[];
  unattributedToolRows: ToolExecRow[];
} {
  const roundsMap = new Map<
    number,
    { llmRows: LlmCallRow[]; toolRows: ToolExecRow[] }
  >();
  const unroundedLlmRows: LlmCallRow[] = [];
  const unattributedToolRows: ToolExecRow[] = [];

  for (const row of group.rows) {
    if (typeof row.round === "number") {
      if (!roundsMap.has(row.round)) {
        roundsMap.set(row.round, { llmRows: [], toolRows: [] });
      }
      roundsMap.get(row.round)!.llmRows.push(row);
    } else {
      unroundedLlmRows.push(row);
    }
  }

  for (const row of toolRows) {
    if (row.traceId !== group.traceId) continue; // not this group's concern

    if (typeof row.round === "number") {
      if (!roundsMap.has(row.round)) {
        roundsMap.set(row.round, { llmRows: [], toolRows: [] });
      }
      roundsMap.get(row.round)!.toolRows.push(row);
    } else {
      unattributedToolRows.push(row);
    }
  }

  const rounds: TraceRound[] = Array.from(roundsMap.entries())
    .map(([round, data]) => ({
      round,
      llmRows: [...data.llmRows].sort((a, b) => a.timestamp - b.timestamp),
      toolRows: [...data.toolRows].sort((a, b) => a.timestamp - b.timestamp),
    }))
    .sort((a, b) => a.round - b.round);

  unroundedLlmRows.sort((a, b) => a.timestamp - b.timestamp);

  return { rounds, unroundedLlmRows, unattributedToolRows };
}

/**
 * Bar math for a single tool-execution row — mirrors `barMetrics`'s seconds
 * domain exactly (width = durationMs / 1000, start = timestamp - width). When
 * durationMs is not reported, returns a zero-width bar with hasDuration:false
 * so the renderer can show the row without drawing a fake instantaneous span.
 */
export function toolBarMetrics(row: {
  timestamp: number;
  durationMs?: number;
}): { start: number; width: number; hasDuration: boolean } {
  if (typeof row.durationMs !== "number") {
    return { start: row.timestamp, width: 0, hasDuration: false };
  }
  const width = row.durationMs / 1000;
  const start = row.timestamp - width;
  return { start, width, hasDuration: true };
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
export function computeSummary(rows: LlmCallRow[]) {
  let totalCost = 0;
  let callsWithoutCost = 0;
  let totalTokens = 0;
  let cacheReadSum = 0;
  let cacheCreationSum = 0;
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
    if (typeof row.cacheCreationInputTokens === "number") {
      cacheCreationSum += row.cacheCreationInputTokens;
    }
    promptTokenSum += row.promptTokens;
  }

  // hitRate = cache_read / total prompt tokens, where total = uncached input
  // + cache writes + cache reads — same formula as shapeCacheAcc in convex/llm.ts.
  const cacheDenominator = cacheReadSum + cacheCreationSum + promptTokenSum;
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
  const result = useQuery(api.llm.sessionCalls, { sessionId }) as
    | { rows: LlmCallRow[]; truncated: boolean; cap: number }
    | undefined;
  const rows = result?.rows;
  const truncated = result?.truncated ?? false;
  const cap = result?.cap;

  // Second, supplementary feeder (D-09). An undefined tool result must NEVER
  // block rendering the LLM lane — tool rows are additive detail, not a
  // gate — so this is read with a safe default rather than an early return.
  const toolResult = useQuery(api.toolExecutions.listBySession, {
    sessionId,
  }) as { rows: ToolExecRow[]; truncated: boolean; cap: number } | undefined;
  const toolRows = toolResult?.rows ?? [];
  const toolTruncated = toolResult?.truncated ?? false;
  const toolCap = toolResult?.cap;

  const groups = useMemo(() => groupByTrace(rows ?? []), [rows]);
  const timeRange = useMemo(() => computeTimeRange(rows ?? []), [rows]);
  const summary = useMemo(() => computeSummary(rows ?? []), [rows]);
  const tracedGroupIds = useMemo(
    () =>
      new Set(
        groups
          .filter((g): g is TraceGroup & { traceId: string } => g.traceId !== undefined)
          .map((g) => g.traceId)
      ),
    [groups]
  );
  // Tool rows whose traceId matches no rendered LLM trace group at all —
  // never dropped, rendered once at the bottom of the whole component.
  const untracedToolRows = useMemo(
    () =>
      toolRows.filter(
        (r) => r.traceId === undefined || !tracedGroupIds.has(r.traceId)
      ),
    [toolRows, tracedGroupIds]
  );

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
        {/* Combined truncation notice (D-12) — one banner naming whichever
            feeder(s) hit their read cap; never a fabricated total. */}
        {(truncated || toolTruncated) && (
          <div
            className="text-sm rounded-md px-3 py-2 flex flex-col gap-1"
            style={{
              color: "var(--status-warn)",
              border: "1px solid color-mix(in srgb, var(--status-warn) 40%, transparent)",
              backgroundColor: "color-mix(in srgb, var(--status-warn) 12%, transparent)",
            }}
          >
            {truncated && (
              <p>
                Showing the most recent {cap} calls — older calls in this
                session aren&apos;t loaded.
              </p>
            )}
            {toolTruncated && (
              <p>
                Showing the most recent {toolCap} tool executions — older
                tool calls in this session aren&apos;t loaded.
              </p>
            )}
          </div>
        )}

        {/* Summary strip (D-15) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <MetricCard label="Total Cost" value={formatCost(summary.totalCost)} />
            {summary.callsWithoutCost > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {summary.callsWithoutCost} call{summary.callsWithoutCost === 1 ? "" : "s"} without cost
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
            const { rounds, unroundedLlmRows, unattributedToolRows } =
              groupRoundsForTrace(group, toolRows);

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
                    {groupCostLabel(group.rows)} ·{" "}
                    {Math.round(groupCacheRatio(group.rows) * 100)}% cached
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
                </CollapsibleTrigger>
                <CollapsibleContent className="px-4 pb-4 flex flex-col gap-3">
                  {rounds.map((round) => (
                    <TraceRoundSection
                      key={round.round}
                      round={round}
                      toPercent={toPercent}
                    />
                  ))}
                  {unroundedLlmRows.length > 0 && (
                    <div className="flex flex-col gap-0.5">
                      {unroundedLlmRows.map((row, i) => (
                        <TraceCallRow
                          key={row._id ?? `unrounded-${i}`}
                          row={row}
                          toPercent={toPercent}
                        />
                      ))}
                    </div>
                  )}
                  {unattributedToolRows.length > 0 && (
                    <div>
                      <h4
                        className="text-xs font-mono tracking-widest uppercase font-semibold"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        Tool calls with no reported round ·{" "}
                        {unattributedToolRows.length}
                      </h4>
                      <p className="text-xs text-muted-foreground mb-1">
                        Ástríðr didn&apos;t report which round these ran in.
                      </p>
                      <div className="flex flex-col gap-0.5">
                        {unattributedToolRows.map((row, i) => (
                          <TraceToolRow
                            key={row._id ?? `unattributed-${i}`}
                            row={row}
                            toPercent={toPercent}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>

        {/* Tool rows whose traceId matches no rendered LLM group — never dropped. */}
        {untracedToolRows.length > 0 && (
          <div
            className="rounded-lg border border-border p-4"
            style={{ backgroundColor: "var(--muted)" }}
          >
            <h3
              className="text-sm font-mono tracking-widest uppercase font-semibold"
              style={{ color: "var(--muted-foreground)" }}
            >
              Untraced tool calls · {untracedToolRows.length}
            </h3>
            <div className="mt-2 flex flex-col gap-0.5">
              {untracedToolRows.map((row, i) => (
                <TraceToolRow
                  key={row._id ?? `untraced-tool-${i}`}
                  row={row}
                  toPercent={toPercent}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

// ─── Round section (second Collapsible level, D-09) ────────────────────────

function TraceRoundSection({
  round,
  toPercent,
}: {
  round: TraceRound;
  toPercent: (ts: number) => number;
}) {
  const llmCount = round.llmRows.length;
  const label =
    llmCount === 0
      ? `Round ${round.round} · ${round.toolRows.length} tool call${
          round.toolRows.length === 1 ? "" : "s"
        }`
      : llmCount === 1
        ? `Round ${round.round} · ${round.llmRows[0].model} · ${costLabel(round.llmRows[0])}`
        : `Round ${round.round} · ${llmCount} calls · ${groupCostLabel(round.llmRows)}`;

  return (
    <Collapsible defaultOpen className="pl-4">
      <CollapsibleTrigger className="group flex w-full items-center justify-between py-1.5 text-left">
        <span
          className="text-xs font-mono tracking-widest uppercase font-semibold"
          style={{ color: "var(--muted-foreground)" }}
        >
          {label}
        </span>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-0.5 pt-1">
        {round.llmRows.map((row, i) => (
          <TraceCallRow
            key={row._id ?? `round-${round.round}-llm-${i}`}
            row={row}
            toPercent={toPercent}
          />
        ))}
        {round.toolRows.map((row, i) => (
          <TraceToolRow
            key={row._id ?? `round-${round.round}-tool-${i}`}
            row={row}
            toPercent={toPercent}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
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

// ─── Tool bar row (D-09) ─────────────────────────────────────────────────────

function TraceToolRow({
  row,
  toPercent,
}: {
  row: ToolExecRow;
  toPercent: (ts: number) => number;
}) {
  const { start, width, hasDuration } = toolBarMetrics(row);
  const left = toPercent(start);
  const barWidth = hasDuration
    ? Math.max(toPercent(start + width) - left, 0.5)
    : 0.5;
  const barColor = row.success ? "var(--chart-2)" : "var(--status-error)";
  const durationText = hasDuration
    ? formatDurationMs(row.durationMs as number)
    : "duration n/a";

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
              backgroundColor: barColor,
            }}
          >
            <span className="truncate">
              {row.toolName} · {durationText} ·{" "}
              {row.success ? "ok" : "failed"}
            </span>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="flex flex-col gap-0.5 text-xs">
          <span>Tool: {row.toolName}</span>
          {row.provider && <span>Provider: {row.provider}</span>}
          <span>Status: {row.success ? "ok" : "failed"}</span>
          <span>
            Duration: {hasDuration ? formatDurationMs(row.durationMs as number) : "n/a"}
          </span>
          {typeof row.round === "number" && <span>Round: {row.round}</span>}
          {row.errorMessage && <span>Error: {row.errorMessage}</span>}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export default TraceWaterfall;
