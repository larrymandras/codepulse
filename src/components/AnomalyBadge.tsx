import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AnomalyBadgeProps {
  severity: "warning" | "critical";
  metric: string;
  value: number;
  mean: number;
  zScore: number;
}

export default function AnomalyBadge({
  severity,
  metric,
  value,
  mean,
  zScore,
}: AnomalyBadgeProps) {
  const label = severity === "critical" ? "ANOMALY" : "WARN";
  const colorClass =
    severity === "critical"
      ? "bg-[var(--status-error)]/20 text-[var(--status-error)]"
      : "bg-[var(--status-warn)]/20 text-[var(--status-warn)]";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`text-sm px-2 py-1 font-medium inline-flex items-center cursor-default ${colorClass}`}
          >
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm space-y-1">
            <p className="font-medium">{metric} anomaly</p>
            <p>Current: {value.toFixed(2)}</p>
            <p>Expected: ~{mean.toFixed(2)}</p>
            <p>Z-score: {zScore.toFixed(1)}sigma</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
