/**
 * GlobalSwapModal.tsx — 103-04-T1. The global-swap ritual: a confirmation modal that lists
 * exactly what changes, transitions in place into an honest per-profile result, and offers a
 * snapshot-backed revert (D-09/D-10/D-11/D-12).
 *
 * Two-axis dispatch (see 103-04-PLAN.md `<planner_reconciliation>`): a global swap fires BOTH
 *  1. the live, shipped `swap.set` runtime override (Ástríðr Phase 185/186) — never stubbed,
 *     never marked with the STUB indicator, and
 *  2. an N-command per-profile pinned-default fan-out through the D-16 `brainsApi` seam
 *     (`gateway.model.set`, `mode: "default"`), aggregated with `Promise.allSettled` so a
 *     partial failure yields an honest per-row result (D-12) with no all-or-nothing rollback.
 *
 * The confirm state's row list IS the friction (D-09) — there is no type-to-confirm input. The
 * same Dialog shell transitions in place from confirm to result rather than closing (D-12); a
 * failed row always keeps displaying the profile's real, unchanged engine, never the attempted
 * target. A client-held snapshot (model AND pin status, D-11) taken before dispatch backs the
 * "Revert global swap" toast action (D-10), which re-fires both axes to restore prior state.
 */

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Pin, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCommandDispatch } from "@/hooks/useCommandDispatch";
import {
  brainsApi,
  BRAINS_STUB_ACTIVE,
  type CatalogueEntry,
  type GatewayModelSetCommand,
} from "@/lib/brainsApi";

export type GlobalSwapProfileMode = "pinned" | "inherited" | "session";

export interface GlobalSwapProfile {
  profileId: string;
  displayName?: string;
  currentModel: string;
  currentModelDisplayName: string;
  mode: GlobalSwapProfileMode;
}

