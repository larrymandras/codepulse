import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { alertRules, type AlertCategory } from "../../convex/alertRules";
import { useDisabledRules } from "../hooks/useAlertRules";

const CATEGORIES: { label: string; value: AlertCategory | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Standard", value: "standard" },
  { label: "Discovery", value: "discovery" },
  { label: "Infrastructure", value: "infrastructure" },
  { label: "LLM", value: "llm" },
  { label: "Security", value: "security" },
  { label: "Self-Healing", value: "self-healing" },
];

const severityColors: Record<string, string> = {
  critical: "text-red-400 bg-red-400/10 border-red-400/20",
  error: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  warning: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  info: "text-blue-400 bg-blue-400/10 border-blue-400/20",
};

export default function AlertRulesEngine() {
  const [category, setCategory] = useState<AlertCategory | "all">("all");
  const [search, setSearch] = useState("");
  const disabledRules = useDisabledRules();
  const toggleRule = useMutation(api.alertRulesConfig.toggleRule);
  const evaluate = useMutation(api.alerts.evaluate);
  const [evaluating, setEvaluating] = useState(false);

  const filtered = alertRules.filter((r) => {
    if (category !== "all" && r.category !== category) return false;
    if (search && !r.name.toLowerCase().includes(search.toLowerCase()) && !r.id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const enabledCount = alertRules.length - disabledRules.length;

  const handleEvaluate = async () => {
    setEvaluating(true);
    try {
      await evaluate();
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-300">Alert Rules Engine</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {enabledCount}/{alertRules.length} rules active
          </p>
        </div>
        <button
          onClick={handleEvaluate}
          disabled={evaluating}
          className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600/80 text-indigo-100 hover:bg-indigo-500/80 transition-colors disabled:opacity-50 border border-indigo-500/30"
        >
          {evaluating ? "Evaluating..." : "Evaluate Now"}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mb-3">
        <div className="flex items-center gap-1 bg-gray-900/50 border border-gray-700/30 rounded-lg p-0.5 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={`text-[11px] px-2 py-1 rounded-md transition-colors ${
                category === cat.value
                  ? "bg-gray-700 text-gray-100"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search rules..."
          className="text-xs bg-gray-900/50 border border-gray-700/30 rounded-lg px-2.5 py-1.5 text-gray-200 placeholder-gray-500 outline-none focus:border-gray-600 w-full sm:w-48"
        />
      </div>

      {/* Rules List */}
      <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
        {filtered.map((rule) => {
          const isDisabled = disabledRules.includes(rule.id);
          const sevClass = severityColors[rule.severity] ?? severityColors.info;

          return (
            <div
              key={rule.id}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                isDisabled ? "opacity-50 bg-gray-900/20" : "bg-gray-900/30 hover:bg-gray-900/50"
              }`}
            >
              {/* Toggle */}
              <button
                onClick={() => toggleRule({ ruleId: rule.id, enabled: isDisabled })}
                className={`w-8 h-4.5 rounded-full relative transition-colors shrink-0 ${
                  isDisabled ? "bg-gray-700" : "bg-indigo-600"
                }`}
                style={{ minHeight: "18px", minWidth: "32px" }}
              >
                <span
                  className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                    isDisabled ? "left-0.5" : "left-[15px]"
                  }`}
                />
              </button>

              {/* Severity badge */}
              <span
                className={`text-[10px] font-medium uppercase px-1.5 py-0.5 rounded border shrink-0 ${sevClass}`}
              >
                {rule.severity}
              </span>

              {/* Rule info */}
              <div className="flex-1 min-w-0">
                <span className="text-xs text-gray-200 font-medium">{rule.name}</span>
                <p className="text-[10px] text-gray-500 truncate">{rule.condition}</p>
              </div>

              {/* Category tag */}
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-400 border border-gray-600/30 shrink-0 hidden sm:inline">
                {rule.category}
              </span>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-4">No rules match your filter.</p>
        )}
      </div>
    </div>
  );
}
