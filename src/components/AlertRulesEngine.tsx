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
  critical: "text-red-400 bg-red-400/10 border-red-400/30 shadow-[0_0_10px_rgba(248,113,113,0.2)]",
  error: "text-orange-400 bg-orange-400/10 border-orange-400/30 shadow-[0_0_10px_rgba(251,146,60,0.2)]",
  warning: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30 shadow-[0_0_10px_rgba(250,204,21,0.2)]",
  info: "text-blue-400 bg-blue-400/10 border-blue-400/30 shadow-[0_0_10px_rgba(96,165,250,0.2)]",
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
      className={`group relative flex items-center gap-4 px-5 py-4 border-b border-primary/10 transition-colors overflow-hidden ${
        isDisabled ? "opacity-40 bg-background/20" : "bg-background/40 hover:bg-primary/5 hover:border-primary/30"
      } ${isMuted ? "opacity-50" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Subtle hover scanline */}
      <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-10 transition-opacity duration-300">
        <div className="w-full h-[1px] animate-scanline bg-primary" />
      </div>

      {/* Toggle */}
      <button
        onClick={onToggle}
        className={`relative z-10 w-8 rounded-full transition-all shrink-0 border ${
          isDisabled ? "bg-background/50 border-muted-foreground/30" : "bg-primary/20 border-primary shadow-[0_0_8px_rgba(16,185,129,0.4)]"
        }`}
        style={{ minHeight: "16px", minWidth: "30px", height: "16px" }}
      >
        <span
          className={`absolute top-0.5 w-2.5 h-2.5 rounded-full transition-all ${
            isDisabled ? "left-0.5 bg-muted-foreground/50" : "left-[17px] bg-primary shadow-[0_0_5px_rgba(16,185,129,1)]"
          }`}
        />
      </button>

      {/* Severity badge */}
      <span className={`relative z-10 text-sm font-mono tracking-wider uppercase px-2.5 py-1 rounded-md flex-shrink-0 border font-bold ${sevClass}`}>
        {rule.severity}
      </span>

      {/* Rule info */}
      <div className="flex-1 min-w-0 relative z-10 flex flex-col pr-4 border-r border-primary/10">
        <span className="text-base text-white font-medium tracking-wide truncate">{rule.name}</span>
        <p className="text-sm text-muted-foreground truncate mt-0.5">{rule.condition}</p>
      </div>

      {/* Threshold override (shown on hover) */}
      <div className="flex items-center gap-2 relative z-10 shrink-0 w-32 justify-end">
        {hovered ? (
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
            className="w-24 h-8 text-sm font-mono bg-background border-primary/30 focus-visible:ring-1 focus-visible:ring-primary/50"
            title="Threshold override"
            aria-label="Threshold override"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="text-sm px-2 py-1 rounded bg-primary/5 text-primary/70 border border-primary/20 hidden sm:inline font-mono tracking-wider uppercase">
            {rule.category}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 relative z-10 shrink-0">
        {/* Mute toggle */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              {isMuted ? (
                <button
                  className="p-1 rounded text-muted-foreground hover:bg-background/80 transition-colors"
                  onClick={handleUnmute}
                  aria-label="Unmute rule"
                >
                  <Clock className="w-3.5 h-3.5" />
                </button>
              ) : (
                <span>
                  <MuteDurationPicker
                    onSelect={handleMuteSelect}
                    trigger={
                      <button
                        className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        aria-label="Mute rule"
                      >
                        <Clock className="w-3.5 h-3.5" />
                      </button>
                    }
                  />
                </span>
              )}
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs font-mono">{isMuted ? "UNMUTE RULE" : "MUTE RULE"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Edit button */}
        <button
          className="text-sm font-medium uppercase tracking-wider text-primary/80 border border-primary/20 bg-primary/5 hover:bg-primary/20 hover:text-primary rounded-md px-4 py-1.5 transition-all shadow-sm"
          onClick={onEdit}
        >
          Edit
        </button>
      </div>
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
      className={`group relative flex items-center gap-4 px-5 py-4 border-b border-primary/10 bg-background/40 hover:bg-primary/5 hover:border-primary/30 transition-colors overflow-hidden ${
        isMuted || rule.enabled === false ? "opacity-50" : ""
      }`}
    >
      {/* Subtle hover scanline */}
      <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-10 transition-opacity duration-300">
        <div className="w-full h-[1px] animate-scanline bg-primary" />
      </div>

      <span className={`relative z-10 text-sm font-mono tracking-wider uppercase px-2.5 py-1 rounded-md flex-shrink-0 border font-bold ${sevClass}`}>
        {rule.severity}
      </span>
      <div className="flex-1 min-w-0 relative z-10 flex flex-col pr-4 border-r border-primary/10">
        <span className="text-base text-white font-medium tracking-wide truncate">{rule.name}</span>
        <p className="text-sm text-muted-foreground truncate mt-0.5">{rule.conditionLogic} conditions</p>
      </div>

      <div className="flex items-center gap-1 relative z-10 shrink-0">
        {/* Mute toggle */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              {isMuted ? (
                <button
                  className="p-1 rounded text-muted-foreground hover:bg-background/80 transition-colors"
                  onClick={() => void unmuteTarget({ targetType: "rule", targetId: rule._id })}
                  aria-label="Unmute rule"
                >
                  <Clock className="w-3.5 h-3.5" />
                </button>
              ) : (
                <span>
                  <MuteDurationPicker
                    onSelect={(duration) =>
                      void muteTarget({ targetType: "rule", targetId: rule._id, duration, mutedBy: "operator" })
                    }
                    trigger={
                      <button className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" aria-label="Mute rule">
                        <Clock className="w-3.5 h-3.5" />
                      </button>
                    }
                  />
                </span>
              )}
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-sm font-mono">{isMuted ? "UNMUTE RULE" : "MUTE RULE"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <button 
          className="text-sm font-medium uppercase tracking-wider text-primary/80 border border-primary/20 bg-primary/5 hover:bg-primary/20 hover:text-primary rounded-md px-4 py-1.5 transition-all shadow-sm" 
          onClick={onEdit}
        >
          Edit
        </button>
      </div>
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
      <div className="bg-background/40 border border-primary/20 rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-primary/20 bg-primary/5 flex-wrap gap-4">
          <div>
            <h2 className="text-lg font-bold tracking-wide text-white flex items-center gap-3">
              Alert Rules Engine
              <span className="text-sm px-2 py-1 rounded-md border text-primary border-primary/50 bg-primary/10 font-mono">
                {enabledCount}/{alertRules.length} rules active
              </span>
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={openNewCustomRule}
              className="text-sm font-medium uppercase tracking-wider text-primary border border-primary/30 bg-primary/10 hover:bg-primary/20 hover:text-primary rounded-md px-4 py-2 transition-all shadow-sm"
            >
              + New Custom Rule
            </button>
            <button
              onClick={handleEvaluate}
              disabled={evaluating}
              className="text-sm font-medium uppercase tracking-wider text-primary-foreground border border-primary/30 bg-primary hover:bg-primary/80 hover:border-primary rounded-md px-5 py-2 transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
            >
              {evaluating ? "EVALUATING..." : "EVALUATE NOW"}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 bg-background/50 border-b border-primary/10">
          <div className="flex items-center gap-1 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={`text-sm font-medium tracking-wider uppercase px-4 py-2 rounded-md transition-all border ${
                  category === cat.value
                    ? "bg-primary/20 border-primary text-primary shadow-[inset_0_0_10px_rgba(16,185,129,0.2)]"
                    : "bg-transparent border-transparent text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/5"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Rules..."
              className="text-base bg-background/50 border border-primary/30 rounded-md px-4 py-2 text-white placeholder-muted-foreground/50 outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 w-full transition-all"
            />
          </div>
        </div>

        {/* Static Rules List */}
        <div className="flex flex-col max-h-[500px] overflow-y-auto bg-background/30 custom-scrollbar">
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
            <div className="text-center text-base tracking-wide text-muted-foreground py-12 bg-primary/5">
              No rules match current filters.
            </div>
          )}
        </div>

        {/* Custom Rules Section */}
        {customRules.length > 0 && (
          <div className="border-t border-primary/30 bg-background/50">
            <div className="px-4 py-2 border-b border-primary/10 bg-primary/5">
              <p className="text-xs font-mono tracking-widest text-primary uppercase font-bold">
                CUSTOM RULES
              </p>
            </div>
            <div className="flex flex-col bg-background/30">
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
