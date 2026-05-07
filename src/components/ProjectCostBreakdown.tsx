import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import SectionErrorBoundary from "./SectionErrorBoundary";

const PERIOD_OPTIONS = [
  { label: "7d",  days: 7  },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

// Reuse tier color palette from Phase 093 index.css tokens
const COLORS = [
  "oklch(0.72 0.10 200)",  // tier-simple (first project tag)
  "oklch(0.60 0.16 270)",  // tier-complex (second project tag)
  "oklch(0.72 0.12 142)",  // tier-trivial (personal)
  "oklch(0.60 0.18 320)",  // tier-critical (fourth tag if present)
];

function ProjectCostBreakdownInner() {
  const [period, setPeriod] = useState(7);
  const windowStart = Date.now() / 1000 - period * 86400;
  const data = useQuery(api.agentMetrics.costByProject, { windowStart }) ?? {};

  // Transform { projectTag: { date: cost } } -> [{ date, tag1, tag2, ... }]
  const allDates = [...new Set(
    Object.values(data).flatMap((d: any) => Object.keys(d))
  )].sort();
  const allTags = Object.keys(data);
  const chartRows = allDates.map((date) => ({
    date,
    ...Object.fromEntries(allTags.map((tag) => [tag, (data as any)[tag]?.[date] ?? 0])),
  }));

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-300">Cost by Project</h2>
        <div className="flex gap-1">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => setPeriod(opt.days)}
              className={`text-xs px-2 py-1 rounded ${
                period === opt.days
                  ? "bg-gray-700 text-white"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {chartRows.length === 0 ? (
        <p className="text-gray-500 text-sm">No project cost data for this period.</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartRows}>
            <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 11 }} />
            <YAxis
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              tickFormatter={(v: number) => `$${v.toFixed(2)}`}
            />
            <Tooltip
              formatter={(value, name) => [
                typeof value === "number" ? `$${value.toFixed(4)}` : String(value ?? ""),
                String(name) === "personal" ? "Personal" : String(name),
              ]}
              contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }}
            />
            <Legend
              formatter={(value: string) => (value === "personal" ? "Personal" : value)}
            />
            {allTags.map((tag, i) => (
              <Bar key={tag} dataKey={tag} stackId="cost" fill={COLORS[i % COLORS.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export function ProjectCostBreakdown() {
  return (
    <SectionErrorBoundary name="Project Cost Breakdown">
      <ProjectCostBreakdownInner />
    </SectionErrorBoundary>
  );
}
