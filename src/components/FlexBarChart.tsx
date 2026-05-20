interface FlexBarSegment {
  label: string;
  value: number;
  max?: number;
}

interface FlexBarChartProps {
  data: FlexBarSegment[];
  height?: number;
  onSegmentClick?: (label: string, value: number) => void;
}

export function FlexBarChart({ data, height = '100%', onSegmentClick }: FlexBarChartProps & { height?: number | string }) {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-1 w-full" style={{ height }}>
      {data.map((d) => (
        <div
          key={d.label}
          className="relative flex-1 group cursor-pointer flex flex-col justify-end h-full"
          onClick={() => onSegmentClick?.(d.label, d.value)}
        >
          <div 
            className="w-full bg-gradient-to-t from-primary/10 to-primary/60 group-hover:from-primary/30 group-hover:to-primary border-t border-primary/50 group-hover:border-primary transition-all shadow-none group-hover:shadow-[0_0_15px_rgba(249,115,22,0.6)] rounded-t-[2px]" 
            style={{ height: `${(d.value / maxVal) * 100}%` }}
          />
          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block bg-card border border-primary/50 px-3 py-1.5 rounded text-[10px] font-mono tracking-widest text-primary whitespace-nowrap z-10 shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
            {d.label}: {d.value}
          </div>
        </div>
      ))}
    </div>
  );
}
