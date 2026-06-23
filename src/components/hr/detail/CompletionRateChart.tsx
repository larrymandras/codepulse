import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { MetricRecord } from "./MetricsDashboard";

interface CompletionRateChartProps {
  metrics: MetricRecord[];
}

const chartConfig: ChartConfig = {
  completionRate: {
    label: "Completion %",
    color: "var(--status-ok)",
  },
  errorRate: {
    label: "Error %",
    color: "var(--status-error)",
  },
};

export function CompletionRateChart({ metrics }: CompletionRateChartProps) {
  const data = useMemo(() => {
    if (metrics.length === 0) return [];

    const timestamps = metrics.map((m) => m.timestamp);
    const minTs = Math.min(...timestamps);
    const maxTs = Math.max(...timestamps);
    const range = maxTs - minTs;

    // Adaptive bucketing: aim for ~8-12 buckets
    const targetBuckets = Math.max(1, Math.min(12, Math.ceil(range > 0 ? 8 : 1)));
    const bucketWidth = range > 0 ? range / targetBuckets : 1;

    const buckets: Map<
      number,
      { success: number; failure: number; timeout: number; total: number; label: string }
    > = new Map();

    for (let i = 0; i < targetBuckets; i++) {
      const bucketStart = minTs + i * bucketWidth;
      const date = new Date(bucketStart * 1000);
      const label =
        range < 7200
          ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : range < 172800
            ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : date.toLocaleDateString([], { month: "short", day: "numeric" });
      buckets.set(i, { success: 0, failure: 0, timeout: 0, total: 0, label });
    }

    for (const m of metrics) {
      const idx = Math.min(
        Math.floor((m.timestamp - minTs) / bucketWidth),
        targetBuckets - 1,
      );
      const bucket = buckets.get(idx)!;
      bucket.total++;
      if (m.taskOutcome === "success") bucket.success++;
      else if (m.taskOutcome === "failure") bucket.failure++;
      else if (m.taskOutcome === "timeout") bucket.timeout++;
    }

    return Array.from(buckets.values())
      .filter((b) => b.total > 0)
      .map((b) => ({
        label: b.label,
        completionRate: Math.round((b.success / b.total) * 100),
        errorRate: Math.round(((b.failure + b.timeout) / b.total) * 100),
      }));
  }, [metrics]);

  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm font-normal text-muted-foreground mb-2">
        Task Completion & Error Rate
      </p>
      {data.length === 0 ? (
        <p className="text-base text-muted-foreground text-center py-8">
          No task data
        </p>
      ) : (
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <LineChart data={data}>
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              type="monotone"
              dataKey="completionRate"
              stroke="var(--status-ok)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="errorRate"
              stroke="var(--status-error)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      )}
    </div>
  );
}

export default CompletionRateChart;
