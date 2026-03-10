import { useNavigate } from "react-router-dom";
import { useHeroStats } from "../hooks/useHeroStats";
import { formatCost } from "../lib/formatters";
import InfoTooltip from "./InfoTooltip";

function Sparkline({ data, color, height = 24 }: { data: number[]; color: string; height?: number }) {
  if (data.length === 0) return null;
  const max = Math.max(...data, 1);
  const w = 60;
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${height - (v / max) * height}`)
    .join(" ");

  return (
    <svg width={w} height={height} className="shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const healthConfig = {
  green: { bg: "bg-emerald-500", label: "Healthy", ring: "ring-emerald-500/30" },
  yellow: { bg: "bg-yellow-500", label: "Warning", ring: "ring-yellow-500/30" },
  red: { bg: "bg-red-500", label: "Critical", ring: "ring-red-500/30" },
};

export default function HeroStatsBar() {
  const stats = useHeroStats();
  const navigate = useNavigate();
  const hc = healthConfig[stats.health];

  const kpis = [
    {
      label: "Sessions",
      value: stats.activeSessions,
      sub: `${stats.runningAgents} agents`,
      color: "#60a5fa",
      onClick: () => navigate("/agents"),
    },
    {
      label: "Events / hr",
      value: stats.eventsThisHour,
      sparkline: stats.eventSparkline,
      color: "#a78bfa",
      onClick: () => navigate("/analytics"),
    },
    {
      label: "Error Rate",
      value: `${stats.errorRate}%`,
      sub: `${stats.errorsThisHour} errors`,
      color: stats.errorRate > 20 ? "#f87171" : stats.errorRate > 10 ? "#fbbf24" : "#34d399",
      onClick: () => navigate("/alerts"),
    },
    {
      label: "Alerts",
      value: stats.activeAlerts,
      sub:
        stats.criticalAlerts > 0
          ? `${stats.criticalAlerts} critical`
          : stats.errorAlerts > 0
            ? `${stats.errorAlerts} errors`
            : "all clear",
      color: stats.criticalAlerts > 0 ? "#f87171" : stats.errorAlerts > 0 ? "#fb923c" : "#34d399",
      onClick: () => navigate("/alerts"),
    },
    {
      label: "Cost / hr",
      value: formatCost(stats.hourlyCost),
      sparkline: stats.costSparkline,
      color: "#fbbf24",
      onClick: () => navigate("/analytics"),
    },
    {
      label: "Tokens / hr",
      value: stats.hourlyTokens > 1000 ? `${(stats.hourlyTokens / 1000).toFixed(1)}k` : stats.hourlyTokens,
      color: "#22d3ee",
      onClick: () => navigate("/analytics"),
    },
    {
      label: "Tools",
      value: stats.knownTools,
      color: "#a78bfa",
      onClick: () => navigate("/capabilities"),
    },
    {
      label: "Security",
      value: stats.securityEvents,
      sub: "this hour",
      color: stats.securityEvents > 0 ? "#fb923c" : "#34d399",
      onClick: () => navigate("/security"),
    },
  ];

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <div className="flex items-center gap-4 mb-4">
        {/* Health indicator */}
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${hc.bg} ring-4 ${hc.ring}`} />
          <span className="text-sm font-semibold text-gray-200">{hc.label}</span>
        </div>
        <div className="h-4 w-px bg-gray-700" />
        <span className="text-xs text-gray-500">System Status — Last Hour</span>
        <InfoTooltip text="Key performance indicators: sessions, events, errors, cost, tokens, tools, and security alerts" />
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            onClick={kpi.onClick}
            className="group flex flex-col gap-1 cursor-pointer rounded-lg px-2 py-1.5 -mx-2 -my-1.5 transition-colors hover:bg-gray-800/70"
          >
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">
              {kpi.label}
            </span>
            <div className="flex items-end gap-2">
              <span
                className="text-xl font-bold tabular-nums"
                style={{ color: kpi.color }}
              >
                {kpi.value}
              </span>
              {kpi.sparkline && (
                <Sparkline data={kpi.sparkline} color={kpi.color} />
              )}
            </div>
            {kpi.sub && (
              <span className="text-[10px] text-gray-500">{kpi.sub}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
