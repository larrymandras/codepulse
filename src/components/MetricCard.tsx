import { memo, useEffect, useMemo, useRef } from "react";
import { useMotionValue, useSpring, useTransform, motion } from "motion/react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { METRIC_STATE_COPY } from "@/lib/metricState";
import type { MetricState } from "@/lib/metricState";

// ─── AnimatedNumber ───────────────────────────────────────────────────────────

/**
 * D-09: the count-up spring's duration reads the `--duration-slow` motion
 * token (320ms) instead of carrying its own literal. `useSpring`'s
 * `duration` option is a JS number, not a CSS value, so it can't reference
 * the custom property the way a Tailwind `duration-slow` class does --
 * this reads the token's resolved value off `:root` once, the same
 * pattern `useThemeColors.ts:46-48` uses for JS code that needs a token
 * (`getComputedStyle(document.documentElement).getPropertyValue(...)`).
 * Falls back to the token's own authored value (320ms) when the
 * stylesheet hasn't produced one yet -- e.g. under Vitest, which does not
 * process CSS (see vitest.config.ts: no `css: true`).
 *
 * 320ms (not the original 400ms) was judged the right speed: it's the
 * slowest deliberate-motion token this app defines, and a metric tile's
 * count-up is not an ambient loop that needs its own bespoke timing --
 * reusing the token is exactly what D-09 asks for.
 */
function readDurationSlowMs(): number {
  if (typeof document === "undefined") return 320;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--duration-slow")
    .trim();
  if (!raw) return 320;
  const parsed = parseFloat(raw);
  if (Number.isNaN(parsed)) return 320;
  return raw.endsWith("ms") ? parsed : parsed * 1000;
}

export function AnimatedNumber({
  value,
  format,
}: {
  value: number;
  format?: (v: number) => string;
}) {
  const motionValue = useMotionValue(0);
  const duration = useMemo(readDurationSlowMs, []);
  const springValue = useSpring(motionValue, { duration });
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
  severity?: "critical" | "error" | "warning" | "info" | "default";
  threshold?: ThresholdConfig;
  format?: (v: number) => string;
  onClick?: () => void;
  sparklineData?: number[];
  /**
   * D-14: the caller declares what it knows about this metric; the tile
   * never infers. Defaults to `"ready"` so every render site plan 122-14
   * has not migrated yet keeps behaving exactly as before -- the default
   * is a migration bridge, not an end state (122-13-PLAN.md's threat
   * register, T-122-13-A: 122-14 migrates every render site, and a later
   * ratchet is what stops the default from becoming permanent).
   */
  state?: MetricState;
}

// Severity colors are driven entirely by the design-token scale
// (--status-*/--info/--primary). `color-mix` derives the dot glow and the
// hover card glow from the single source token, so there are no hardcoded
// rgba.
const severityConfig: Record<string, { color: string }> = {
  critical: { color: "var(--status-error)" },
  error: { color: "var(--status-error)" },
  warning: { color: "var(--status-warn)" },
  info: { color: "var(--info)" },
  default: { color: "var(--primary)" },
};

/** Exhaustiveness helper: if `MetricState` ever gains a member this switch
 *  doesn't handle, the `default` branch below narrows `state` to something
 *  other than `never` and `tsc --noEmit` fails on this call -- turning an
 *  unhandled state into a compile error rather than a silent fallthrough
 *  (the tile's core honesty guarantee). It also throws at runtime, so a
 *  type-stripping test runner (Vitest/esbuild does not typecheck) still
 *  catches it. */
function assertNever(x: never): never {
  throw new Error(`MetricCard: unhandled state "${String(x)}"`);
}

