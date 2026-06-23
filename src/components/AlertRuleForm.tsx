/**
 * AlertRuleForm — slide-out Sheet for editing alert rules.
 *
 * Two modes:
 *   "override" — threshold + lookback override for a static rule (ruleId)
 *   "custom"   — full custom rule CRUD (customRuleId for edit, undefined for create)
 *
 * Footer: Save Rule (primary) | Discard Changes (ghost) | Delete Rule (custom only)
 * Unsaved changes show a • indicator in the header.
 * Delete Rule shows a confirmation Dialog per UI-SPEC copy.
 *
 * Phase 06-05: ALR-04 rule form
 */

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { type Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
import {
  ConditionBuilder,
  type Condition,
  type ConditionGroup,
} from "./ConditionBuilder";

// ─── Props ────────────────────────────────────────────────────────────────────

interface AlertRuleFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ruleId?: string;
  customRuleId?: Id<"alertRuleCustom">;
  mode: "override" | "custom";
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_CONDITION: Condition = {
  metric: "error_rate",
  operator: "gt",
  threshold: 0,
  lookbackWindow: "15m",
};

const SEVERITY_OPTIONS = ["info", "warning", "error", "critical"] as const;

const severityColors: Record<string, string> = {
  critical: "text-red-400 bg-red-400/10 border-red-400/20",
  error: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  warning: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  info: "text-blue-400 bg-blue-400/10 border-blue-400/20",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function AlertRuleForm({
  open,
  onOpenChange,
  ruleId,
  customRuleId,
  mode,
}: AlertRuleFormProps) {
  // ─── Mutations ─────────────────────────────────────────────────────────────
  const setThresholdOverride = useMutation(
    api.alertRuleCustom.setThresholdOverride
  );
  const createCustomRule = useMutation(api.alertRuleCustom.create);
  const updateCustomRule = useMutation(api.alertRuleCustom.update);
  const removeCustomRule = useMutation(api.alertRuleCustom.remove);

  // ─── Existing override data (override mode) ────────────────────────────────
  const existingOverride = useQuery(
    api.alertRuleCustom.getThresholdOverride,
    ruleId ? { ruleId } : "skip"
  );

  // ─── Existing custom rule data (custom edit mode) ─────────────────────────
  const existingCustomRule = useQuery(
    api.alertRuleCustom.get,
    mode === "custom" && customRuleId ? { id: customRuleId } : "skip"
  );

  // ─── Form state ────────────────────────────────────────────────────────────
  const [ruleName, setRuleName] = useState("");
  const [severity, setSeverity] = useState<string>("warning");
  const [conditions, setConditions] = useState<Condition[]>([
    { ...DEFAULT_CONDITION },
  ]);
  const [conditionLogic, setConditionLogic] = useState<"AND" | "OR">("AND");
  const [conditionGroups, setConditionGroups] = useState<ConditionGroup[]>([]);
  const [messageTemplate, setMessageTemplate] = useState("");

  // Override mode fields
  const [overrideThreshold, setOverrideThreshold] = useState("");
  const [overrideLookback, setOverrideLookback] = useState("15m");

  // PagerDuty config (per D-08, D-13)
  const [pdEnabled, setPdEnabled] = useState(false);
  const [pdRoutingKey, setPdRoutingKey] = useState("");
  const [pdSeverity, setPdSeverity] = useState<string | undefined>(undefined);
  const [pdOpen, setPdOpen] = useState(false);

  // Dirty tracking
  const [dirty, setDirty] = useState(false);

  // Delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  // ─── Populate from existing override when opened ───────────────────────────
  useEffect(() => {
    if (!open) return;
    setDirty(false);
    if (mode === "override" && existingOverride) {
      setOverrideThreshold(String(existingOverride.threshold ?? ""));
      setOverrideLookback(existingOverride.lookbackWindow ?? "15m");
    }
    if (mode === "custom" && customRuleId && existingCustomRule) {
      setRuleName(existingCustomRule.name ?? "");
      setSeverity(existingCustomRule.severity ?? "warning");
      setConditions(existingCustomRule.conditions?.length ? existingCustomRule.conditions : [{ ...DEFAULT_CONDITION }]);
      setConditionLogic((existingCustomRule.conditionLogic as "AND" | "OR") ?? "AND");
      setConditionGroups((existingCustomRule.conditionGroups ?? []) as ConditionGroup[]);
      setMessageTemplate(existingCustomRule.messageTemplate ?? "");
      const pdConfig = existingCustomRule.pagerdutyConfig;
      setPdEnabled(pdConfig?.enabled ?? false);
      setPdRoutingKey(pdConfig?.routingKey ?? "");
      setPdSeverity((pdConfig as any)?.severityOverride ?? (pdConfig as any)?.severity);
      setPdOpen(pdConfig?.enabled ? true : false);
    } else if (mode === "custom" && !customRuleId) {
      setRuleName("");
      setSeverity("warning");
      setConditions([{ ...DEFAULT_CONDITION }]);
      setConditionLogic("AND");
      setConditionGroups([]);
      setMessageTemplate("");
      setPdEnabled(false);
      setPdRoutingKey("");
      setPdSeverity(undefined);
      setPdOpen(false);
    }
  }, [open, mode, existingOverride, customRuleId, existingCustomRule]);

  function markDirty() {
    if (!dirty) setDirty(true);
  }

  // ─── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    try {
      if (mode === "override" && ruleId) {
        const thresh = parseFloat(overrideThreshold);
        if (isNaN(thresh)) {
          toast.error("Enter a valid threshold number.");
          setSaving(false);
          return;
        }
        await setThresholdOverride({
          ruleId,
          threshold: thresh,
          lookbackWindow: overrideLookback,
        });
        toast.success("Threshold override saved.");
      } else if (mode === "custom") {
        if (!ruleName.trim()) {
          toast.error("Rule name is required.");
          setSaving(false);
          return;
        }
        if (pdEnabled && !pdRoutingKey.trim()) {
          toast.error("PagerDuty routing key is required when PagerDuty is enabled.");
          setSaving(false);
          return;
        }
        if (customRuleId) {
          await updateCustomRule({
            id: customRuleId,
            name: ruleName.trim(),
            severity,
            conditions,
            conditionLogic,
            conditionGroups: conditionGroups.length > 0 ? conditionGroups : undefined,
            messageTemplate: messageTemplate.trim() || undefined,
            pagerdutyConfig: pdEnabled
              ? {
                  enabled: true,
                  routingKey: pdRoutingKey.trim(),
                  severity: pdSeverity || undefined,
                }
              : undefined,
          });
          toast.success("Rule updated.");
        } else {
          await createCustomRule({
            name: ruleName.trim(),
            severity,
            conditions,
            conditionLogic,
            conditionGroups: conditionGroups.length > 0 ? conditionGroups : undefined,
            messageTemplate: messageTemplate.trim() || undefined,
            pagerdutyConfig: pdEnabled
              ? {
                  enabled: true,
                  routingKey: pdRoutingKey.trim(),
                  severity: pdSeverity || undefined,
                }
              : undefined,
          });
          toast.success("Custom rule created.");
        }
      }
      setDirty(false);
      onOpenChange(false);
    } catch {
      toast.error("Rule could not be saved. Check your condition values and try again.");
    } finally {
      setSaving(false);
    }
  }

  // ─── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!customRuleId) return;
    setDeleting(true);
    try {
      await removeCustomRule({ id: customRuleId });
      toast.success("Rule deleted.");
      setDeleteOpen(false);
      onOpenChange(false);
    } catch {
      toast.error("Failed to delete rule.");
    } finally {
      setDeleting(false);
    }
  }

  function handleDiscard() {
    setDirty(false);
    onOpenChange(false);
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[480px] flex flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {mode === "override" ? (
                <span className="text-base font-semibold">
                  {ruleId ?? "Rule Override"}
                </span>
              ) : (
                <span className="text-base font-semibold">
                  {customRuleId ? "Edit Rule" : "New Custom Rule"}
                </span>
              )}
              {dirty && (
                <span className="text-muted-foreground text-lg" aria-label="Unsaved changes">
                  •
                </span>
              )}
              {mode === "custom" && (
                <span
                  className={`text-sm font-medium px-1.5 py-0.5 rounded border ${severityColors[severity] ?? severityColors.info}`}
                >
                  {severity}
                </span>
              )}
            </SheetTitle>
          </SheetHeader>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-4">
            {mode === "override" && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-base font-medium">
                    Threshold override
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={overrideThreshold}
                    onChange={(e) => {
                      setOverrideThreshold(e.target.value);
                      markDirty();
                    }}
                    placeholder="Enter threshold value"
                    className="w-full"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-base font-medium">Lookback window</label>
                  <Select
                    value={overrideLookback}
                    onValueChange={(v) => {
                      setOverrideLookback(v);
                      markDirty();
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["5m", "15m", "30m", "1h", "24h"].map((w) => (
                        <SelectItem key={w} value={w}>
                          {w}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {mode === "custom" && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-base font-medium">Rule name</label>
                  <Input
                    value={ruleName}
                    onChange={(e) => {
                      setRuleName(e.target.value);
                      markDirty();
                    }}
                    placeholder="e.g. High memory usage spike"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-base font-medium">Severity</label>
                  <Select
                    value={severity}
                    onValueChange={(v) => {
                      setSeverity(v);
                      markDirty();
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SEVERITY_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-base font-medium">Conditions</label>
                  <ConditionBuilder
                    conditions={conditions}
                    conditionLogic={conditionLogic}
                    conditionGroups={conditionGroups}
                    onChange={(newConds, newLogic, newGroups) => {
                      setConditions(newConds);
                      setConditionLogic(newLogic);
                      setConditionGroups(newGroups);
                      markDirty();
                    }}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-base font-medium">
                    Message template{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </label>
                  <Textarea
                    value={messageTemplate}
                    onChange={(e) => {
                      setMessageTemplate(e.target.value);
                      markDirty();
                    }}
                    placeholder="Alert message template… (use {metric}, {threshold} as placeholders)"
                    rows={3}
                  />
                </div>

                {/* PagerDuty config (per D-08, D-13) */}
                <Collapsible open={pdOpen} onOpenChange={setPdOpen}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full border border-gray-700/50 p-3 text-base font-semibold hover:bg-gray-800/30">
                    <div className="flex items-center gap-2">
                      <ChevronRight
                        className={`w-4 h-4 transition-transform duration-150 ${pdOpen ? "rotate-90" : ""}`}
                      />
                      PagerDuty
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {pdEnabled
                        ? `On — ...${pdRoutingKey.slice(-4)}`
                        : "Off"}
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="border border-t-0 border-gray-700/50 p-3 space-y-3">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={pdEnabled}
                        onCheckedChange={(v) => {
                          setPdEnabled(v);
                          markDirty();
                        }}
                      />
                      <Label className="text-base">Send PagerDuty incident</Label>
                    </div>
                    {pdEnabled && (
                      <>
                        <div>
                          <Label className="text-base font-semibold">
                            Routing Key
                          </Label>
                          <Input
                            type="password"
                            className="font-mono mt-1"
                            placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                            value={pdRoutingKey}
                            onChange={(e) => {
                              setPdRoutingKey(e.target.value);
                              markDirty();
                            }}
                          />
                          <p className="text-sm text-muted-foreground mt-1">
                            Events API v2 routing key for this service. Stored
                            per rule.
                          </p>
                        </div>
                        <div>
                          <Label className="text-base font-semibold">
                            Severity override
                          </Label>
                          <Select
                            value={pdSeverity ?? "auto"}
                            onValueChange={(v) => {
                              setPdSeverity(v === "auto" ? undefined : v);
                              markDirty();
                            }}
                          >
                            <SelectTrigger className="w-[200px] mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="auto">
                                Auto (from rule severity)
                              </SelectItem>
                              <SelectItem value="critical">Critical</SelectItem>
                              <SelectItem value="warning">Warning</SelectItem>
                              <SelectItem value="info">Info</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-sm text-muted-foreground mt-1">
                            Auto-mapped from rule severity. Override only if
                            needed.
                          </p>
                        </div>
                      </>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </>
            )}
          </div>

          {/* Footer */}
          <SheetFooter className="flex flex-row items-center justify-between gap-2 border-t border-border pt-3">
            <div className="flex gap-2">
              <Button onClick={() => void handleSave()} disabled={saving}>
                {saving ? "Saving…" : "Save Rule"}
              </Button>
              <Button variant="ghost" onClick={handleDiscard}>
                Discard Changes
              </Button>
            </div>
            {mode === "custom" && customRuleId && (
              <Button
                variant="link"
                className="text-destructive text-base p-0"
                onClick={() => setDeleteOpen(true)}
              >
                Delete Rule
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this rule?</DialogTitle>
          </DialogHeader>
          <p className="text-base text-muted-foreground">
            This cannot be undone. Active alerts triggered by this rule will
            remain in the dashboard.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
