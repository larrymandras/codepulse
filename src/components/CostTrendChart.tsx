import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { FlexBarChart } from "./FlexBarChart";
import { PROVIDER_DISPLAY_NAMES, PROVIDER_COLORS } from "../lib/providers";
import InfoTooltip from "./InfoTooltip";

export default function CostTrendChart() {
  const buckets = useQuery(api.aggregates.costByPeriodByProvider, {
    period: "hourly",
    lookbackHours: 24,
    billingType: "api",
  }) ?? [];

  const data = buckets.map((b) => ({
    label: new Date(b.bucket_start * 1000).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    segments: Object.entries(b.byProvider).map(([provider, cost]) => ({
      value: cost as number,
      color: PROVIDER_COLORS[provider] ?? "#6b7280",
      label: PROVIDER_DISPLAY_NAMES[provider] ?? provider,
    })),
  }));

  if (data.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h2 className="text-sm font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">
          Cost Trend
          <InfoTooltip text="Hourly API spend trend broken down by provider over the last 24 hours" />
        </h2>
        <p className="text-gray-500 text-base">No API cost data yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">
        Cost Trend (Hourly by Provider)
        <InfoTooltip text="Hourly API spend trend broken down by provider over the last 24 hours" />
      </h2>
      <FlexBarChart data={data} height={300} />
    </div>
  );
}
