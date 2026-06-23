import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { ScoredRow } from "@/lib/leaderboardScoring";

interface AgentComparisonChartProps {
  rows: ScoredRow[];
  agentNameMap: Map<string, string>;
}

function truncate(s: string, max = 20) {
  return s.length > max ? s.slice(0, max - 1) + "\u2026" : s;
}

interface ChartRow {
  name: string;
  completion: number;
  responseTime: number;
  costEfficiency: number;
  _rawCompletion: number;
  _rawResponseTime: number | null;
  _rawCost: number;
}

export function AgentComparisonChart({
  rows,
  agentNameMap,
}: AgentComparisonChartProps) {
  const data = useMemo<ChartRow[]>(
    () =>
      rows.map((r) => ({
        name: truncate(agentNameMap.get(r.agentId) ?? r.agentId),
        completion: r.normCompletion,
        responseTime: r.normResponseTime,
        costEfficiency: r.normCostEfficiency,
        _rawCompletion: r.completionRate * 100,
        _rawResponseTime: r.avgResponseTimeMs,
        _rawCost: r.totalCost,
      })),
    [rows, agentNameMap],
  );

  if (rows.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, rows.length * 60)}>
      <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis type="number" domain={[0, 100]} stroke="var(--muted-foreground)" />
        <YAxis
          type="category"
          dataKey="name"
          width={130}
          tick={{ fontSize: 12 }}
          stroke="var(--muted-foreground)"
        />
        <Tooltip
          content={({ payload, label }) => {
            if (!payload || payload.length === 0) return null;
            const row = payload[0]?.payload as ChartRow | undefined;
            if (!row) return null;
            return (
              <div className="bg-popover border border-border rounded-md p-2 text-sm shadow-md">
                <p className="font-semibold mb-1">{label}</p>
                <p>Completion: {row._rawCompletion.toFixed(1)}%</p>
                <p>
                  Avg Response:{" "}
                  {row._rawResponseTime != null
                    ? `${row._rawResponseTime.toFixed(0)}ms`
                    : "-"}
                </p>
                <p>Cost: ${row._rawCost.toFixed(4)}</p>
              </div>
            );
          }}
        />
        <Legend />
        <Bar
          dataKey="completion"
          name="Completion"
          fill="var(--status-ok)"
          radius={[0, 2, 2, 0]}
        />
        <Bar
          dataKey="responseTime"
          name="Response Time"
          fill="var(--chart-bar-accent)"
          radius={[0, 2, 2, 0]}
        />
        <Bar
          dataKey="costEfficiency"
          name="Cost Efficiency"
          fill="var(--status-warn)"
          radius={[0, 2, 2, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
