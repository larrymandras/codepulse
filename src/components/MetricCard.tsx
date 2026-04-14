import { memo } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: "up" | "down" | "neutral";
}

function MetricCardInner({ label, value, trend }: MetricCardProps) {
  const trendColor =
    trend === "up" ? "text-(--status-ok)"
    : trend === "down" ? "text-(--status-error)"
    : "text-muted-foreground";

  return (
    <div className="p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        {trend === "up" && <TrendingUp className={`h-4 w-4 ${trendColor}`} />}
        {trend === "down" && <TrendingDown className={`h-4 w-4 ${trendColor}`} />}
      </div>
    </div>
  );
}

const MetricCard = memo(MetricCardInner);
export default MetricCard;
