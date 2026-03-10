import { useSecurityCounts } from "../hooks/useSecurityEvents";
import InfoTooltip from "./InfoTooltip";

const severityConfig = [
  { key: "critical", label: "Critical", color: "text-red-400", bg: "bg-red-400/10", dot: "bg-red-400" },
  { key: "high", label: "High", color: "text-orange-400", bg: "bg-orange-400/10", dot: "bg-orange-400" },
  { key: "medium", label: "Medium", color: "text-yellow-400", bg: "bg-yellow-400/10", dot: "bg-yellow-400" },
  { key: "low", label: "Low", color: "text-blue-400", bg: "bg-blue-400/10", dot: "bg-blue-400" },
];

export default function SecurityStats() {
  const counts = useSecurityCounts();

  return (
    <div className="grid grid-cols-4 gap-4 relative">
      <div className="absolute -top-1 right-0">
        <InfoTooltip text="Security event counts by severity level: critical, high, medium, and low" />
      </div>
      {severityConfig.map((s) => (
        <div
          key={s.key}
          className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full ${s.dot}`} />
            <p className={`text-xs uppercase tracking-wide ${s.color}`}>{s.label}</p>
          </div>
          <span className="text-2xl font-semibold text-gray-100">
            {counts ? counts[s.key] ?? 0 : "--"}
          </span>
        </div>
      ))}
    </div>
  );
}
