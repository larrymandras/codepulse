/**
 * RadialGauge — shared SVG ring gauge, extracted from `VitalsRail.tsx`'s
 * "System Vitals" card (188-11 Task 2). `VitalsRail.tsx` and the promoted
 * command-center `SystemMonitorPanel.tsx` both render the exact same
 * CPU/RAM/DISK gauges from the exact same telemetry — this module is the
 * ONE gauge implementation both consumers share, not a copy-pasted second
 * one. No behavior change from the original inline `VitalsRail.tsx`
 * definition — pure move.
 *
 * 122-16 (D-19/D-20): `value == null` used to render one honest-looking but
 * ambiguous "—" for two genuinely different causes — the caller's own query
 * hasn't resolved yet, or it resolved and this metric has no value. Both
 * callers already hold that distinction (`useSystemResources()` returns
 * `undefined` strictly while loading), so an optional `loading` prop lets
 * this shared gauge honor it without changing its 64×64 geometry: loading
 * renders a small `Skeleton` block sized to the numeral it will become,
 * resolved-but-absent renders plain `n/a` text. Neither uses the
 * icon-bearing `InlineMetricState` — it wouldn't fit this ring's fixed
 * footprint without shifting the chat rail's layout (same footprint-
 * stability precedent 122-15 established for `SwarmTaskNode`).
 */

import { Skeleton } from "@/components/ui/skeleton";

export interface RadialGaugeProps {
  value: number | undefined | null;
  label: string;
  warnAt?: number;
  /** True while the caller's own query has not resolved yet — lets the
   *  gauge distinguish "still loading" from "resolved, but this metric has
   *  no value" instead of rendering the same dash for both. Defaults to
   *  `false` so a caller that doesn't (yet) know its own loading state
   *  keeps behaving as before: a plain honest `n/a`. */
  loading?: boolean;
}

export function RadialGauge({ value, label, warnAt = 85, loading = false }: RadialGaugeProps) {
  const has = value != null && Number.isFinite(value);
  const pct = has ? Math.max(0, Math.min(100, value as number)) : 0;
  const r = 29;
  const circ = 2 * Math.PI * r;
  const off = circ * (1 - pct / 100);
  const warn = has && pct >= warnAt;
  const stroke = warn ? "var(--status-warn)" : "var(--primary)";
  return (
    <div
      className="flex flex-col items-center"
      data-testid="radial-gauge"
      data-label={label}
      data-has-value={has}
      data-warn={warn}
      data-loading={loading}
    >
      <div className="relative w-[64px] h-[64px]">
        <svg viewBox="0 0 72 72" className="w-full h-full -rotate-90">
          <circle cx="36" cy="36" r={r} fill="none" strokeWidth="7" className="stroke-border/50" />
          <circle
            cx="36"
            cy="36"
            r={r}
            fill="none"
            strokeWidth="7"
            strokeLinecap="round"
            stroke={stroke}
            strokeDasharray={circ}
            strokeDashoffset={has ? off : circ}
            style={{ transition: "stroke-dashoffset .5s ease" }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center font-mono font-bold text-sm tabular-nums">
          {has ? (
            Math.round(pct)
          ) : loading ? (
            <Skeleton className="h-4 w-6" />
          ) : (
            <span className="text-[10px] text-muted-foreground">n/a</span>
          )}
          {has && <span className="text-[9px] text-muted-foreground ml-0.5">%</span>}
        </div>
      </div>
      <div className="mt-1 font-mono text-[9px] tracking-[0.14em] uppercase text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

export default RadialGauge;
