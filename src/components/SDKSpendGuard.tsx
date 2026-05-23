import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatCost } from "../lib/formatters";
import { Badge } from "./ui/badge";
import Sparkline from "./Sparkline";
import { Clock } from "lucide-react";

export const DAILY_CAP = 5.00;
export const ALERT_THRESHOLD = 0.8;  // D-04: 80% = $4 auto-alert

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

/** Pure function for projecting end-of-day spend -- exported for testing. */
export function projectDayEndSpend(todaySpend: number, elapsedHours: number): {
  projectedTotal: number;
  willExceedCap: boolean;
  projectedHitTime: Date | null;
} {
  if (elapsedHours <= 0) return { projectedTotal: 0, willExceedCap: false, projectedHitTime: null };
  const hourlyRate = todaySpend / elapsedHours;
  const projectedTotal = hourlyRate * 24;
  const willExceedCap = projectedTotal > DAILY_CAP;
  const dayStartEpoch = Math.floor(Date.now() / 1000 / 86400) * 86400;
  const projectedHitTime = willExceedCap && hourlyRate > 0
    ? new Date((dayStartEpoch + (DAILY_CAP / hourlyRate) * 3600) * 1000)
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

  if (rawBuckets === undefined) {
    return (
      <div className="space-y-2">
        <h3 className="text-xs font-mono tracking-widest text-primary uppercase">SDK DAILY CAP</h3>
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

  // Project end-of-day
  const { projectedTotal, willExceedCap, projectedHitTime } = projectDayEndSpend(todaySpend, elapsedHours);

  const percentage = Math.min((todaySpend / DAILY_CAP) * 100, 100);
  const status = classifyCapStatus(todaySpend, DAILY_CAP, ALERT_THRESHOLD);

  const barColor =
    status === "exceeded" ? "bg-[--status-error]"
    : status === "warning" ? "bg-[--status-warn]"
    : "bg-[--status-ok]";

  const sparklineColor =
    status === "exceeded" ? "#ef4444"
    : status === "warning" ? "#eab308"
    : "#10b981";

  const badgeVariant = status === "exceeded" ? "destructive" : "outline";
  const statusLabel =
    status === "exceeded" ? "Cap Reached"
    : status === "warning" ? "Near Limit"
    : "On Track";

  return (
    <div className="space-y-2">
      {/* Heading */}
      <h3 className="text-xs font-mono tracking-widest text-primary uppercase">SDK DAILY CAP</h3>

      {/* Metric row */}
      <div className="flex items-baseline gap-2">
        <p className="text-xl font-semibold tabular-nums">{formatCost(todaySpend)}</p>
        <span className="text-sm text-muted-foreground">of {formatCost(DAILY_CAP)} today</span>
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
          {/* 80% threshold marker */}
          <div
            className="absolute top-0 w-px h-full bg-[--status-warn] opacity-70"
            style={{ left: "80%" }}
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
          <p className="text-sm text-[--status-warn]">
            <Clock className="inline h-3 w-3 mr-1" />
            At current rate, you'll hit {formatCost(DAILY_CAP)} by ~{projectedHitTime?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Projected: {formatCost(projectedTotal)} today</p>
        )
      )}
    </div>
  );
}
