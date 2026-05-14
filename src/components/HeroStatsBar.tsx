import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useHeroStats } from "../hooks/useHeroStats";
import { AnimatedNumber, thresholdColor, ThresholdConfig } from "./MetricCard";
import Sparkline from "./Sparkline";
import InfoTooltip from "./InfoTooltip";

const healthConfig = {
  green: { dotStyle: { background: "var(--status-ok)" }, ringClass: "ring-2 ring-[color:var(--status-ok)]/30", label: "Healthy" },
  yellow: { dotStyle: { background: "var(--status-warn)" }, ringClass: "ring-2 ring-[color:var(--status-warn)]/30", label: "Warning" },
  red: { dotStyle: { background: "var(--status-error)" }, ringClass: "ring-2 ring-[color:var(--status-error)]/30", label: "Critical" },
};

interface KpiDef {
  label: string;
  value: string | number;
  numericValue?: number;
  threshold?: ThresholdConfig;
  format?: (v: number) => string;
  sparkline?: number[];
  sub?: string;
  color?: string;
  accent?: "cost" | "health" | "activity" | "memory" | "alerts";
  onClick: () => void;
}

export default function HeroStatsBar() {
  const stats = useHeroStats();
  const navigate = useNavigate();
  const hc = healthConfig[stats.health] ?? healthConfig.yellow;

  // v6.0 new metrics
  const preflightStats = useQuery(api.memoryPreflight.stats);
  const durableFacts = useQuery(api.dreaming.recentFacts, { limit: 100 });
  const advisorSavings = useQuery(api.advisorEvents.savingsSummary);

  const hitRateValue =
    preflightStats?.hitRate != null ? Math.round(preflightStats.hitRate * 100) : undefined;

  const durableFactsCount =
    durableFacts != null ? durableFacts.length : undefined;

  const advisorSavingsValue =
    advisorSavings?.totalSavings != null ? advisorSavings.totalSavings : undefined;

  const kpis: KpiDef[] = [
    {
      label: "Sessions",
      value: stats.activeSessions,
      numericValue: typeof stats.activeSessions === "number" ? stats.activeSessions : undefined,
      sub: `${stats.runningAgents} agents`,
      color: "var(--accent-activity)",
      accent: "activity",
      onClick: () => navigate("/agents"),
    },
    {
      label: "Error Rate",
      value: `${stats.errorRate}%`,
      numericValue: stats.errorRate,
      threshold: { ok: 10, warn: 20 },
      format: (v: number) => `${Math.round(v)}%`,
      sub: `${stats.errorsThisHour} errors`,
      accent: "alerts",
      onClick: () => navigate("/alerts"),
    },
    {
      label: "Alerts",
      value: stats.activeAlerts,
      numericValue: typeof stats.activeAlerts === "number" ? stats.activeAlerts : undefined,
      sub:
        stats.criticalAlerts > 0
          ? `${stats.criticalAlerts} critical`
          : stats.errorAlerts > 0
            ? `${stats.errorAlerts} errors`
            : "all clear",
      color:
        stats.criticalAlerts > 0 ? "var(--accent-alerts)" : stats.errorAlerts > 0 ? "var(--status-warn)" : "var(--accent-health)",
      accent: "alerts",
      onClick: () => navigate("/alerts"),
    },
    {
      label: "Security",
      value: stats.securityEvents,
      numericValue: typeof stats.securityEvents === "number" ? stats.securityEvents : undefined,
      sub: "this hour",
      color: stats.securityEvents > 0 ? "var(--status-warn)" : "var(--accent-health)",
      accent: "alerts",
      onClick: () => navigate("/security"),
    },
    {
      label: "Memory Hit Rate",
      value: hitRateValue != null ? `${hitRateValue}%` : "\u2014",
      numericValue: hitRateValue,
      threshold: { ok: 70, warn: 40, invertDirection: true },
      format: (v: number) => `${Math.round(v)}%`,
      accent: "memory",
      onClick: () => navigate("/memory"),
    },
    {
      label: "Durable Facts",
      value: durableFactsCount != null ? durableFactsCount.toString() : "\u2014",
      numericValue: durableFactsCount,
      threshold: { ok: 10, warn: 3, invertDirection: true },
      format: (v: number) => Math.round(v).toString(),
      sub: "recent",
      accent: "memory",
      onClick: () => navigate("/dreaming"),
    },
    {
      label: "Advisor Savings",
      value: advisorSavingsValue != null ? `$${advisorSavingsValue.toFixed(2)}` : "\u2014",
      numericValue: advisorSavingsValue,
      threshold: { ok: 1.0, warn: 0.1, invertDirection: true },
      format: (v: number) => `$${v.toFixed(2)}`,
      accent: "cost",
      onClick: () => navigate("/analytics"),
    },
  ];

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-4 mb-4">
        {/* Health indicator */}
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${hc.ringClass}`} style={hc.dotStyle} />
          <span className="text-sm font-semibold text-foreground">{hc.label}</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <span className="text-xs text-muted-foreground">System Status — Last Hour</span>
        <InfoTooltip text="Key performance indicators: sessions, errors, alerts, security, memory hit rate, durable facts, advisor savings, and startup time" />
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {kpis.map((kpi) => {
          const color =
            kpi.threshold != null && kpi.numericValue != null
              ? thresholdColor(kpi.numericValue, kpi.threshold)
              : kpi.color;

          return (
            <div
              key={kpi.label}
              onClick={kpi.onClick}
              data-accent={kpi.accent}
              className="group flex flex-col gap-1 cursor-pointer rounded-lg px-2 py-1.5 -mx-2 -my-1.5 lift-on-hover"
            >
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {kpi.label}
              </span>
              <div className="flex items-end gap-2">
                <span
                  className="text-xl font-bold tabular-nums"
                  style={color ? { color } : undefined}
                >
                  {kpi.numericValue != null ? (
                    <AnimatedNumber value={kpi.numericValue} format={kpi.format} />
                  ) : (
                    kpi.value
                  )}
                </span>
                {kpi.sparkline && kpi.sparkline.length > 0 && (
                  <Sparkline data={kpi.sparkline} color={color ?? "var(--accent-activity)"} />
                )}
              </div>
              {kpi.sub && (
                <span className="text-[10px] text-muted-foreground">{kpi.sub}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
