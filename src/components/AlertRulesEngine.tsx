import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { type Id } from "../../convex/_generated/dataModel";
import { alertRules, type AlertCategory } from "../../convex/alertRules";
import { useDisabledRules } from "../hooks/useAlertRules";
import { Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertRuleForm } from "./AlertRuleForm";
import { MuteDurationPicker } from "./MuteDurationPicker";

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

// ─── Per-static-rule row with threshold override input + mute toggle ──────────

function StaticRuleRow({
  rule,
  isDisabled,
  onToggle,
  onEdit,
}: {
  rule: (typeof alertRules)[number];
  isDisabled: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const [thresholdInput, setThresholdInput] = useState("");
  const [hovered, setHovered] = useState(false);
  const sevClass = severityColors[rule.severity] ?? severityColors.info;

  const muteTarget = useMutation(api.alertMutes.muteTarget);
  const unmuteTarget = useMutation(api.alertMutes.unmuteTarget);
  const muteState = useQuery(api.alertMutes.isTargetMutedPublic, {
    targetType: "rule",
    targetId: rule.id,
  });
  const setThresholdOverride = useMutation(api.alertRuleCustom.setThresholdOverride);

  const isMuted = muteState ?? false;

  function handleThresholdCommit() {
    const val = parseFloat(thresholdInput);
    if (!isNaN(val)) {
      void setThresholdOverride({ ruleId: rule.id, threshold: val, lookbackWindow: "15m" });
    }
  }

  function handleMuteSelect(duration: string) {
    void muteTarget({ targetType: "rule", targetId: rule.id, duration, mutedBy: "operator" });
  }

  function handleUnmute() {
    void unmuteTarget({ targetType: "rule", targetId: rule.id });
  }

  return (
    <div
      className={`group flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
        isDisabled ? "opacity-50 bg-gray-900/20" : "bg-gray-900/30 hover:bg-gray-900/50"
      } ${isMuted ? "opacity-50" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Toggle */}
      <button
        onClick={onToggle}
        className={`w-8 rounded-full relative transition-colors shrink-0 ${
          isDisabled ? "bg-gray-700" : "bg-indigo-600"
        }`}
        style={{ minHeight: "18px", minWidth: "32px", height: "18px" }}
      >
        <span
          className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${
            isDisabled ? "left-0.5" : "left-[15px]"
          }`}
        />
      </button>

      {/* Severity badge */}
      <span className={`text-[10px] font-medium uppercase px-1.5 py-0.5 rounded border shrink-0 ${sevClass}`}>
        {rule.severity}
      </span>

      {/* Rule info */}
      <div className="flex-1 min-w-0">
        <span className="text-xs text-gray-200 font-medium">{rule.name}</span>
        <p className="text-[10px] text-gray-500 truncate">{rule.condition}</p>
      </div>

      {/* Threshold override (shown on hover) */}
      {hovered && (
        <Input
          type="number"
          min={0}
          step="any"
          value={thresholdInput}
          onChange={(e) => setThresholdInput(e.target.value)}
          onBlur={handleThresholdCommit}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleThresholdCommit();
          }}
          placeholder={String(rule.id)}
          className="w-24 h-7 text-xs"
          title="Threshold override"
          aria-label="Threshold override"
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {/* Mute toggle */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {isMuted ? (
              <Button
                variant="ghost"
                size="icon-sm"
                className="shrink-0"
                onClick={handleUnmute}
                aria-label="Unmute rule"
              >
                <Clock className="w-4 h-4 text-muted-foreground" />
              </Button>
            ) : (
              <span>
                <MuteDurationPicker
                  onSelect={handleMuteSelect}
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0"
                      aria-label="Mute rule"
                    >
                      <Clock className="w-4 h-4" />
                    </Button>
                  }
                />
              </span>
            )}
          </TooltipTrigger>
          <TooltipContent>
            <p>{isMuted ? "Unmute rule" : "Mute rule"}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Edit button */}
      <Button
        variant="ghost"
        size="sm"
        className="text-xs shrink-0"
        onClick={onEdit}
      >
        Edit
      </Button>

      {/* Category tag */}
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-400 border border-gray-600/30 shrink-0 hidden sm:inline">
        {rule.category}
      </span>
    </div>
  );
}

// ─── Custom rule row ──────────────────────────────────────────────────────────

