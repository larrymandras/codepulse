/**
 * RadialGauge — shared SVG ring gauge, extracted from `VitalsRail.tsx`'s
 * "System Vitals" card (188-11 Task 2). `VitalsRail.tsx` and the promoted
 * command-center `SystemMonitorPanel.tsx` both render the exact same
 * CPU/RAM/DISK gauges from the exact same telemetry — this module is the
 * ONE gauge implementation both consumers share, not a copy-pasted second
 * one. No behavior change from the original inline `VitalsRail.tsx`
 * definition — pure move.
 */

export interface RadialGaugeProps {
  value: number | undefined | null;
  label: string;
  warnAt?: number;
}

export function RadialGauge({ value, label, warnAt = 85 }: RadialGaugeProps) {
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
          {has ? Math.round(pct) : "—"}
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
