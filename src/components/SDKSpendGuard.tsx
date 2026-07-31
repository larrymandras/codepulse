import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { formatCost } from "../lib/formatters";
import { Badge } from "./ui/badge";
import Sparkline from "./Sparkline";
import { Clock } from "lucide-react";
import { useCostBudget } from "../hooks/useCostBudgets";
import { useThemeColors } from "../hooks/useThemeColors";

/** Pure function for status classification -- exported for testing. */
export function classifyCapStatus(
  todaySpend: number,
  cap: number,
  alertThreshold: number
): "ok" | "warning" | "exceeded" {
  if (todaySpend >= cap) return "exceeded";
  if (todaySpend >= cap * alertThreshold) return "warning";
  return "ok";
}

/**
 * Pure function for projecting end-of-day spend -- exported for testing.
 * D-12: the cap is a caller-supplied parameter (the global daily costBudgets
 * row's `limit`), never a module constant — see convex/costBudgetEval.ts's
 * `projectPeriodEndSpend`, which generalizes this same algorithm across
 * daily/weekly/monthly periods and mirrors this function's math exactly.
 */
export function projectDayEndSpend(todaySpend: number, elapsedHours: number, cap: number): {
  projectedTotal: number;
  willExceedCap: boolean;
  projectedHitTime: Date | null;
} {
  if (elapsedHours <= 0) return { projectedTotal: 0, willExceedCap: false, projectedHitTime: null };
  const hourlyRate = todaySpend / elapsedHours;
  const projectedTotal = hourlyRate * 24;
  const willExceedCap = projectedTotal > cap;
  const dayStartEpoch = Math.floor(Date.now() / 1000 / 86400) * 86400;
  const projectedHitTime = willExceedCap && hourlyRate > 0
    ? new Date((dayStartEpoch + (cap / hourlyRate) * 3600) * 1000)
    : null;
  return { projectedTotal, willExceedCap, projectedHitTime };
}

/** SDK Spend Guard — upgraded from SDKSpendCapGauge with sparkline + projection. */
export default function SDKSpendGuard() {
  const rawBuckets = useQuery(api.aggregates.costByPeriodByProvider, {
    period: "hourly",
    lookbackHours: 24,
    billingType: "api",
  });
  // D-12: the daily cap and warn fraction come from the global/daily
  // costBudgets row, not a hardcoded constant. `undefined` (loading) and
  // `null` (no budget configured) are rendered as distinct, honest states.
  const budget = useCostBudget("global", "", "daily");
  const theme = useThemeColors();

  if (rawBuckets === undefined || budget === undefined) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-mono tracking-widest text-primary uppercase">SDK DAILY CAP</h3>
        <div className="h-2 bg-muted animate-pulse rounded-none" />
        <div className="h-10 bg-muted animate-pulse rounded-none" />
        <div className="h-4 bg-muted animate-pulse rounded-none w-1/2" />
      </div>
    );
  }

  const buckets = rawBuckets;
  const now = Date.now() / 1000;
  const dayStartEpoch = Math.floor(now / 86400) * 86400;

  // Filter to today's buckets only
  const todayBuckets = buckets.filter(
    (b: { bucket_start: number; byProvider: Record<string, number> }) => b.bucket_start >= dayStartEpoch
  );

  // Sum all provider values per bucket for sparkline
  const sparklineData = todayBuckets.map(
    (b: { bucket_start: number; byProvider: Record<string, number> }) =>
      Object.values(b.byProvider).reduce((s, v) => s + (v as number), 0)
  );

  // Compute today's total spend
  const todaySpend = sparklineData.reduce((s: number, v: number) => s + v, 0);

  // Elapsed hours since day start
  const elapsedHours = (now - dayStartEpoch) / 3600;

  // No daily budget configured: show today's spend and the sparkline honestly,
  // with no gauge, no percentage and no projection against a cap nobody set.
  if (budget === null) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-mono tracking-widest text-primary uppercase">SDK DAILY CAP</h3>
        <div className="flex items-baseline gap-2">
          <p className="text-xl font-semibold tabular-nums">{formatCost(todaySpend)}</p>
          <span className="text-base text-muted-foreground">today</span>
        </div>
        <div className="w-full">
          <Sparkline data={sparklineData} width={300} height={40} color={theme.statusOk} />
        </div>
        <p className="text-base text-muted-foreground">
          No daily budget set.{" "}
          <Link to="/settings" className="underline hover:text-foreground">
            Set one in Settings → Cost &amp; Budgets.
          </Link>
        </p>
      </div>
    );
  }

  const cap = budget.limit;
  const alertThreshold = budget.warnFraction;

  // Project end-of-day
  const { projectedTotal, willExceedCap, projectedHitTime } = projectDayEndSpend(todaySpend, elapsedHours, cap);

  const percentage = Math.min((todaySpend / cap) * 100, 100);
  const status = classifyCapStatus(todaySpend, cap, alertThreshold);

  const barColor =
    status === "exceeded" ? "bg-[--status-error]"
    : status === "warning" ? "bg-[--status-warn]"
    : "bg-[--status-ok]";

  const sparklineColor =
    status === "exceeded" ? theme.statusError
    : status === "warning" ? theme.statusWarn
    : theme.statusOk;

  const badgeVariant = status === "exceeded" ? "destructive" : "outline";
  const statusLabel =
    status === "exceeded" ? "Cap Reached"
    : status === "warning" ? "Near Limit"
    : "On Track";

  return (
    <div className="space-y-2">
      {/* Heading */}
      <h3 className="text-sm font-mono tracking-widest text-primary uppercase">SDK DAILY CAP</h3>

      {/* Metric row */}
      <div className="flex items-baseline gap-2">
        <p className="text-xl font-semibold tabular-nums">{formatCost(todaySpend)}</p>
        <span className="text-base text-muted-foreground">of {formatCost(cap)} today</span>
      </div>

      {/* Gauge bar */}
      <div className="relative min-h-[48px] flex items-center gap-3">
        <div className="flex-1 relative">
          <div className="h-2 bg-muted rounded-none overflow-hidden">
            <div
              className={`h-full transition-all ${barColor}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          {/* warn threshold marker */}
          <div
            className="absolute top-0 w-px h-full bg-[--status-warn] opacity-70"
            style={{ left: `${alertThreshold * 100}%` }}
          />
        </div>
        {/* Status badge */}
        <Badge
          variant={badgeVariant}
          className={status === "warning" ? "text-[--status-warn]" : undefined}
        >
          {statusLabel}
        </Badge>
      </div>

      {/* Sparkline */}
      <div className="w-full">
        <Sparkline data={sparklineData} width={300} height={40} color={sparklineColor} />
      </div>

      {/* Projection row — only when we have enough data */}
      {elapsedHours >= 2 && (
        willExceedCap ? (
          <p className="text-base text-[--status-warn]">
            <Clock className="inline h-3 w-3 mr-1" />
            At current rate, you'll hit {formatCost(cap)} by ~{projectedHitTime?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        ) : (
          <p className="text-base text-muted-foreground">Projected: {formatCost(projectedTotal)} today</p>
        )
      )}
    </div>
  );
}
