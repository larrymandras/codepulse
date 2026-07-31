/**
 * ModelPricingAdmin — Settings surface for the modelPricing rate table.
 *
 * D-02: an operator can add, edit and remove a model rate here without
 * touching code or running a Convex deploy. D-03: the "Unpriced models"
 * section reads the exact same `costDerived.unpricedModels` query the
 * Analytics nudge (plan 104-09) reads, so the two surfaces can never
 * disagree about which models need a rate.
 *
 * Rates are stored PER TOKEN in Convex but displayed PER MTOK (the number an
 * operator actually thinks in, e.g. "$3/Mtok"). `mtokToPerToken` /
 * `perTokenToMtok` are the single named conversion helper used in both
 * directions — T-104-30's mitigation for the 1e6 mis-pricing vector.
 *
 * Mirrors AlertRuleForm.tsx's Sheet-based CRUD pattern: dirty tracking,
 * toast.success/toast.error feedback, a delete-confirm Dialog.
 */

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { convexErrorMessage } from "@/lib/convexError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Pencil, Trash2, Plus } from "lucide-react";
import { useModelPricing } from "@/hooks/useModelPricing";
import { GATEWAY_PROVIDERS, PROVIDER_DISPLAY_NAMES } from "@/lib/providers";
import type { PricingRow } from "../../convex/modelPricing";

// ============================================================
// Per-Mtok <-> per-token conversion — ONE named helper each direction.
// A duplicated 1_000_000 literal elsewhere is the mis-pricing vector this
// guards against (T-104-30).
// ============================================================
const PER_MTOK = 1_000_000;

function perTokenToMtok(perToken: number): number {
  return perToken * PER_MTOK;
}

function mtokToPerToken(perMtok: number): number {
  return perMtok / PER_MTOK;
}

type UnpricedModel = {
  provider: string;
  model: string;
  billingType: string;
  promptTokens: number;
  completionTokens: number;
};

const NONE_SHADOW = "__none__";

