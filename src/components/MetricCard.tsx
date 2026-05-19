import { memo, useEffect, useRef } from "react";
import { useMotionValue, useSpring, useTransform, motion } from "motion/react";
import { TrendingUp, TrendingDown } from "lucide-react";

// ─── AnimatedNumber ───────────────────────────────────────────────────────────

export function AnimatedNumber({
  value,
  format,
}: {
  value: number;
  format?: (v: number) => string;
}) {
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { duration: 400 });
  const displayed = useTransform(springValue, (v: number) =>
    format ? format(v) : Math.round(v).toString()
  );
  const prevRef = useRef(0);

  useEffect(() => {
    prevRef.current = motionValue.get();
    motionValue.set(value);
  }, [value, motionValue]);

  return <motion.span className="tabular-nums">{displayed}</motion.span>;
}

// ─── ThresholdConfig + thresholdColor ────────────────────────────────────────

export interface ThresholdConfig {
  ok: number;
  warn: number;
  /** true = "higher is better" (e.g., hit rate). Default = lower is better. */
  invertDirection?: boolean;
}

export function thresholdColor(value: number, config: ThresholdConfig): string {
  if (config.invertDirection) {
    // Higher is better: >= ok = green, >= warn = yellow, < warn = red
    if (value >= config.ok) return "var(--metric-ok)";
    if (value >= config.warn) return "var(--metric-warn)";
    return "var(--metric-error)";
  }
  // Lower is better: <= ok = green, <= warn = yellow, > warn = red
  if (value <= config.ok) return "var(--metric-ok)";
  if (value <= config.warn) return "var(--metric-warn)";
  return "var(--metric-error)";
}

// ─── MetricCard ──────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string | number;
  /** When set, uses AnimatedNumber for count-up animation */
  numericValue?: number;
  trend?: "up" | "down" | "neutral";
  threshold?: ThresholdConfig;
  format?: (v: number) => string;
  onClick?: () => void;
  sparklineData?: number[];
}

function MetricCardInner({
  label,
  value,
  numericValue,
  trend,
  threshold,
  format,
  onClick,
}: MetricCardProps) {
  const trendColor =
    trend === "up" ? "text-emerald-500"
    : trend === "down" ? "text-red-500"
    : "text-muted-foreground";

  const valueColor =
    threshold != null && numericValue != null
      ? thresholdColor(numericValue, threshold)
      : undefined;

  return (
    <div 
      className="glow-card bg-card/60 backdrop-blur-md p-5 rounded-xl border border-border/50 relative group transition-colors hover:border-primary/50" 
      onClick={onClick} 
      style={onClick ? { cursor: "pointer" } : undefined}
    >
      <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
      
      <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono z-10 relative">{label}</p>
      <div className="mt-2 flex items-baseline gap-2 z-10 relative">
        <span
          className="text-3xl font-medium tracking-tight text-white"
          style={valueColor ? { color: valueColor } : undefined}
        >
          {numericValue != null ? (
            <AnimatedNumber value={numericValue} format={format} />
          ) : (
            value
          )}
        </span>
        {trend === "up" && <TrendingUp className={`h-4 w-4 ${trendColor}`} />}
        {trend === "down" && <TrendingDown className={`h-4 w-4 ${trendColor}`} />}
      </div>
    </div>
  );
}

const MetricCard = memo(MetricCardInner);
export default MetricCard;
