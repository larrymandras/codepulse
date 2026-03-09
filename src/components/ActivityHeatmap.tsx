import { useActivityHeatmap } from "../hooks/useAdvancedAnalytics";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function cellColor(count: number, max: number): string {
  if (count === 0) return "transparent";
  const t = count / max;
  if (t < 0.33) return `rgba(34, 211, 238, ${0.3 + t * 2})`;   // cyan-400
  if (t < 0.66) return `rgba(251, 146, 60, ${0.5 + t * 0.5})`;  // orange-400
  return `rgba(239, 68, 68, ${0.7 + t * 0.3})`;                  // red-500
}

export default function ActivityHeatmap() {
  const { cells, maxCount } = useActivityHeatmap();

  const cellMap: Record<string, number> = {};
  for (const c of cells) {
    cellMap[`${c.day}-${c.hour}`] = c.count;
  }

  if (cells.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Activity Heatmap</h2>
        <p className="text-gray-500 text-sm">No data yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">Activity Heatmap</h2>
      <div className="overflow-x-auto">
        {/* Hour labels */}
        <div className="flex ml-10 mb-1 gap-px">
          {HOURS.map((h) => (
            <div
              key={h}
              className="flex-1 min-w-[18px] text-center text-[10px] text-gray-500"
            >
              {h % 3 === 0 ? `${h}` : ""}
            </div>
          ))}
        </div>
        {/* Rows */}
        {DAYS.map((dayLabel, dayIdx) => (
          <div key={dayIdx} className="flex items-center gap-px mb-px">
            <span className="w-10 text-[10px] text-gray-500 text-right pr-2 shrink-0">
              {dayLabel}
            </span>
            {HOURS.map((hour) => {
              const count = cellMap[`${dayIdx}-${hour}`] ?? 0;
              return (
                <div
                  key={hour}
                  className="flex-1 min-w-[18px] aspect-square rounded-sm transition-transform hover:scale-125 cursor-default"
                  style={{ backgroundColor: cellColor(count, maxCount) }}
                  title={`${dayLabel} ${hour}:00 — ${count} events`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