export default function ModelPricingAdmin() {
  const rates = useModelPricing();
  const unpricedResult = useQuery(api.costDerived.unpricedModels, { lookbackHours: 24 }) as
    | { count: number; models: UnpricedModel[] }
    | undefined;
  const unpriced = unpricedResult ?? { count: 0, models: [] };

  const createRate = useMutation(api.modelPricing.create);
  const updateRate = useMutation(api.modelPricing.update);
  const removeRate = useMutation(api.modelPricing.remove);

  // ─── Sheet state ────────────────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"modelPricing"> | undefined>(undefined);
  const [model, setModel] = useState("");
  const [inputMtok, setInputMtok] = useState("");
  const [outputMtok, setOutputMtok] = useState("");
  const [shadowForProvider, setShadowForProvider] = useState<string>(NONE_SHADOW);
  const [notes, setNotes] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // ─── Delete confirm state ───────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<PricingRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  function markDirty() {
    if (!dirty) setDirty(true);
  }

  function openCreate(prefill?: { model?: string; shadowForProvider?: string }) {
    setEditingId(undefined);
    setModel(prefill?.model ?? "");
    setInputMtok("");
    setOutputMtok("");
    setShadowForProvider(prefill?.shadowForProvider ?? NONE_SHADOW);
    setNotes("");
    setDirty(false);
    setOpen(true);
  }

  function openEdit(row: PricingRow) {
    setEditingId(row._id);
    setModel(row.model);
    setInputMtok(String(perTokenToMtok(row.inputPerToken)));
    setOutputMtok(String(perTokenToMtok(row.outputPerToken)));
    setShadowForProvider(row.shadowForProvider ?? NONE_SHADOW);
    setNotes(row.notes ?? "");
    setDirty(false);
    setOpen(true);
  }

  async function handleSave() {
    const trimmedModel = model.trim();
    if (!editingId && trimmedModel.length === 0) {
      toast.error("Model id is required.");
      return;
    }
    const inputVal = parseFloat(inputMtok);
    const outputVal = parseFloat(outputMtok);
    if (isNaN(inputVal) || inputVal <= 0 || isNaN(outputVal) || outputVal <= 0) {
      toast.error("Enter a valid rate greater than 0.");
      return;
    }

    setSaving(true);
    try {
      const shadow = shadowForProvider === NONE_SHADOW ? undefined : shadowForProvider;
      if (editingId) {
        await updateRate({
          id: editingId,
          inputPerToken: mtokToPerToken(inputVal),
          outputPerToken: mtokToPerToken(outputVal),
          shadowForProvider: shadow,
          notes: notes.trim() || undefined,
        });
        toast.success("Pricing rate updated.");
      } else {
        await createRate({
          model: trimmedModel,
          inputPerToken: mtokToPerToken(inputVal),
          outputPerToken: mtokToPerToken(outputVal),
          shadowForProvider: shadow,
          notes: notes.trim() || undefined,
        });
        toast.success("Pricing rate created.");
      }
      setDirty(false);
      setOpen(false);
    } catch (err) {
      toast.error(convexErrorMessage(err, "Rate could not be saved. Check the values and try again."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await removeRate({ id: deleteTarget._id });
      toast.success("Pricing rate removed.");
      setDeleteTarget(null);
      setOpen(false);
    } catch (err) {
      toast.error(convexErrorMessage(err, "Failed to remove pricing rate."));
    } finally {
      setDeleting(false);
    }
  }

  const sortedRates = [...rates].sort((a, b) => a.model.localeCompare(b.model));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-normal uppercase tracking-wide text-muted-foreground">
          Model Pricing
        </h2>
        <Button onClick={() => openCreate()}>
          <Plus className="size-4" />
          Add pricing rate
        </Button>
      </div>

      {/* Unpriced models — same costDerived.unpricedModels query the Analytics nudge reads (D-03). */}
      {unpriced.count > 0 && (
        <div className="border border-border rounded-md p-3 space-y-2 bg-[color-mix(in_oklab,var(--status-warn)_8%,transparent)]">
          <p className="text-sm text-[--status-warn]">
            {unpriced.count} {unpriced.count === 1 ? "model needs" : "models need"} pricing rates
            — their cost isn't in the total above.
          </p>
          <ul className="space-y-1">
            {unpriced.models.map((m) => (
              <li key={`${m.provider}::${m.model}`} className="flex items-center justify-between text-sm">
                <span className="tabular-nums text-muted-foreground">
                  {m.model} <span className="text-muted-foreground/70">({m.provider})</span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    openCreate({
                      model: m.model,
                      shadowForProvider: m.billingType === "subscription" ? m.provider : undefined,
                    })
                  }
                >
                  Add rate
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sortedRates.length === 0 ? (
        <p className="text-sm text-[--status-error]">
          No pricing rates configured. Cost totals cannot be computed until at least one rate is
          entered.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                Model
              </TableHead>
              <TableHead className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                Input $/Mtok
              </TableHead>
              <TableHead className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                Output $/Mtok
              </TableHead>
              <TableHead className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                Shadow For
              </TableHead>
              <TableHead className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                Source
              </TableHead>
              <TableHead className="text-xs font-mono uppercase tracking-widest text-muted-foreground text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRates.map((row) => (
              <TableRow key={row._id}>
                <TableCell className="text-sm">{row.model}</TableCell>
                <TableCell className="text-sm tabular-nums">
                  {perTokenToMtok(row.inputPerToken)}
                </TableCell>
                <TableCell className="text-sm tabular-nums">
                  {perTokenToMtok(row.outputPerToken)}
                </TableCell>
                <TableCell className="text-sm">
                  {row.shadowForProvider ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge className="bg-[--info] text-background border-transparent">
                            Shadow
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-sm">
                            {`Not billed — priced at the ${row.model} API rate to show what this would have cost without your subscription plan.`}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{row.source}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-11"
                      aria-label={`Edit pricing rate for ${row.model}`}
                      onClick={() => openEdit(row)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-11"
                      aria-label={`Remove pricing rate for ${row.model}`}
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
              <span>{editingId ? "Edit Pricing Rate" : "New Pricing Rate"}</span>
              {dirty && (
                <span className="text-muted-foreground text-lg" aria-label="Unsaved changes">
                  •
                </span>
              )}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label className="text-base font-medium">Model id</Label>
              <Input
                value={model}
                disabled={!!editingId}
                onChange={(e) => {
                  setModel(e.target.value);
                  markDirty();
                }}
                placeholder="e.g. claude-sonnet-5"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-base font-medium">Input $/Mtok</Label>
              <Input
                type="number"
                min={0}
                step="any"
                value={inputMtok}
                onChange={(e) => {
                  setInputMtok(e.target.value);
                  markDirty();
                }}
                placeholder="e.g. 3"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-base font-medium">Output $/Mtok</Label>
              <Input
                type="number"
                min={0}
                step="any"
                value={outputMtok}
                onChange={(e) => {
                  setOutputMtok(e.target.value);
                  markDirty();
                }}
                placeholder="e.g. 15"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-base font-medium">
                Shadow for provider{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Select
                value={shadowForProvider}
                onValueChange={(v) => {
                  setShadowForProvider(v);
                  markDirty();
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_SHADOW}>None</SelectItem>
                  {GATEWAY_PROVIDERS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PROVIDER_DISPLAY_NAMES[p] ?? p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-base font-medium">
                Notes <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  markDirty();
                }}
                placeholder="e.g. verify against current published rate card"
              />
            </div>
          </div>

          <SheetFooter className="flex flex-row items-center justify-between gap-2 border-t border-border pt-3">
            <div className="flex gap-2">
              <Button onClick={() => void handleSave()} disabled={saving}>
                {saving ? "Saving…" : "Save Rate"}
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
                  const row = rates.find((r) => r._id === editingId);
                  if (row) setDeleteTarget(row);
                }}
              >
                Remove
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{`Remove pricing rate for ${deleteTarget?.model}?`}</DialogTitle>
          </DialogHeader>
          <p className="text-base text-muted-foreground">
            Dollars are recomputed from this table on every read (D-04), so removing this rate
            also re-prices history: past buckets for this model become Unpriced, and their tokens
            drop out of every cost total until a new rate is entered. Editing the rate instead
            re-prices history at the new value.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={deleting}>
              {deleting ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Re-export the pure conversion helpers so the round-trip guard is directly
// unit-testable without re-deriving the math in the test file.
export { perTokenToMtok, mtokToPerToken };