function CustomRuleRow({
  rule,
  onEdit,
}: {
  rule: { _id: Id<"alertRuleCustom">; name: string; severity: string; enabled?: boolean; conditionLogic: string };
  onEdit: () => void;
}) {
  const sevClass = severityColors[rule.severity] ?? severityColors.info;
  const muteTarget = useMutation(api.alertMutes.muteTarget);
  const unmuteTarget = useMutation(api.alertMutes.unmuteTarget);
  const muteState = useQuery(api.alertMutes.isTargetMutedPublic, {
    targetType: "rule",
    targetId: rule._id,
  });
  const isMuted = muteState ?? false;

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-900/30 hover:bg-gray-900/50 transition-colors ${
        isMuted ? "opacity-50" : ""
      } ${rule.enabled === false ? "opacity-50" : ""}`}
    >
      <span className={`text-[10px] font-medium uppercase px-1.5 py-0.5 rounded border shrink-0 ${sevClass}`}>
        {rule.severity}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-xs text-gray-200 font-medium">{rule.name}</span>
        <p className="text-[10px] text-gray-500 truncate">{rule.conditionLogic} conditions</p>
      </div>

      {/* Mute toggle */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {isMuted ? (
              <Button
                variant="ghost"
                size="icon-sm"
                className="shrink-0"
                onClick={() => void unmuteTarget({ targetType: "rule", targetId: rule._id })}
                aria-label="Unmute rule"
              >
                <Clock className="w-4 h-4 text-muted-foreground" />
              </Button>
            ) : (
              <span>
                <MuteDurationPicker
                  onSelect={(duration) =>
                    void muteTarget({ targetType: "rule", targetId: rule._id, duration, mutedBy: "operator" })
                  }
                  trigger={
                    <Button variant="ghost" size="icon-sm" className="shrink-0" aria-label="Mute rule">
                      <Clock className="w-4 h-4" />
                    </Button>
                  }
                />
              </span>
            )}
          </TooltipTrigger>
          <TooltipContent>
            <p>{isMuted ? "Unmute rule" : "Mute rule"}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Button variant="ghost" size="sm" className="text-xs shrink-0" onClick={onEdit}>
        Edit
      </Button>
    </div>
  );
}

// ─── AlertRulesEngine ─────────────────────────────────────────────────────────

export default function AlertRulesEngine() {
  const [category, setCategory] = useState<AlertCategory | "all">("all");
  const [search, setSearch] = useState("");
  const disabledRules = useDisabledRules();
  const toggleRule = useMutation(api.alertRulesConfig.toggleRule);
  const evaluate = useMutation(api.alerts.evaluate);
  const [evaluating, setEvaluating] = useState(false);

  // AlertRuleForm state
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"override" | "custom">("override");
  const [editRuleId, setEditRuleId] = useState<string | undefined>();
  const [editCustomRuleId, setEditCustomRuleId] = useState<Id<"alertRuleCustom"> | undefined>();

  // Custom rules list
  const customRules = useQuery(api.alertRuleCustom.list, {}) ?? [];

  const filtered = alertRules.filter((r) => {
    if (category !== "all" && r.category !== category) return false;
    if (
      search &&
      !r.name.toLowerCase().includes(search.toLowerCase()) &&
      !r.id.toLowerCase().includes(search.toLowerCase())
    )
      return false;
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

  function openNewCustomRule() {
    setFormMode("custom");
    setEditRuleId(undefined);
    setEditCustomRuleId(undefined);
    setFormOpen(true);
  }

  function openEditOverride(ruleId: string) {
    setFormMode("override");
    setEditRuleId(ruleId);
    setEditCustomRuleId(undefined);
    setFormOpen(true);
  }

  function openEditCustomRule(customRuleId: Id<"alertRuleCustom">) {
    setFormMode("custom");
    setEditRuleId(undefined);
    setEditCustomRuleId(customRuleId);
    setFormOpen(true);
  }

  return (
    <>
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-300">Alert Rules Engine</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {enabledCount}/{alertRules.length} rules active
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="text-sm"
              onClick={openNewCustomRule}
            >
              + New Custom Rule
            </Button>
            <button
              onClick={handleEvaluate}
              disabled={evaluating}
              className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600/80 text-indigo-100 hover:bg-indigo-500/80 transition-colors disabled:opacity-50 border border-indigo-500/30"
            >
              {evaluating ? "Evaluating..." : "Evaluate Now"}
            </button>
          </div>
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

        {/* Static Rules List */}
        <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
          {filtered.map((rule) => {
            const isDisabled = disabledRules.includes(rule.id);
            return (
              <StaticRuleRow
                key={rule.id}
                rule={rule}
                isDisabled={isDisabled}
                onToggle={() => toggleRule({ ruleId: rule.id, enabled: isDisabled })}
                onEdit={() => openEditOverride(rule.id)}
              />
            );
          })}
          {filtered.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-4">No rules match your filter.</p>
          )}
        </div>

        {/* Custom Rules Section */}
        {customRules.length > 0 && (
          <div className="mt-4">
            <p className="text-[11px] tracking-wide text-muted-foreground uppercase mb-2">
              CUSTOM RULES
            </p>
            <div className="space-y-1">
              {customRules.map((rule: any) => (
                <CustomRuleRow
                  key={rule._id}
                  rule={rule}
                  onEdit={() => openEditCustomRule(rule._id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AlertRuleForm Sheet */}
      <AlertRuleForm
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        ruleId={editRuleId}
        customRuleId={editCustomRuleId}
      />
    </>
  );
}
