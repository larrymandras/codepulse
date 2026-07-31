/**
 * CostBudgetsAdmin — Settings surface for the costBudgets table.
 *
 * D-09: one generic table, four scopes (global/model/provider/quota) driven
 * from a single form. D-10: period is per-row (daily/weekly/monthly),
 * boundaries are UTC — stated in the UI, not just recorded in a comment.
 * D-11: exactly two firing points (warnFraction, default 0.8, and the limit
 * itself). D-07: the unit (dollars vs percent-of-quota) is derived from
 * scope — never a field the operator sets directly, matching the backend
 * (`convex/costBudgets.ts`'s `unitForScope`).
 *
 * D-16 GUARD: this form configures ALERTING only. No control here implies
 * Ástríðr's behavior will be throttled, capped, swapped, or otherwise
 * changed — a fixed disclaimer says so explicitly.
 *
 * Progress-bar decision (see 104-07-SUMMARY.md "Task 2"): every row shows
 * its configured threshold with a "progress shown on Analytics" label
 * rather than a computed percentage. `costDerived.costBreakdown` does not
 * give an exact per-budget-scope, per-budget-period figure without
 * client-side re-derivation, and `SDKSpendGuard`/`CostForecastPanel` are
 * not yet rewired onto `costBudgets` (that is plan 104-08's job) — sourcing
 * a bar from either today would risk this admin surface disagreeing with
 * the row it is displaying, which is exactly the failure D-12 exists to
 * prevent. An honest label beats a guessed bar.
 */

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { convexErrorMessage } from "@/lib/convexError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil, Trash2, Plus } from "lucide-react";
import { useCostBudgets } from "@/hooks/useCostBudgets";
import { formatCost } from "@/lib/formatters";
import { PROVIDER_DISPLAY_NAMES, GATEWAY_PROVIDERS } from "@/lib/providers";
import type { BudgetRow, BudgetScope, BudgetPeriod } from "../../convex/costBudgets";

const SCOPES: BudgetScope[] = ["global", "model", "provider", "quota"];
const PERIODS: BudgetPeriod[] = ["daily", "weekly", "monthly"];

const SCOPE_LABELS: Record<BudgetScope, string> = {
  global: "Global",
  model: "Model",
  provider: "Provider",
  quota: "Quota",
};

const PERIOD_LABELS: Record<BudgetPeriod, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

function rowScopeLabel(row: BudgetRow): string {
  if (row.scope === "global") return "Global";
  return `${SCOPE_LABELS[row.scope]} ${row.scopeKey}`;
}

function rowLimitLabel(row: BudgetRow): string {
  return row.unit === "quota_pct" ? `${row.limit}%` : formatCost(row.limit);
}

function formatThreshold(scope: BudgetScope, value: number): string {
  return scope === "quota" ? `${value}%` : formatCost(value);
}

