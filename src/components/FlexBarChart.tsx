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

export function FlexBarChart({ data, height = 80, onSegmentClick }: FlexBarChartProps) {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((d) => (
        <div
          key={d.label}
          className="relative flex-1 group cursor-pointer"
          style={{ height: `${(d.value / maxVal) * 100}%` }}
          onClick={() => onSegmentClick?.(d.label, d.value)}
        >
          <div className="w-full h-full bg-(--chart-bar) hover:bg-(--chart-bar-accent) transition-colors" />
          <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-popover border border-border px-2 py-1 text-xs text-popover-foreground whitespace-nowrap z-10">
            {d.label}: {d.value}
          </div>
        </div>
      ))}
    </div>
  );
}
