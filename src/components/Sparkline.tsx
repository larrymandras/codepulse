import { memo } from "react";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

function SparklineInner({ data, width = 80, height = 24, color = "#6366f1" }: SparklineProps) {
  if (data.length < 2) {
    return (
      <svg width={width} height={height} className="inline-block">
        <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke={color} strokeOpacity={0.3} strokeWidth={1} />
      </svg>
    );
  }

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const padding = 2;
  const drawHeight = height - padding * 2;
  const step = width / (data.length - 1);

  const points = data
    .map((val, i) => {
      const x = i * step;
      const y = padding + drawHeight - ((val - min) / range) * drawHeight;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const Sparkline = memo(SparklineInner);
export default Sparkline;