export default function CostBudgetsAdmin() {
  const budgets = useCostBudgets();

  const createBudget = useMutation(api.costBudgets.create);
  const updateBudget = useMutation(api.costBudgets.update);
  const removeBudget = useMutation(api.costBudgets.remove);

  // ─── Sheet state ────────────────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"costBudgets"> | undefined>(undefined);
  const [scope, setScope] = useState<BudgetScope>("global");
  const [scopeKey, setScopeKey] = useState("");
  const [period, setPeriod] = useState<BudgetPeriod>("daily");
  const [limit, setLimit] = useState("");
  const [warnFraction, setWarnFraction] = useState("0.8");
  const [enabled, setEnabled] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // ─── Delete confirm state ───────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<BudgetRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  function markDirty() {
    if (!dirty) setDirty(true);
  }

  function openCreate() {
    setEditingId(undefined);
    setScope("global");
    setScopeKey("");
    setPeriod("daily");
    setLimit("");
    setWarnFraction("0.8");
    setEnabled(true);
    setDirty(false);
    setOpen(true);
  }

  function openEdit(row: BudgetRow) {
    setEditingId(row._id);
    setScope(row.scope);
    setScopeKey(row.scopeKey);
    setPeriod(row.period);
    setLimit(String(row.limit));
    setWarnFraction(String(row.warnFraction));
    setEnabled(row.enabled);
    setDirty(false);
    setOpen(true);
  }

  function handleScopeChange(v: string) {
    const nextScope = v as BudgetScope;
    setScope(nextScope);
    if (nextScope === "global") setScopeKey("");
    else setScopeKey("");
    markDirty();
  }

  async function handleSave() {
    const limitVal = parseFloat(limit);
    const warnVal = parseFloat(warnFraction);

    if (scope !== "global" && scopeKey.trim().length === 0) {
      toast.error(`A ${scope} scope requires a scope key.`);
      return;
    }
    if (isNaN(limitVal)) {
      toast.error("Enter a valid limit.");
      return;
    }
    if (scope === "quota") {
      if (!(limitVal > 0 && limitVal <= 100)) {
        toast.error("Limit must be greater than 0 and at most 100 for a quota budget.");
        return;
      }
    } else if (!(limitVal > 0 && limitVal < 1_000_000)) {
      toast.error("Limit must be greater than 0 and less than 1,000,000.");
      return;
    }
    if (isNaN(warnVal) || !(warnVal > 0 && warnVal < 1)) {
      toast.error("Warn fraction must be greater than 0 and less than 1.");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateBudget({
          id: editingId,
          limit: limitVal,
          warnFraction: warnVal,
          enabled,
        });
        toast.success("Budget threshold updated.");
      } else {
        await createBudget({
          scope,
          scopeKey: scope === "global" ? "" : scopeKey.trim(),
          period,
          limit: limitVal,
          warnFraction: warnVal,
          enabled,
        });
        toast.success("Budget threshold created.");
      }
      setDirty(false);
      setOpen(false);
    } catch (err) {
      toast.error(convexErrorMessage(err, "Budget could not be saved. Check the values and try again."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await removeBudget({ id: deleteTarget._id });
      toast.success("Budget threshold deleted.");
      setDeleteTarget(null);
      setOpen(false);
    } catch (err) {
      toast.error(convexErrorMessage(err, "Failed to delete budget threshold."));
    } finally {
      setDeleting(false);
    }
  }

  const limitValNum = parseFloat(limit);
  const warnValNum = parseFloat(warnFraction);
  const computedWarn = !isNaN(limitValNum) && !isNaN(warnValNum) ? limitValNum * warnValNum : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-normal uppercase tracking-wide text-muted-foreground">
          Budget Thresholds
        </h2>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Add budget threshold
        </Button>
      </div>

      {budgets.length === 0 ? (
        <div className="border border-border rounded-md p-4 space-y-2">
          <p className="text-base text-foreground">No budget thresholds set</p>
          <p className="text-sm text-muted-foreground">
            Set a daily, weekly, or monthly limit and CodePulse will alert you before spend gets
            away from you.
          </p>
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Add budget threshold
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                Scope
              </TableHead>
              <TableHead className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                Period
              </TableHead>
              <TableHead className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                Limit
              </TableHead>
              <TableHead className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                Status
              </TableHead>
              <TableHead className="text-xs font-mono uppercase tracking-widest text-muted-foreground text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {budgets.map((row) => (
              <TableRow key={row._id} className={row.enabled ? undefined : "opacity-50"}>
                <TableCell className="text-sm">{rowScopeLabel(row)}</TableCell>
                <TableCell className="text-sm">{PERIOD_LABELS[row.period]}</TableCell>
                <TableCell className="text-sm tabular-nums">{rowLimitLabel(row)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  Threshold set — progress shown on Analytics
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-11"
                      aria-label="Edit budget threshold"
                      onClick={() => openEdit(row)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-11"
                      aria-label="Delete budget threshold"
                      onClick={() => setDeleteTarget(row)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create/edit Sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[420px] flex flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <span>{editingId ? "Edit Budget Threshold" : "New Budget Threshold"}</span>
              {dirty && (
                <span className="text-muted-foreground text-lg" aria-label="Unsaved changes">
                  •
                </span>
              )}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label className="text-base font-medium">Scope</Label>
              <Select
                name="scope"
                value={scope}
                onValueChange={handleScopeChange}
                disabled={!!editingId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCOPES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SCOPE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editingId && (
                <p className="text-sm text-muted-foreground">
                  Scope and period can't be changed. Delete and recreate to change them.
                </p>
              )}
            </div>

            {scope !== "global" && (
              <div className="flex flex-col gap-1">
                <Label className="text-base font-medium">
                  {scope === "model" ? "Model id" : scope === "provider" ? "Provider" : "Quota provider"}
                </Label>
                {scope === "model" ? (
                  <Input
                    value={scopeKey}
                    disabled={!!editingId}
                    onChange={(e) => {
                      setScopeKey(e.target.value);
                      markDirty();
                    }}
                    placeholder="e.g. claude-opus-5"
                  />
                ) : (
                  <Select
                    name="scopeKey"
                    value={scopeKey}
                    onValueChange={(v) => {
                      setScopeKey(v);
                      markDirty();
                    }}
                    disabled={!!editingId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {(scope === "quota" ? GATEWAY_PROVIDERS : Object.keys(PROVIDER_DISPLAY_NAMES)).map(
                        (p) => (
                          <SelectItem key={p} value={p}>
                            {PROVIDER_DISPLAY_NAMES[p] ?? p}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1">
              <Label className="text-base font-medium">Period</Label>
              <Select
                name="period"
                value={period}
                onValueChange={(v) => {
                  setPeriod(v as BudgetPeriod);
                  markDirty();
                }}
                disabled={!!editingId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PERIOD_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">Periods reset at UTC midnight.</p>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-base font-medium">
                {scope === "quota" ? "Limit (% of quota)" : "Limit (USD)"}
              </Label>
              <Input
                type="number"
                min={0}
                step="any"
                value={limit}
                onChange={(e) => {
                  setLimit(e.target.value);
                  markDirty();
                }}
                placeholder={scope === "quota" ? "e.g. 90" : "e.g. 100"}
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-base font-medium">Warn fraction</Label>
              <Input
                type="number"
                min={0}
                max={1}
                step="any"
                value={warnFraction}
                onChange={(e) => {
                  setWarnFraction(e.target.value);
                  markDirty();
                }}
                placeholder="0.8"
              />
              <p className="text-sm text-muted-foreground">
                {`Warn at ${
                  computedWarn != null ? formatThreshold(scope, computedWarn) : "…"
                } — breach at ${!isNaN(limitValNum) ? formatThreshold(scope, limitValNum) : "…"}.`}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={enabled}
                onCheckedChange={(v) => {
                  setEnabled(v);
                  markDirty();
                }}
              />
              <Label className="text-base">Enabled</Label>
            </div>

            <p className="text-sm text-muted-foreground border-t border-border pt-3">
              Budgets raise alerts. They don't stop work.
            </p>
          </div>

          <SheetFooter className="flex flex-row items-center justify-between gap-2 border-t border-border pt-3">
            <div className="flex gap-2">
              <Button onClick={() => void handleSave()} disabled={saving}>
                {saving ? "Saving…" : "Save Threshold"}
              </Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
            {editingId && (
              <Button
                variant="link"
                className="text-destructive text-base p-0"
                onClick={() => {
                  const row = budgets.find((r) => r._id === editingId);
                  if (row) setDeleteTarget(row);
                }}
              >
                Delete
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this budget threshold?</DialogTitle>
          </DialogHeader>
          <p className="text-base text-muted-foreground">
            Alerts tied to this threshold stop firing immediately. This can't be undone.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
