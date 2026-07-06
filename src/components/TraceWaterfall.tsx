import { useMemo } from "react";
import { useQuery } from "convex/react";
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

// ─── Component (fleshed out in Task 2) ─────────────────────────────────────

export function TraceWaterfall({ sessionId }: { sessionId: string }) {
  const rows = useQuery(api.llm.sessionCalls, { sessionId }) as
    | LlmCallRow[]
    | undefined;

  const groups = useMemo(() => groupByTrace(rows ?? []), [rows]);

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

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <Collapsible key={group.traceId ?? UNTRACED_KEY} defaultOpen>
            <CollapsibleTrigger>{group.traceId ?? "Untraced calls"}</CollapsibleTrigger>
            <CollapsibleContent>
              {group.rows.map((row, i) => (
                <div key={row._id ?? i}>
                  {row.model} · {costLabel(row)}
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="sr-only">detail</span>
        </TooltipTrigger>
        <TooltipContent>detail</TooltipContent>
      </Tooltip>
      <MetricCard label="stub" value="stub" />
      <div className="hidden">{formatDurationMs(0)}</div>
    </TooltipProvider>
  );
}

export default TraceWaterfall;
