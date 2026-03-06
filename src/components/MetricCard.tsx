interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: "up" | "down" | "neutral";
}

export default function MetricCard({ label, value, trend }: MetricCardProps) {
  const trendArrow =
    trend === "up" ? "^" : trend === "down" ? "v" : null;
  const trendColor =
    trend === "up"
      ? "text-green-400"
      : trend === "down"
        ? "text-red-400"
        : "text-gray-500";

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-gray-100">{value}</span>
        {trendArrow && (
          <span className={`text-sm font-mono ${trendColor}`}>{trendArrow}</span>
        )}
      </div>
    </div>
  );
}
