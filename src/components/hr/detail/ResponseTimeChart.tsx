import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { MetricRecord } from "./MetricsDashboard";

interface ResponseTimeChartProps {
  metrics: MetricRecord[];
}

function calcPercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

function findBucketLabel(buckets: { label: string; min: number; max: number }[], value: number): string {
  for (const b of buckets) {
    if (value >= b.min && value < b.max) return b.label;
  }
  // Fall back to last bucket
  return buckets[buckets.length - 1]?.label ?? "";
}

const chartConfig: ChartConfig = {
  count: {
    label: "Count",
    color: "var(--chart-1)",
  },
};

export function ResponseTimeChart({ metrics }: ResponseTimeChartProps) {
  const { data, p50Label, p95Label, p99Label, hasData } = useMemo(() => {
    const times = metrics
      .map((m) => m.responseTimeMs ?? 0)
      .filter((t) => t > 0)
      .sort((a, b) => a - b);

    if (times.length === 0) {
      return { data: [], p50Label: "", p95Label: "", p99Label: "", hasData: false };
    }

    const maxTime = times[times.length - 1];
    const bucketCount = times.length < 20 ? 5 : times.length < 50 ? 10 : 15;
    const bucketWidth = Math.ceil(maxTime / bucketCount) || 1;

    const buckets: { label: string; min: number; max: number; count: number }[] = [];
    for (let i = 0; i < bucketCount; i++) {
      const min = i * bucketWidth;
      const max = (i + 1) * bucketWidth;
      buckets.push({
        label: `${min}-${max}ms`,
        min,
        max,
        count: 0,
      });
    }

    for (const t of times) {
      const idx = Math.min(Math.floor(t / bucketWidth), bucketCount - 1);
      buckets[idx].count++;
    }

    const p50 = calcPercentile(times, 50);
    const p95 = calcPercentile(times, 95);
    const p99 = calcPercentile(times, 99);

    return {
      data: buckets.map((b) => ({ label: b.label, count: b.count })),
      p50Label: findBucketLabel(buckets, p50),
      p95Label: findBucketLabel(buckets, p95),
      p99Label: findBucketLabel(buckets, p99),
      hasData: true,
    };
  }, [metrics]);

  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs font-normal text-muted-foreground mb-2">
        Response Time Distribution
      </p>
      {!hasData ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No response time data
        </p>
      ) : (
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <BarChart data={data}>
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="var(--chart-1)" />
            {p50Label && (
              <ReferenceLine
                x={p50Label}
                stroke="var(--chart-p50)"
                strokeDasharray="4 4"
                label={{ value: "p50", position: "top", fontSize: 10 }}
              />
            )}
            {p95Label && (
              <ReferenceLine
                x={p95Label}
                stroke="var(--chart-p95)"
                strokeDasharray="4 4"
                label={{ value: "p95", position: "top", fontSize: 10 }}
              />
            )}
            {p99Label && (
              <ReferenceLine
                x={p99Label}
                stroke="var(--chart-p99)"
                strokeDasharray="4 4"
                label={{ value: "p99", position: "top", fontSize: 10 }}
              />
            )}
          </BarChart>
        </ChartContainer>
      )}
    </div>
  );
}

export { calcPercentile };
export default ResponseTimeChart;
