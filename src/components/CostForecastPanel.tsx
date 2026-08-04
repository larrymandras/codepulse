import { useQuery } from "convex/react";
import { Link } from "react-router";
import { api } from "../../convex/_generated/api";
import { formatCost } from "../lib/formatters";

export default function CostForecastPanel() {
  const data = useQuery(api.forecasts.costForecast);

  if (data === undefined) {
    return (
      <div className="space-y-4">
        <h2 className="text-sm font-normal uppercase tracking-wide text-muted-foreground">
          Cost Forecast
        </h2>
        <p className="text-base text-muted-foreground text-center">Loading...</p>
      </div>
    );
  }

  if (data.insufficientData) {
    return (
      <div className="space-y-4">
        <h2 className="text-sm font-normal uppercase tracking-wide text-muted-foreground">
          Cost Forecast
        </h2>
        <p className="text-base text-muted-foreground text-center">
          Insufficient data for forecast. Cost forecasting requires at least 3 days of activity.
        </p>
      </div>
    );
  }

  const { projectedDaily, projectedWeekly, projectedMonthly, budgetCap, budgetStatus, currentMonthSpend, dailyHistory } = data;

  const budgetStatusLabel =
    budgetStatus === "exceeded"
      ? "Over budget"
      : budgetStatus === "warning"
        ? "Near limit"
        : "On track";

  const budgetBarColor =
    budgetStatus === "exceeded"
      ? "bg-[--status-error]"
      : budgetStatus === "warning"
        ? "bg-[--status-warn]"
        : "bg-[--status-ok]";

  // D-19: budgetCap is null when no global/monthly costBudgets row exists —
  // this is only rendered when budgetCap is a real, positive number, never
  // fabricated as a 0% or 100% bar against a cap nobody set.
  const budgetPercentage =
    budgetCap != null && budgetCap > 0
      ? Math.min((projectedMonthly / budgetCap) * 100, 100)
      : 0;

  const maxHistoryValue = Math.max(...dailyHistory.map((d: { date: string; value: number }) => d.value), 1);

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-normal uppercase tracking-wide text-muted-foreground">
        Cost Forecast
      </h2>

      {/* Three stat boxes */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground uppercase tracking-wide">Projected Daily</p>
          <p className="text-2xl font-semibold tabular-nums">{formatCost(projectedDaily)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground uppercase tracking-wide">Projected Weekly</p>
          <p className="text-2xl font-semibold tabular-nums">{formatCost(projectedWeekly)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground uppercase tracking-wide">Projected Monthly</p>
          <p className="text-2xl font-semibold tabular-nums">{formatCost(projectedMonthly)}</p>
        </div>
      </div>

      {/* Budget progress bar */}
      <div className="space-y-2">
        {budgetCap != null && budgetCap > 0 ? (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{budgetStatusLabel}</span>
              <span className="text-muted-foreground tabular-nums">
                {formatCost(currentMonthSpend)} / {formatCost(budgetCap)}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-none overflow-hidden">
              <div
                className={`h-full transition-all ${budgetBarColor}`}
                style={{ width: `${budgetPercentage}%` }}
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No monthly budget set.{" "}
            <Link to="/settings" className="underline hover:text-foreground">
              Set one in Settings → Cost &amp; Budgets.
            </Link>
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          Subscription providers (claude-cli, codex, antigravity) excluded from forecast
        </p>
      </div>

      {/* Trend sparkline: last 7 days */}
      {dailyHistory.length > 0 && (
        <div className="flex items-end gap-1 h-12">
          {dailyHistory.map((d: { date: string; value: number }, i: number) => (
            <div
              key={i}
              className="flex-1 bg-primary/30"
              style={{ height: `${(d.value / maxHistoryValue) * 100}%` }}
              title={`${d.date}: ${formatCost(d.value)}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
