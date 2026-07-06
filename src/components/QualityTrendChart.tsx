import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, ReferenceLine } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

// The 4 fixed rubric dimensions the LLM judge scores (convex/evalScores.ts
// JUDGE_TOOL / JudgeOutputSchema) — task_completion, error_handling,
// tool_efficiency, cost_discipline. Colored via the --chart-2..5 tokens,
// leaving --chart-1 for the overall line.
export const RUBRIC_DIMENSIONS: { key: string; label: string; color: string }[] = [
  { key: "task_completion", label: "Task Completion", color: "var(--chart-2)" },
  { key: "error_handling", label: "Error Handling", color: "var(--chart-3)" },
  { key: "tool_efficiency", label: "Tool Efficiency", color: "var(--chart-4)" },
  { key: "cost_discipline", label: "Cost Discipline", color: "var(--chart-5)" },
];

export interface QualityTrendSeriesPoint {
  timestamp: number;
  sessionId: string;
  overall: number;
  dimensions?: Record<string, { score: number; rationale: string }>;
}

export interface QualityTrendMarker {
  timestamp: number;
  changeType: "model" | "switch";
}

interface QualityTrendChartProps {
  series: QualityTrendSeriesPoint[];
  markers: QualityTrendMarker[];
}

function formatDateLabel(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

const chartConfig: ChartConfig = {
  overall: { label: "Overall", color: "var(--chart-1)" },
  task_completion: { label: "Task Completion", color: "var(--chart-2)" },
  error_handling: { label: "Error Handling", color: "var(--chart-3)" },
  tool_efficiency: { label: "Tool Efficiency", color: "var(--chart-4)" },
  cost_discipline: { label: "Cost Discipline", color: "var(--chart-5)" },
};

/**
 * Multi-dimension quality trend chart (D-16). Scores arrive 0-1 and are
 * rendered 0-100 to match the KPI card display convention. Change-event
 * markers (persona model/instruction changes, D-11) render as ReferenceLine
 * verticals, mirroring ResponseTimeChart.tsx's p50/p95/p99 marker pattern.
 *
 * WR-05 (93-REVIEW): the XAxis is a NUMERIC time axis keyed on the raw
 * timestamp, not a category axis of formatted dates. On a category axis,
 * Recharts silently drops a ReferenceLine whose x doesn't match an existing
 * category — and a model/instruction change rarely lands on the same
 * calendar day as a judged session, so the most important markers vanished.
 * The numeric domain spans BOTH the session series and the markers, so a
 * marker outside the judged-session range still renders.
 */
export function QualityTrendChart({ series, markers }: QualityTrendChartProps) {
  const { data, hasData, markerLabels, domain } = useMemo(() => {
    if (series.length === 0) {
      return {
        data: [],
        hasData: false,
        markerLabels: [] as { timestamp: number; label: string }[],
        domain: [0, 1] as [number, number],
      };
    }

    const sorted = [...series].sort((a, b) => a.timestamp - b.timestamp);
    const rows = sorted.map((point) => {
      const row: Record<string, number | string> = {
        timestamp: point.timestamp,
        overall: Math.round(point.overall * 100),
      };
      for (const dim of RUBRIC_DIMENSIONS) {
        const d = point.dimensions?.[dim.key];
        if (d) row[dim.key] = Math.round(d.score * 100);
      }
      return row;
    });

    const marks = markers.map((m) => ({
      timestamp: m.timestamp,
      label: m.changeType === "model" ? "Model change" : "Instruction change",
    }));

    const allTimestamps = [
      ...sorted.map((p) => p.timestamp),
      ...marks.map((m) => m.timestamp),
    ];
    const axisDomain: [number, number] = [
      Math.min(...allTimestamps),
      Math.max(...allTimestamps),
    ];

    return { data: rows, hasData: true, markerLabels: marks, domain: axisDomain };
  }, [series, markers]);

  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm font-normal text-muted-foreground mb-2">Quality Trend</p>
      {!hasData ? (
        <p className="text-base text-muted-foreground text-center py-8">
          No judged sessions in this range yet.
        </p>
      ) : (
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <LineChart data={data}>
            <XAxis
              dataKey="timestamp"
              type="number"
              domain={domain}
              tickFormatter={(value) => formatDateLabel(Number(value))}
              tick={{ fontSize: 10 }}
            />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_value, payload) =>
                    formatDateLabel(
                      Number((payload?.[0]?.payload as { timestamp?: number })?.timestamp ?? 0)
                    )
                  }
                />
              }
            />
            <Line
              type="monotone"
              dataKey="overall"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={false}
            />
            {RUBRIC_DIMENSIONS.map((dim) => (
              <Line
                key={dim.key}
                type="monotone"
                dataKey={dim.key}
                stroke={dim.color}
                strokeWidth={2}
                dot={false}
              />
            ))}
            {markerLabels.map((m, i) => (
              <ReferenceLine
                key={`${m.timestamp}-${i}`}
                x={m.timestamp}
                stroke="var(--status-error)"
                strokeDasharray="4 4"
                label={{ value: m.label, position: "top", fontSize: 10 }}
              />
            ))}
          </LineChart>
        </ChartContainer>
      )}
    </div>
  );
}

export default QualityTrendChart;
