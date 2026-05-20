import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useHeroStats } from "../hooks/useHeroStats";
import { AnimatedNumber, thresholdColor, ThresholdConfig } from "./MetricCard";
import MetricCard from "./MetricCard";
import Sparkline from "./Sparkline";
import InfoTooltip from "./InfoTooltip";

const healthConfig = {
  green: { bg: "bg-emerald-500", label: "Healthy", ring: "ring-emerald-500/30" },
  yellow: { bg: "bg-yellow-500", label: "Warning", ring: "ring-yellow-500/30" },
  red: { bg: "bg-red-500", label: "Critical", ring: "ring-red-500/30" },
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
      color: "#60a5fa",
      onClick: () => navigate("/agents"),
    },
    {
      label: "Error Rate",
      value: `${stats.errorRate}%`,
      numericValue: stats.errorRate,
      threshold: { ok: 10, warn: 20 },
      format: (v: number) => `${Math.round(v)}%`,
      sub: `${stats.errorsThisHour} errors`,
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
        stats.criticalAlerts > 0 ? "#f87171" : stats.errorAlerts > 0 ? "#fb923c" : "#34d399",
      onClick: () => navigate("/alerts"),
    },
    {
      label: "Security",
      value: stats.securityEvents,
      numericValue: typeof stats.securityEvents === "number" ? stats.securityEvents : undefined,
      sub: "this hour",
      color: stats.securityEvents > 0 ? "#fb923c" : "#34d399",
      onClick: () => navigate("/security"),
    },
    {
      label: "Memory Hit Rate",
      value: hitRateValue != null ? `${hitRateValue}%` : "\u2014",
      numericValue: hitRateValue,
      threshold: { ok: 70, warn: 40, invertDirection: true },
      format: (v: number) => `${Math.round(v)}%`,
      onClick: () => navigate("/memory"),
    },
    {
      label: "Durable Facts",
      value: durableFactsCount != null ? durableFactsCount.toString() : "\u2014",
      numericValue: durableFactsCount,
      threshold: { ok: 10, warn: 3, invertDirection: true },
      format: (v: number) => Math.round(v).toString(),
      onClick: () => navigate("/dreaming"),
    },
    {
      label: "Advisor Savings",
      value: advisorSavingsValue != null ? `$${advisorSavingsValue.toFixed(2)}` : "\u2014",
      numericValue: advisorSavingsValue,
      threshold: { ok: 1.0, warn: 0.1, invertDirection: true },
      format: (v: number) => `$${v.toFixed(2)}`,
      onClick: () => navigate("/analytics"),
    },
    {
      label: "Startup Time",
      value: "\u2014",
      numericValue: undefined,
      threshold: { ok: 3000, warn: 8000 },
      format: (v: number) => `${(v / 1000).toFixed(1)}s`,
      onClick: () => navigate("/infrastructure"),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Top Section: Progress Bar and Global Controls */}
      <div className="glow-card bg-card/60 backdrop-blur-md border border-border/50 rounded-xl p-6 relative group overflow-hidden hover:border-primary/50 transition-colors shadow-[0_0_15px_rgba(16,185,129,0.05)] hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]">
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">Status</span>
          <span className={`w-2 h-2 rounded-full shadow-[0_0_8px_currentColor] ${hc.bg} text-${hc.bg.replace('bg-', '')}`} />
        </div>
        
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline gap-4">
            <span className="text-xs text-primary uppercase tracking-widest font-mono flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              System Load
            </span>
            <span className="text-[10px] text-muted-foreground font-mono tracking-widest">LIVE / 5H WINDOW</span>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="text-5xl font-medium tracking-tight text-white tabular-nums">
              <AnimatedNumber value={stats.activeSessions > 0 ? 100 - (stats.errorRate * 2) : 100} format={(v) => `${Math.round(v)}%`} />
            </div>
            
            <div className="flex-1 h-8 bg-[#09090b] rounded overflow-hidden border border-[#27272a] relative">
              <div 
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-orange-900/50 via-primary to-[#fca5a5] shadow-[0_0_20px_rgba(249,115,22,0.6)]" 
                style={{ width: `${stats.activeSessions > 0 ? 100 - (stats.errorRate * 2) : 100}%` }}
              >
                <div className="w-full h-full opacity-30 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_25%,rgba(255,255,255,0.2)_50%,transparent_50%,transparent_75%,rgba(255,255,255,0.2)_75%,rgba(255,255,255,0.2)_100%)] bg-[length:20px_20px]"></div>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-xs text-muted-foreground font-mono tracking-widest uppercase">Memory</div>
              <div className="text-sm text-white font-mono">{hitRateValue != null ? hitRateValue : 0}% / 100%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Badges (Integrations row simulation) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-y border-border/50 py-3">
        <span className="text-[10px] text-primary uppercase tracking-widest font-mono mr-2">Integrations</span>
        {['GITHUB', 'LINEAR', 'SLACK', 'CONVEX', 'VERCEL'].map((integration) => (
          <div key={integration} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-card/40 border border-border/50 hover:border-primary/50 cursor-pointer transition-colors">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80"></span>
            <span className="text-[10px] text-muted-foreground font-mono tracking-widest uppercase">{integration}</span>
          </div>
        ))}
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.slice(0, 4).map((kpi) => (
          <MetricCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            numericValue={kpi.numericValue}
            threshold={kpi.threshold}
            format={kpi.format}
            onClick={kpi.onClick}
            trend={kpi.numericValue != null ? (kpi.numericValue > (kpi.threshold?.ok || 0) ? "up" : "neutral") : undefined}
          />
        ))}
        {kpis.slice(4, 8).map((kpi) => (
          <MetricCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            numericValue={kpi.numericValue}
            threshold={kpi.threshold}
            format={kpi.format}
            onClick={kpi.onClick}
            trend={kpi.numericValue != null && kpi.threshold ? (kpi.numericValue >= kpi.threshold.ok ? "up" : "down") : undefined}
          />
        ))}
      </div>
    </div>
  );
}
