import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { estimateCost } from "@/lib/modelPricing";
import { formatCost } from "@/lib/formatters";
import type { MetricRecord } from "./MetricsDashboard";

interface TokenUsageChartProps {
  metrics: MetricRecord[];
}

const chartConfig: ChartConfig = {
  inputTokens: {
    label: "Input",
    color: "var(--chart-bar)",
  },
  outputTokens: {
    label: "Output",
    color: "var(--chart-bar-accent)",
  },
};

export function TokenUsageChart({ metrics }: TokenUsageChartProps) {
  const { data, totalTokens, totalCost, hasData } = useMemo(() => {
    if (metrics.length === 0) {
      return { data: [], totalTokens: 0, totalCost: 0, hasData: false };
    }

    const timestamps = metrics.map((m) => m.timestamp);
    const minTs = Math.min(...timestamps);
    const maxTs = Math.max(...timestamps);
    const range = maxTs - minTs;

    const targetBuckets = Math.max(1, Math.min(12, Math.ceil(range > 0 ? 8 : 1)));
    const bucketWidth = range > 0 ? range / targetBuckets : 1;

    const buckets: Map<
      number,
      { inputTokens: number; outputTokens: number; label: string }
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
      buckets.set(i, { inputTokens: 0, outputTokens: 0, label });
    }

    for (const m of metrics) {
      const idx = Math.min(
        Math.floor((m.timestamp - minTs) / bucketWidth),
        targetBuckets - 1,
      );
      const bucket = buckets.get(idx)!;
      bucket.inputTokens += m.inputTokens;
      bucket.outputTokens += m.outputTokens;
    }

    const tTokens = metrics.reduce(
      (s, m) => s + m.inputTokens + m.outputTokens,
      0,
    );
    const tCost = metrics.reduce(
      (s, m) =>
        s + estimateCost(m.inputTokens, m.outputTokens, m.modelUsed ?? "default"),
      0,
    );

    return {
      data: Array.from(buckets.values()),
      totalTokens: tTokens,
      totalCost: tCost,
      hasData: true,
    };
  }, [metrics]);

  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs font-normal text-muted-foreground mb-2">
        Token Usage & Cost
      </p>
      {!hasData ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No token data
        </p>
      ) : (
        <>
          <div className="flex gap-4 mb-2">
            <div>
              <span className="font-mono text-lg font-semibold">
                {totalTokens.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground ml-1">tokens</span>
            </div>
            <div>
              <span className="font-mono text-lg font-semibold">
                {formatCost(totalCost)}
              </span>
              <span className="text-xs text-muted-foreground ml-1">est. cost</span>
            </div>
          </div>
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <BarChart data={data}>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                dataKey="inputTokens"
                stackId="tokens"
                fill="var(--chart-bar)"
                name="Input"
              />
              <Bar
                dataKey="outputTokens"
                stackId="tokens"
                fill="var(--chart-bar-accent)"
                name="Output"
              />
            </BarChart>
          </ChartContainer>
        </>
      )}
    </div>
  );
}

export default TokenUsageChart;
