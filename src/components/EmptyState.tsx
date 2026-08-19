import type { ReactNode } from "react";
import { GlassPanel } from "@/components/GlassPanel";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { METRIC_STATE_COPY } from "@/lib/metricState";
import type { MetricState } from "@/lib/metricState";

/**
 * EmptyState — the panel/page-scale renderer of the shared six-state
 * vocabulary (D-19/D-20). It defines no copy of its own: every label, icon
 * and tone it renders comes from `src/lib/metricState.ts`, so the same
 * backend condition reads identically whether it hits one tile
 * (`MetricCard`) or a whole panel (this component). This is a new pattern —
 * `122-PATTERNS.md` confirmed no empty/no-data panel component exists in
 * this repo to copy, so it composes `GlassPanel`-shaped chrome (pure
 * wrapper, no state logic of its own) with the shared vocabulary's content.
 */

export type EmptyStateLoadingShape = "panel" | "list" | "chart";

export interface EmptyStateProps {
  state: MetricState;
  /** Overrides the shared module's default copy for this state, where
   *  genuine per-site context exists (D-20). */
  label?: string;
  /** Rendered only where the caller has something genuinely actionable --
   *  e.g. "retry" or "configure this source". Never rendered automatically;
   *  this is what keeps `state="error"` from duplicating
   *  `SectionErrorBoundary`'s own always-present retry button. */
  action?: ReactNode;
  className?: string;
  /** Shape hint for the loading skeleton, defaulting to a generic panel
   *  shape (a label-width block plus a numeral-width block, matching
   *  MetricCard's own content). Design law: skeletons are shaped like the
   *  content they replace, never a generic bar. */
  loadingShape?: EmptyStateLoadingShape;
}

export function EmptyState({
  state,
  label,
  action,
  className,
  loadingShape = "panel",
}: EmptyStateProps) {
  if (state === "loading") {
    return (
      <GlassPanel className={cn("p-5", className)} animate={false}>
        <LoadingSkeleton shape={loadingShape} />
      </GlassPanel>
    );
  }

  const entry = METRIC_STATE_COPY[state];
  const Icon = entry.icon;
  const copy = label ?? entry.label;

  return (
    <GlassPanel
      className={cn(
        "p-6 flex flex-col items-center justify-center gap-3 text-center",
        className
      )}
      animate={false}
    >
      <Icon
        data-testid="empty-state-icon"
        className="w-6 h-6"
        style={{ color: entry.tone }}
        aria-hidden="true"
      />
      <p className="text-sm text-muted-foreground">{copy}</p>
      {action}
    </GlassPanel>
  );
}

function LoadingSkeleton({ shape }: { shape: EmptyStateLoadingShape }) {
  if (shape === "list") {
    return (
      <div className="space-y-2" data-testid="empty-state-skeleton-list">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }
  if (shape === "chart") {
    return (
      <div className="space-y-3" data-testid="empty-state-skeleton-chart">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  // Default "panel" shape mirrors MetricCard's own content: a label-width
  // block (the eyebrow) plus a numeral-width block (the hero figure).
  return (
    <div className="space-y-2" data-testid="empty-state-skeleton-panel">
      <Skeleton className="h-3 w-1/4" />
      <Skeleton className="h-8 w-1/2" />
    </div>
  );
}
