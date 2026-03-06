import { useNavigate } from "react-router-dom";
import { useAlertCounts } from "../hooks/useAlerts";

export default function AlertBanner() {
  const counts = useAlertCounts();
  const navigate = useNavigate();
  const urgentCount = counts.critical + counts.error;

  if (urgentCount === 0) return null;

  return (
    <button
      onClick={() => navigate("/alerts")}
      className="w-full flex items-center gap-3 px-4 py-2.5 mb-4 rounded-xl border transition-colors cursor-pointer bg-red-500/10 border-red-500/30 hover:bg-red-500/20"
    >
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${counts.critical > 0 ? "bg-red-500" : "bg-orange-500"}`} />
      </span>
      <span className="text-sm font-medium text-gray-200">
        {urgentCount} active {urgentCount === 1 ? "alert" : "alerts"}
        {counts.critical > 0 && (
          <span className="text-red-400 ml-1">
            ({counts.critical} critical)
          </span>
        )}
        {counts.error > 0 && (
          <span className="text-orange-400 ml-1">
            ({counts.error} {counts.error === 1 ? "error" : "errors"})
          </span>
        )}
      </span>
      <span className="ml-auto text-xs text-gray-500">View all &rarr;</span>
    </button>
  );
}
