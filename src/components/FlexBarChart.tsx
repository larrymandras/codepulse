export interface StackedSegment {
  value: number;
  color: string;   // hex color e.g. "#22c55e"
  label: string;
}

interface FlexBarSegment {
  label: string;
  value?: number;              // optional when segments present
  max?: number;
  segments?: StackedSegment[]; // when present, renders stacked bar
}

interface FlexBarChartProps {
  data: FlexBarSegment[];
  height?: number | string;
  onSegmentClick?: (label: string, value: number) => void;
}

export function FlexBarChart({ data, height = '100%', onSegmentClick }: FlexBarChartProps) {
  const maxVal = Math.max(
    ...data.map((d) =>
      d.segments
        ? d.segments.reduce((s, seg) => s + seg.value, 0)
        : (d.value ?? 0)
    ),
    1
  );

  return (
    <div className="flex items-end gap-1 w-full" style={{ height }}>
      {data.map((d) => {
        if (d.segments) {
          // Stacked segment bar
          const totalValue = d.segments.reduce((s, seg) => s + seg.value, 0);
          const barHeightPct = (totalValue / maxVal) * 100;
          return (
            <div
              key={d.label}
              className="relative flex-1 group cursor-pointer flex flex-col justify-end h-full"
            >
              <div
                data-stacked-bar
                className="w-full flex flex-col-reverse"
                style={{ height: `${barHeightPct}%` }}
              >
                {d.segments.map((seg) => {
                  const segHeightPct = totalValue > 0 ? (seg.value / totalValue) * 100 : 0;
                  return (
                    <div
                      key={seg.label}
                      style={{
                        height: `${segHeightPct}%`,
                        backgroundColor: seg.color,
                      }}
                    />
                  );
                })}
              </div>
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block bg-card border border-primary/50 px-3 py-1.5 rounded text-[10px] font-mono tracking-widest text-primary whitespace-nowrap z-10 shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                <div className="font-semibold mb-1">{d.label}</div>
                {d.segments.map((seg) => (
                  <div key={seg.label}>{seg.label}: {seg.value.toFixed(2)}</div>
                ))}
              </div>
            </div>
          );
        }

        // Single-value gradient bar (original rendering — backward compatible)
        return (
          <div
            key={d.label}
            className="relative flex-1 group cursor-pointer flex flex-col justify-end h-full"
            onClick={() => onSegmentClick?.(d.label, d.value ?? 0)}
          >
            <div
              className="w-full bg-gradient-to-t from-primary/10 to-primary/60 group-hover:from-primary/30 group-hover:to-primary border-t border-primary/50 group-hover:border-primary transition-all shadow-none group-hover:shadow-[var(--glow-sm)] rounded-t-[2px]"
              style={{ height: `${((d.value ?? 0) / maxVal) * 100}%` }}
            />
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block bg-card border border-primary/50 px-3 py-1.5 rounded text-[10px] font-mono tracking-widest text-primary whitespace-nowrap z-10 shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
              {d.label}: {d.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}
