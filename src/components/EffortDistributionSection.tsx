import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const TIER_ORDER = ["trivial", "simple", "moderate", "complex", "critical"] as const;
const TIER_LABELS: Record<string, string> = {
  trivial: "Trivial",
  simple: "Simple",
  moderate: "Moderate",
  complex: "Complex",
  critical: "Critical",
};
const TIER_COLORS: Record<string, string> = {
  trivial: "var(--tier-trivial)",
  simple: "var(--tier-simple)",
  moderate: "var(--tier-moderate)",
  complex: "var(--tier-complex)",
  critical: "var(--tier-critical)",
};

export function EffortDistributionSection() {
  const windowStart = Date.now() / 1000 - 30 * 86400; // 30 days
  const distribution = useQuery(api.complexityAssessments.distribution, { windowStart });
  const costSaved = useQuery(api.complexityAssessments.costSaved30d);

  // Calculate total for empty state check
  const totalEvents = distribution
    ? Object.values(distribution).reduce((sum, d) => sum + d.auto + d.override, 0)
    : 0;

  // Empty state: fewer than 3 total records per UI-SPEC
  if (distribution !== undefined && totalEvents < 3) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-sm font-medium text-foreground">No effort data yet</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-[300px]">
          Complexity assessments will appear here once messages are processed.
          Send a message to any channel to get started.
        </p>
      </div>
    );
  }

  // Build pie data: each tier gets two segments (auto + override)
  const pieData: Array<{ name: string; value: number; tier: string; source: string }> = [];
  for (const tier of TIER_ORDER) {
    const d = distribution?.[tier];
    if (!d) continue;
    if (d.auto > 0) pieData.push({ name: `${TIER_LABELS[tier]} (auto)`, value: d.auto, tier, source: "auto" });
    if (d.override > 0) pieData.push({ name: `${TIER_LABELS[tier]} (override)`, value: d.override, tier, source: "override" });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Donut chart (2/3 width) */}
      <div className="lg:col-span-2 flex items-center justify-center">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={2}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
            >
              {pieData.map((entry, i) => (
                <Cell
                  key={`cell-${i}`}
                  fill={TIER_COLORS[entry.tier]}
                  opacity={entry.source === "override" ? 0.7 : 1}
                  strokeDasharray={entry.source === "override" ? "4 2" : undefined}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--popover)",
                border: "1px solid var(--border)",
                color: "var(--popover-foreground)",
              }}
              formatter={(value, name) => {
                const numValue = typeof value === "number" ? value : 0;
                const pct = totalEvents > 0 ? ((numValue / totalEvents) * 100).toFixed(1) : "0";
                return [`${numValue} events (${pct}%)`, String(name ?? "")];
              }}
            />
            {/* Center label */}
            <text
              x="50%"
              y="50%"
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-muted-foreground text-sm"
            >
              {totalEvents} events
            </text>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Right: Cost-saved metric + legend (1/3 width) */}
      <div className="flex flex-col gap-4">
        {/* Cost-saved metric */}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Cost Saved (30d)
          </p>
          <p
            className="text-2xl font-semibold tabular-nums mt-1"
            style={{ color: "var(--status-ok)" }}
          >
            ${(costSaved?.totalSaved ?? 0).toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            vs. all-opus routing
          </p>
        </div>

        {/* Custom legend */}
        <div className="flex flex-col gap-1.5">
          {TIER_ORDER.map((tier) => {
            const d = distribution?.[tier];
            if (!d) return null;
            return (
              <div key={tier} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: TIER_COLORS[tier] }}
                />
                <span className="font-medium text-foreground">{TIER_LABELS[tier]}</span>
                <span className="tabular-nums">
                  (auto: {d.auto} | override: {d.override})
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
