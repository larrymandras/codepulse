import { cn } from "@/lib/utils";

interface FunnelStep {
  label: string;
  count: number;
}

interface ExtractionFunnelProps {
  steps: FunnelStep[];
  className?: string;
}

const STEP_OPACITIES = [0.9, 0.7, 0.5, 0.4];

export function ExtractionFunnel({ steps, className }: ExtractionFunnelProps) {
  return (
    <div className={cn("flex items-stretch gap-0", className)}>
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const pct =
          i > 0 && steps[i - 1].count > 0
            ? Math.round((step.count / steps[i - 1].count) * 100)
            : 100;
        const stepColor = isLast
          ? "var(--status-ok)"
          : `color-mix(in srgb, var(--chart-bar) ${Math.round((STEP_OPACITIES[i] ?? 0.4) * 100)}%, transparent)`;

        return (
          <div
            key={step.label}
            className="relative flex-1 flex flex-col items-center gap-1 px-2 py-3"
          >
            <span
              className="text-2xl font-semibold tabular-nums"
              style={{ color: stepColor }}
            >
              {step.count.toLocaleString()}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground text-center">
              {step.label}
            </span>
            {i > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
            )}
            {i < steps.length - 1 && (
              <span className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground text-lg leading-none">
                &rsaquo;
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
