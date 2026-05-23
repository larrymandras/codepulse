import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatCost } from "../lib/formatters";
import { Badge } from "./ui/badge";

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

/** SDK Spend Guard — upgraded from SDKSpendCapGauge. Plan 02 will add sparkline + projection. */
export default function SDKSpendGuard() {
  const data = useQuery(api.aggregates.costByPeriod, {
    period: "daily",
    billingType: "api",
    lookbackDays: 1,
  });

  if (data === undefined) {
    return (
      <div className="space-y-2">
        <h3 className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
          SDK Daily Cap
        </h3>
        <p className="text-sm text-muted-foreground text-center">Loading...</p>
      </div>
    );
  }

  const todaySpend = Object.values(data).reduce((s, v) => s + (v as number), 0);
  const percentage = Math.min((todaySpend / DAILY_CAP) * 100, 100);
  const status = classifyCapStatus(todaySpend, DAILY_CAP, ALERT_THRESHOLD);

  const barColor =
    status === "exceeded" ? "bg-[--status-error]"
    : status === "warning" ? "bg-[--status-warn]"
    : "bg-[--status-ok]";

  const badgeVariant = status === "exceeded" ? "destructive" : "outline";
  const statusLabel =
    status === "exceeded" ? "Cap Reached"
    : status === "warning" ? "Near Limit"
    : "On Track";

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
        SDK Daily Cap
      </h3>
      <p className="text-sm text-muted-foreground">
        {formatCost(todaySpend)} of {formatCost(DAILY_CAP)} today
      </p>
      <div className="relative min-h-[48px] flex items-center gap-3">
        {/* Gauge bar */}
        <div className="flex-1 relative">
          <div className="h-2 bg-muted rounded-none overflow-hidden">
            <div
              className={`h-full transition-all ${barColor}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          {/* 80% threshold marker per UI-SPEC */}
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
    </div>
  );
}
