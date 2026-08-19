import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * LoadingState — the shared shaped-skeleton primitive (122-15-PLAN.md, D-15).
 * Every bare "Loading..." string this sweep removes routes through one of
 * these shapes instead of inventing its own spinner-plus-word markup:
 * design law is that a skeleton is shaped like the content it replaces,
 * never a generic bar and never the word "Loading" — matching
 * `EmptyState.tsx`'s own `loading` branch, which composes the same
 * `Skeleton` primitive at panel scale. This module is the TABLE / METRIC /
 * CHART / TEXT / PAGE layer; `EmptyState` remains the panel-scale renderer
 * for the other five states (empty/stale/unavailable/error/ready).
 *
 * Before this plan, this component had zero callers anywhere in `src/`
 * (confirmed by a repo-wide search) — it was dead code with a hardcoded
 * spinner-and-word body. This plan is what wires it up.
 */

export type LoadingShape = "table" | "metric" | "chart" | "text" | "page";

export interface LoadingStateProps {
  /** Which content shape this skeleton stands in for. Defaults to "text" —
   *  a small block placeholder — for callers that don't know anything more
   *  specific about what's coming. */
  shape?: LoadingShape;
  /** "table" shape only: how many skeleton rows to render. */
  rows?: number;
  className?: string;
}

export default function LoadingState({
  shape = "text",
  rows = 4,
  className,
}: LoadingStateProps) {
  switch (shape) {
    case "table":
      return <TableSkeleton rows={rows} className={className} />;
    case "metric":
      return <MetricSkeleton className={className} />;
    case "chart":
      return <ChartSkeleton className={className} />;
    case "page":
      return <PageSkeleton className={className} />;
    case "text":
    default:
      return <TextSkeleton className={className} />;
  }
}

function TableSkeleton({ rows, className }: { rows: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} data-testid="loading-skeleton-table">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}

function MetricSkeleton({ className }: { className?: string }) {
  // Matches MetricCard's own skeleton branch: a label-width block plus a
  // numeral-width block, so the same loading condition looks identical at
  // tile scale wherever it appears.
  return (
    <div className={cn("space-y-2", className)} data-testid="loading-skeleton-metric">
      <Skeleton className="h-3 w-1/4" />
      <Skeleton className="h-8 w-1/2" />
    </div>
  );
}

function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3", className)} data-testid="loading-skeleton-chart">
      <Skeleton className="h-4 w-1/4" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

function TextSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex flex-col gap-2 justify-center min-h-[80px]", className)}
      data-testid="loading-skeleton-text"
    >
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

function PageSkeleton({ className }: { className?: string }) {
  // A whole-page placeholder for a route-level Suspense boundary: a
  // title-width block plus a grid of content blocks. This is the one shape
  // that doesn't know what's coming — the route's own component tree
  // hasn't loaded yet, so it can't supply a more specific shape than "a
  // page is arriving here".
  return (
    <div className={cn("p-8 space-y-6", className)} data-testid="loading-skeleton-page">
      <Skeleton className="h-6 w-1/3" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-1/4" />
            <Skeleton className="h-8 w-1/2" />
          </div>
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