function MetricCardInner({
  label,
  value,
  numericValue,
  trend,
  severity = "default",
  threshold,
  format,
  onClick,
  state = "ready",
}: MetricCardProps) {
  const trendColor =
    trend === "up" ? "text-(--status-ok)"
    : trend === "down" ? "text-(--status-error)"
    : "text-muted-foreground";

  const valueColor =
    threshold != null && numericValue != null
      ? thresholdColor(numericValue, threshold)
      : undefined;

  const sevConfig = severityConfig[severity] || severityConfig.default;
  // Hover card glow derived from the severity token via color-mix, so a
  // single token drives it. The resting glow this card used to carry (an
  // inline alpha-blended literal) is gone (D-13) and nothing replaces it:
  // no `--shadow-*` token exists in the closed token layer (src/index.css)
  // to build one from, and the border + layered `bg-card/60` + the stock
  // Tailwind `shadow-sm` utility already separate the tile from its
  // surface without inventing one -- see 122-13-SUMMARY.md for the full
  // reasoning.
  const hoverCardShadow = `0 0 25px color-mix(in srgb, ${sevConfig.color} 20%, transparent)`;

  // Only `ready` and `stale` have a real figure to show. Every other state
  // is an explicit admission the tile does not currently have a confident
  // value (D-14's whole point) -- so the severity dot (a health assertion)
  // and the trend arrow (a change-over-time assertion) are withheld too.
  // Asserting either about a value the tile isn't rendering would be the
  // exact fabrication this rewrite exists to remove.
  const showsValue = state === "ready" || state === "stale";

  const stateEntry = METRIC_STATE_COPY[state];
  const StateIcon = stateEntry.icon;

  let content: React.ReactNode;
  switch (state) {
    case "loading":
      // Design law: skeletons are shaped like the content they replace,
      // never a generic bar and never the word "Loading" -- a label-width
      // block plus a numeral-width block, matching EmptyState's own
      // "panel" default shape so the same loading condition looks
      // identical at tile scale and at panel scale.
      content = (
        <div className="space-y-2" data-testid="metric-card-skeleton">
          <Skeleton className="h-3 w-1/4" />
          <Skeleton className="h-8 w-1/2" />
        </div>
      );
      break;

    case "ready":
    case "stale":
      content = (
        <>
          <p className="text-sm text-muted-foreground uppercase tracking-widest font-mono z-10 relative">
            {label}
          </p>
          <div className="mt-2 flex items-baseline gap-2 z-10 relative">
            <span
              data-testid="metric-card-value"
              className="text-[40px] font-light tracking-tight tabular-nums font-mono text-foreground"
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
          {state === "stale" && (
            // Real value shown AND flagged, never hidden -- a stale number
            // is still information (122-13-PLAN.md behavior block).
            <p
              data-testid="metric-card-stale-note"
              className="mt-1 flex items-center gap-1 text-xs"
              style={{ color: stateEntry.tone }}
            >
              <StateIcon className="h-3 w-3" aria-hidden="true" />
              {stateEntry.label}
            </p>
          )}
        </>
      );
      break;

    case "empty":
    case "unavailable":
    case "error":
      // No dash, no invented figure -- just the shared vocabulary's own
      // copy/icon/tone for whichever of these three admissions applies.
      // `error` composes with `SectionErrorBoundary` rather than
      // duplicating its retry chrome: this is only the tile-scale message.
      content = (
        <>
          <p className="text-sm text-muted-foreground uppercase tracking-widest font-mono z-10 relative">
            {label}
          </p>
          <div className="mt-2 flex items-center gap-2 z-10 relative">
            <span
              data-testid="metric-card-message"
              className="flex items-center gap-2 text-sm"
              style={{ color: stateEntry.tone }}
            >
              <StateIcon className="h-4 w-4" aria-hidden="true" />
              {stateEntry.label}
            </span>
          </div>
        </>
      );
      break;

    default:
      return assertNever(state);
  }

  return (
    <div
      data-testid="metric-card"
      className="bg-card/60 backdrop-blur-md p-5 rounded-xl border border-border/50 shadow-sm relative group transition-all duration-slow ease-house hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      style={{ cursor: onClick ? "pointer" : "default" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = hoverCardShadow;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "";
      }}
    >
      {showsValue && (
        <div
          className="absolute top-4 right-4 w-2 h-2 rounded-full"
          style={{
            backgroundColor: sevConfig.color,
            boxShadow: `0 0 8px color-mix(in srgb, ${sevConfig.color} 80%, transparent)`,
          }}
        ></div>
      )}

      {content}
    </div>
  );
}

const MetricCard = memo(MetricCardInner);
export default MetricCard;