export interface GlobalSwapModalProps {
  target: CatalogueEntry;
  profiles: GlobalSwapProfile[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SnapshotEntry {
  profileId: string;
  displayName: string;
  model: string;
  modelDisplayName: string;
  mode: GlobalSwapProfileMode;
}

type RowResult =
  | { status: "pending" }
  | { status: "ok"; newModelDisplayName: string }
  | { status: "error"; reason: string };

type ModalPhase = "confirm" | "result";

function profileLabel(p: { profileId: string; displayName?: string }): string {
  return p.displayName ?? p.profileId;
}

function reasonFromOutcome(
  outcome: PromiseSettledResult<{ status: "ok" | "error"; error?: string }>,
  fallback: string
): string {
  if (outcome.status === "fulfilled") return outcome.value.error ?? fallback;
  return outcome.reason instanceof Error ? outcome.reason.message : fallback;
}

/**
 * A revert restores each snapshot entry's exact prior state, mode included (D-11) — a pinned
 * profile is restored via `mode: "default"`, a session-override profile via `mode: "session"`,
 * and an inherited (no override at all) profile is restored by CLEARING the pinned default the
 * fan-out set (`restore: true` — model ignored per 103-CONTRACT.md §2), never by re-pinning it.
 */
function buildRestoreCommand(entry: SnapshotEntry): GatewayModelSetCommand {
  if (entry.mode === "inherited") {
    return {
      type: "gateway.model.set",
      request_id: "",
      scope: "profile",
      profile_id: entry.profileId,
      mode: "default",
      restore: true,
    };
  }
  return {
    type: "gateway.model.set",
    request_id: "",
    scope: "profile",
    profile_id: entry.profileId,
    model: entry.model,
    mode: entry.mode === "pinned" ? "default" : "session",
    restore: false,
  };
}

export function GlobalSwapModal({ target, profiles, open, onOpenChange }: GlobalSwapModalProps) {
  const { dispatch } = useCommandDispatch();
  const [phase, setPhase] = useState<ModalPhase>("confirm");
  const [snapshot, setSnapshot] = useState<SnapshotEntry[]>([]);
  const [results, setResults] = useState<Record<string, RowResult>>({});
  const [liveDisplay, setLiveDisplay] = useState<Record<string, string>>({});
  const [isBusy, setIsBusy] = useState(false);
  const [lastAction, setLastAction] = useState<"swap" | "revert">("swap");

  useEffect(() => {
    if (open) {
      setPhase("confirm");
      setResults({});
      setIsBusy(false);
      setLastAction("swap");
      setLiveDisplay(
        Object.fromEntries(profiles.map((p) => [p.profileId, p.currentModelDisplayName]))
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pinnedCount = profiles.filter((p) => p.mode === "pinned").length;
  const needsCostWarning = target.costTier === "expensive" || target.costTier === "unknown";

  async function runSwap() {
    const snap: SnapshotEntry[] = profiles.map((p) => ({
      profileId: p.profileId,
      displayName: profileLabel(p),
      model: p.currentModel,
      modelDisplayName: p.currentModelDisplayName,
      mode: p.mode,
    }));
    setSnapshot(snap);

    const pending: Record<string, RowResult> = {};
    for (const p of profiles) pending[p.profileId] = { status: "pending" };
    setResults(pending);
    setPhase("result");
    setLastAction("swap");
    setIsBusy(true);

    // Effect 1: the live, shipped global runtime override — fired in parallel, never stubbed.
    dispatch({ type: "swap.set", target: "brain", value: target.id, restore: false }).catch(
      () => {}
    );

    // Effect 2: the per-profile pinned-default fan-out through the D-16 seam.
    const settled = await Promise.allSettled(
      profiles.map((p) =>
        brainsApi.dispatchSwap({
          type: "gateway.model.set",
          request_id: "",
          scope: "profile",
          profile_id: p.profileId,
          model: target.id,
          mode: "default",
        })
      )
    );

    const nextResults: Record<string, RowResult> = {};
    const nextLiveDisplay = { ...liveDisplay };
    settled.forEach((outcome, idx) => {
      const profileId = profiles[idx].profileId;
      if (outcome.status === "fulfilled" && outcome.value.status === "ok") {
        nextResults[profileId] = { status: "ok", newModelDisplayName: target.name };
        nextLiveDisplay[profileId] = target.name;
      } else {
        nextResults[profileId] = {
          status: "error",
          reason: reasonFromOutcome(outcome, "Swap failed"),
        };
      }
    });
    setResults(nextResults);
    setLiveDisplay(nextLiveDisplay);
    setIsBusy(false);
  }

  async function runRevert() {
    const pending: Record<string, RowResult> = {};
    for (const entry of snapshot) pending[entry.profileId] = { status: "pending" };
    setResults(pending);
    setPhase("result");
    setLastAction("revert");
    onOpenChange(true);
    setIsBusy(true);

    // Effect 1: restore the live global override via the shipped `restore: true` idiom.
    dispatch({ type: "swap.set", target: "brain", restore: true }).catch(() => {});

    // Effect 2: restore each profile's snapshot model AND mode through the D-16 seam.
    const settled = await Promise.allSettled(
      snapshot.map((entry) => brainsApi.dispatchSwap(buildRestoreCommand(entry)))
    );

    const nextResults: Record<string, RowResult> = {};
    const nextLiveDisplay = { ...liveDisplay };
    settled.forEach((outcome, idx) => {
      const entry = snapshot[idx];
      if (outcome.status === "fulfilled" && outcome.value.status === "ok") {
        nextResults[entry.profileId] = {
          status: "ok",
          newModelDisplayName: entry.modelDisplayName,
        };
        nextLiveDisplay[entry.profileId] = entry.modelDisplayName;
      } else {
        nextResults[entry.profileId] = {
          status: "error",
          reason: reasonFromOutcome(outcome, "Revert failed"),
        };
      }
    });
    setResults(nextResults);
    setLiveDisplay(nextLiveDisplay);
    setIsBusy(false);
  }

  function handleDismiss() {
    if (lastAction === "swap") {
      const total = profiles.length;
      const switched = Object.values(results).filter((r) => r.status === "ok").length;
      toast(`${switched} of ${total} profiles switched to ${target.name}.`, {
        action: {
          label: "Revert global swap",
          onClick: () => {
            void runRevert();
          },
        },
      });
    } else {
      const total = snapshot.length;
      const reverted = Object.values(results).filter((r) => r.status === "ok").length;
      toast(`${reverted} of ${total} profiles reverted.`);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl" showCloseButton={false}>
        {phase === "confirm" ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">
                Swap all profiles to {target.name}?
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              {pinnedCount > 0 && (
                <p className="flex items-center gap-1.5 text-sm text-(--status-warn)">
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {pinnedCount} profile{pinnedCount === 1 ? "" : "s"}{" "}
                  {pinnedCount === 1 ? "has" : "have"} a pinned default that will be overwritten.
                </p>
              )}
              {needsCostWarning && (
                <p className="flex items-center gap-1.5 text-sm text-(--status-warn)">
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  This model may be expensive per token — {profiles.length} profiles will be
                  switched to it.
                </p>
              )}
              <div className="flex flex-col gap-1.5 rounded-md border border-border p-2">
                {profiles.map((p) => (
                  <div key={p.profileId} className="flex items-center gap-2 text-sm">
                    <span className="flex-1">{profileLabel(p)}</span>
                    {p.mode === "pinned" && (
                      <Pin
                        className="h-3 w-3 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    )}
                    <span className="text-muted-foreground">{p.currentModelDisplayName}</span>
                    <span aria-hidden="true">→</span>
                    <span>{target.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void runSwap()}>
                Swap all profiles to {target.name}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">
                Swap all profiles to {target.name}?
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-1.5 rounded-md border border-border p-2">
              {snapshot.map((entry) => {
                const result: RowResult = results[entry.profileId] ?? { status: "pending" };
                const currentDisplay = liveDisplay[entry.profileId] ?? entry.modelDisplayName;
                return (
                  <div key={entry.profileId} className="flex items-center gap-2 text-sm">
                    {result.status === "ok" && (
                      <Check
                        className="h-3.5 w-3.5 shrink-0 text-(--status-ok)"
                        aria-hidden="true"
                      />
                    )}
                    {result.status === "error" && (
                      <X
                        className="h-3.5 w-3.5 shrink-0 text-(--status-error)"
                        aria-hidden="true"
                      />
                    )}
                    <span className="flex-1">
                      {result.status === "ok" &&
                        `${entry.displayName}: switched to ${result.newModelDisplayName}`}
                      {result.status === "error" &&
                        `${entry.displayName}: failed — ${result.reason} (still on ${currentDisplay})`}
                      {result.status === "pending" && `${entry.displayName}: switching…`}
                    </span>
                    {BRAINS_STUB_ACTIVE && (
                      <span className="rounded border border-dashed border-muted-foreground/40 px-1 text-xs text-muted-foreground">
                        STUB
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <DialogFooter>
              <Button type="button" onClick={handleDismiss} disabled={isBusy}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
