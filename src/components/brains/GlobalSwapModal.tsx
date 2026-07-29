/**
 * GlobalSwapModal.tsx — 103-04-T1, rewritten 103-12-T1/T2 (gap closure: defect #5 + CR-03).
 *
 * The global-swap ritual: a confirmation modal that lists exactly what changes, transitions in
 * place into an honest result, and offers a snapshot-backed revert (D-09/D-10/D-11/D-12).
 *
 * Single-axis dispatch (103-CONTRACT.md §8): "All profiles" scope fires exactly ONE live command
 * — the shipped `swap.set` runtime override (Ástríðr Phase 185/186) — and reports THAT command's
 * outcome. The pre-103-12 version ALSO fanned out N deferred per-profile "set the gateway model"
 * commands (the astridr-Phase-184.1 axis, not yet built) and reported THEIR guaranteed
 * union-tag-invalid failures as the global swap's own result while discarding the real `swap.set`
 * ack via a swallowed-error dispatch — see 103-12-PLAN.md's `<planner_reconciliation>` for the full
 * reasoning trail (D-12 applied correctly to a one-command axis has one outcome, not N; D-11's
 * confirm copy amended from the overwrite verb to a shadowing one, since nothing writes
 * `profileConfigs.modelPreferences` once the fan-out is gone — 103-CONTRACT.md §9).
 *
 * D-14/D-15: an ack means ACCEPTED, never SWITCHED. Success is rendered only once
 * `useGlobalBrainOverride()`'s server-pushed `swap.state` readback confirms the resulting model —
 * a bounded fallback (`GLOBAL_SWAP_CONFIRM_TIMEOUT_MS`) states "accepted, unconfirmed" rather than
 * hanging or inventing a success claim if the push never arrives.
 *
 * The confirm state's row list IS the friction (D-09) — there is no type-to-confirm input. The
 * same Dialog shell transitions in place from confirm to result rather than closing. A client-held
 * snapshot (model AND pin status, D-11) taken before dispatch backs the "Revert global swap" toast
 * action (D-10). CR-03: `BrainPicker` keeps this modal instance mounted independently of its own
 * visibility (a separate `globalDialogOpen` boolean, not the `globalTarget` mount guard), so a
 * revert triggered from the summary toast — which can fire well after "Done" — has a live
 * component instance to render into instead of firing a real command into an unmounted fiber.
 *
 * 103-16 (CR-01): the reset effect below is keyed to `selectionNonce`, a value `BrainPicker`
 * increments in the SAME handler that turns a global-scope activation into a modal open
 * (`handleSelect`) — every activation bumps it, including a repeat activation of the SAME
 * catalogue entry, because it is "did the user just make a selection," not "did the target id
 * change." A revert's own `onOpenChange(true)` call (`runRevert` below) never touches
 * `BrainPicker`'s state at all, so it can never bump this nonce — that asymmetry is what keeps a
 * revert reopen from wiping the snapshot/outcome it depends on (CR-03) while still giving a
 * same-brain reselection the fresh reset the old `target.id`-keyed guard denied it.
 *
 * 103-17 (gap closure, OBS 8): `pinnedCount`/the shadowing warning/the per-row `Pin` icon now read
 * `GlobalSwapProfile.hasConfiguredDefault` — a CONFIG signal (`profileConfigs.modelPreferences.primary`,
 * derived by `BrainPicker`) — instead of `mode === "pinned"`, which is a TELEMETRY signal
 * (`activeEngineSnapshots`, via `useActiveEngine`). Live checkpoint 2026-07-29 showed all three real
 * profiles reporting `mode: "inherited"` (zero telemetry rows) while each carried a configured
 * primary — the old `mode`-keyed count read 0 instead of 3. `mode` itself is UNCHANGED and still
 * drives nothing here but its own field; `currentModel`/`currentModelDisplayName` stay
 * telemetry-only too (D-14) — see `BrainPicker.tsx`'s `globalSwapProfiles` memo and
 * `useActiveEngine.ts`'s docstring for why config must never backfill the live column.
 */

import { useEffect, useRef, useState } from "react";
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
import { useGlobalBrainOverride } from "@/hooks/useResolvedBrain";
import type { CatalogueEntry } from "@/lib/brainsApi";

/** TELEMETRY-shaped — mirrors `ActiveEngine.mode` (`useActiveEngine.ts`) verbatim. Kept distinct
 * from `hasConfiguredDefault` (below) on purpose (103-17): this is "what the live engine reading
 * says," never "does this profile have a configured pin." Nothing in this file derives
 * `pinnedCount`/the shadowing warning from this field anymore. */
export type GlobalSwapProfileMode = "pinned" | "inherited" | "session";

export interface GlobalSwapProfile {
  profileId: string;
  displayName?: string;
  currentModel: string;
  currentModelDisplayName: string;
  mode: GlobalSwapProfileMode;
  /**
   * 103-17 (OBS 8 gap closure): whether this profile carries a CONFIGURED pinned default
   * (`profileConfigs.modelPreferences.primary`, non-empty) that a global override will shadow —
   * a CONFIG question, answered independently of `mode`/`currentModel` (both stay telemetry-only,
   * D-14). Drives `pinnedCount` and the shadowing warning below.
   */
  hasConfiguredDefault: boolean;
  /** The configured default's raw model id being shadowed, or `null` when `hasConfiguredDefault`
   * is false. Named separately from `currentModel` so a config value is never presented as a live
   * reading (D-14) — see `useActiveEngine.ts`'s docstring. */
  configuredDefault?: string | null;
  /** Display name for `configuredDefault`, resolved against the catalogue where possible and
   * falling back to the raw model id — lets the shadowing warning name WHAT is being shadowed, not
   * merely how many. */
  configuredDefaultDisplayName?: string | null;
}

export interface GlobalSwapModalProps {
  target: CatalogueEntry;
  profiles: GlobalSwapProfile[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * 103-16 (CR-01): a value `BrainPicker` increments on every global-scope activation —
   * including a repeat activation of the SAME catalogue entry. The reset effect below keys off a
   * CHANGE in this value, not `target.id` equality, so reselecting the same brain after a
   * completed-or-failed swap gets a fresh confirm prompt instead of the stale prior result. A
   * revert's own `onOpenChange(true)` call never touches this value, so a revert reopen is
   * unaffected (CR-03 stays closed).
   */
  selectionNonce: number;
}

interface SnapshotEntry {
  profileId: string;
  displayName: string;
  model: string;
  modelDisplayName: string;
  mode: GlobalSwapProfileMode;
  /** 103-17: carried into the snapshot so the result-phase row list's `Pin` icon reflects the same
   * config-derived signal the confirm phase used, not the (unchanged) telemetry `mode`. */
  hasConfiguredDefault: boolean;
}

/**
 * D-14/D-15 applied to the single-command global axis: an ack means ACCEPTED, never SWITCHED.
 * "confirming" resolves to "confirmed" only once the `swap.state` readback matches; "accepted" is
 * the bounded fallback when no readback arrives within `GLOBAL_SWAP_CONFIRM_TIMEOUT_MS` — it never
 * claims the switch/clear landed, only that the command was accepted for processing.
 */
type GlobalOutcome =
  | { status: "pending" }
  | { status: "confirming" }
  | { status: "confirmed" }
  | { status: "accepted" }
  | { status: "error"; reason: string };

type ModalPhase = "confirm" | "result";
type LastAction = "swap" | "revert";

/**
 * Bounded wait for the `swap.state` readback before falling back to an honest "accepted, not yet
 * confirmed" reading — long enough for a normal WS round trip, short enough that the dialog never
 * looks hung. Exported for direct test control.
 */
export const GLOBAL_SWAP_CONFIRM_TIMEOUT_MS = 4000;

/**
 * Bound on the DISPATCH itself, distinct from the readback bound above (UAT 2026-07-29,
 * 103-UAT.md test 16).
 *
 * `AstridrWSContext.sendCommand` queues a command when the socket is not OPEN and returns a promise
 * that is neither resolved nor rejected and carries no timeout of its own — so `await dispatch(...)`
 * can hang forever. Observed live: the dialog sat on "Switching to X…" indefinitely with `Done`
 * disabled, no Cancel, and `showCloseButton={false}`, leaving a page reload as the only escape while
 * showing in-flight progress for a command that never left the browser.
 *
 * Deliberately longer than `AstridrWSContext`'s own 10s `ACK_TIMEOUT_MS` so that, whenever the socket
 * IS open, the real ack timeout wins and reports its own reason — this bound only catches the
 * genuinely unbounded queued case. Bounded HERE rather than inside the shared `sendCommand` on
 * purpose: making that queue reject globally would convert silent hangs into unhandled rejections in
 * every other command panel that awaits it without a catch.
 */
export const GLOBAL_SWAP_DISPATCH_TIMEOUT_MS = 15000;

function profileLabel(p: { profileId: string; displayName?: string }): string {
  return p.displayName ?? p.profileId;
}

/**
 * 103-14-T2: `restoredTo` distinguishes the two things "Revert global swap" can now mean —
 * non-null names the prior engine being RESTORED, null means the override is being CLEARED (the
 * pre-103-14 behavior, still exercised whenever no global override was in force before the swap
 * being reverted). Ignored entirely for `action === "swap"`. The clear-case copy below is
 * byte-unchanged from pre-103-14 so that path stays identical.
 */
function describeOutcome(
  outcome: GlobalOutcome,
  action: LastAction,
  targetName: string,
  restoredTo: string | null
): string {
  switch (outcome.status) {
    case "pending":
      if (action !== "swap") {
        return restoredTo ? `Reverting to ${restoredTo}…` : "Reverting the global override…";
      }
      return `Switching to ${targetName}…`;
    case "confirming":
      if (action !== "swap") {
        return restoredTo
          ? `Accepted — confirming the revert to ${restoredTo}…`
          : "Accepted — confirming the global override was cleared…";
      }
      return `Accepted — confirming the switch to ${targetName}…`;
    case "confirmed":
      if (action !== "swap") {
        return restoredTo
          ? `Reverted to ${restoredTo}.`
          : "Global override cleared — profiles are back on their own defaults.";
      }
      return `Switched to ${targetName}.`;
    case "accepted":
      if (action !== "swap") {
        return restoredTo
          ? `Accepted — no confirmation received yet that the global override was restored to ${restoredTo}.`
          : "Accepted — no confirmation received yet that the global override was cleared.";
      }
      return `Accepted — no confirmation received yet. No profile is confirmed on ${targetName} yet.`;
    case "error":
      return action === "swap"
        ? `Failed — ${outcome.reason}. Every profile is still on its prior engine.`
        : `Revert failed — ${outcome.reason}. The global override may still be in force.`;
  }
}

export function GlobalSwapModal({
  target,
  profiles,
  open,
  onOpenChange,
  selectionNonce,
}: GlobalSwapModalProps) {
  const { dispatch } = useCommandDispatch();
  const { modelOverride } = useGlobalBrainOverride();

  /**
   * The single dispatch seam for both legs (UAT test 16). Guarantees a settled, shaped result no
   * matter how the underlying command fails: a rejection (ack timeout, queue full) becomes an
   * honest error, and a promise that never settles is bounded by
   * `GLOBAL_SWAP_DISPATCH_TIMEOUT_MS`. Without this, `await dispatch(...)` could hang forever and
   * every line after it — including `setIsBusy(false)` — would never run, disabling the dialog's
   * only exit control.
   */
  async function dispatchBounded(
    cmd: Record<string, unknown>
  ): Promise<{ status: "ok" | "error"; error?: string }> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        dispatch(cmd).then((ack) => ({ status: ack.status, error: ack.error })),
        new Promise<{ status: "error"; error: string }>((resolve) => {
          timer = setTimeout(
            () =>
              resolve({
                status: "error",
                error: "no response from Ástríðr — the command was never delivered",
              }),
            GLOBAL_SWAP_DISPATCH_TIMEOUT_MS
          );
        }),
      ]);
    } catch (err) {
      return {
        status: "error",
        error: err instanceof Error ? err.message : "the command could not be delivered",
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  const [phase, setPhase] = useState<ModalPhase>("confirm");
  const [snapshot, setSnapshot] = useState<SnapshotEntry[]>([]);
  const [outcome, setOutcome] = useState<GlobalOutcome>({ status: "pending" });
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [lastAction, setLastAction] = useState<LastAction>("swap");
  // 103-14-T2: display name for the prior override being restored by the CURRENT revert, or null
  // when the current/last revert is a plain clear. Distinct from `priorOverrideRef` (the raw model
  // id used for dispatch/confirmTarget) so describeOutcome can render a human-readable name.
  const [revertRestoredName, setRevertRestoredName] = useState<string | null>(null);

  const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 103-16/CR-01: the last `selectionNonce` this instance actually reset state for — NOT `open`
  // (would regress CR-03: a revert's own `onOpenChange(true)` also flips `open` false->true) and
  // NOT `target.id` (would regress CR-01: reselecting the SAME catalogue entry keeps the same id,
  // so that guard never re-fires and a fresh activation reopens showing the previous, unrelated
  // swap's result). `selectionNonce` changes on every activation `BrainPicker.handleSelect` turns
  // into a modal open, including a repeat of the same brain, and is untouched by `runRevert`'s own
  // `onOpenChange(true)` call below — that's what lets a revert reopen keep the snapshot/outcome it
  // needs while a same-brain reselection still gets a genuinely fresh reset.
  const prevSelectionNonceRef = useRef<number | null>(null);
  // 103-14-T1: the global override that was in force immediately BEFORE this swap's dispatch,
  // captured at dispatch time (not read live inside runRevert — by the time a revert fires,
  // `modelOverride` already holds the NEW engine, so a live read would revert to the engine being
  // reverted FROM, not the one that preceded it). Null means "no prior override" — revert must
  // still clear in that case, never invent a value to restore to.
  const priorOverrideRef = useRef<string | null>(null);
  // 103-14-T2: display name paired with `priorOverrideRef.current`, captured at the same dispatch
  // time. Prefers a catalogue-resolved display name (the pre-swap snapshot row that matches the
  // prior override's model id — every profile mirrors the global override's model while one is in
  // force, so the snapshot already carries a resolved name for it); falls back to the raw model id
  // rather than inventing a label or showing nothing.
  const priorOverrideDisplayNameRef = useRef<string | null>(null);

  function clearConfirmTimeout() {
    if (confirmTimeoutRef.current) {
      clearTimeout(confirmTimeoutRef.current);
      confirmTimeoutRef.current = null;
    }
  }

  function startConfirmTimeout() {
    clearConfirmTimeout();
    confirmTimeoutRef.current = setTimeout(() => {
      setOutcome((prev) => (prev.status === "confirming" ? { status: "accepted" } : prev));
    }, GLOBAL_SWAP_CONFIRM_TIMEOUT_MS);
  }

  // 103-16/CR-01: reset only when a genuinely NEW selection arrives — never on every `open`
  // transition (would regress CR-03) and never keyed to `target.id` alone (would regress CR-01,
  // see prevSelectionNonceRef comment above). A revert reopen never changes `selectionNonce`, so
  // this effect does not fire for it — the snapshot/outcome a revert depends on survives exactly as
  // CR-03 requires.
  useEffect(() => {
    if (selectionNonce === prevSelectionNonceRef.current) return;
    prevSelectionNonceRef.current = selectionNonce;
    setPhase("confirm");
    setOutcome({ status: "pending" });
    setIsBusy(false);
    setLastAction("swap");
    setSnapshot([]);
    setRevertRestoredName(null);
    priorOverrideRef.current = null;
    priorOverrideDisplayNameRef.current = null;
    clearConfirmTimeout();
  }, [selectionNonce]);

  // D-14/D-15 readback: once the server-pushed swap.state matches the value we're waiting to
  // confirm (target.id for a swap, null for a revert-clear), the "confirming" outcome resolves to
  // "confirmed" — never before, and never from the ack alone.
  useEffect(() => {
    if (outcome.status !== "confirming") return;
    if (modelOverride === confirmTarget) {
      setOutcome({ status: "confirmed" });
      clearConfirmTimeout();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelOverride, outcome.status, confirmTarget]);

  useEffect(() => clearConfirmTimeout, []);

  // 103-17 (OBS 8): derived from the CONFIG signal, never `mode` (telemetry) — see this file's
  // top-of-file docstring addendum and `GlobalSwapProfile.hasConfiguredDefault`'s own doc.
  const pinnedProfiles = profiles.filter((p) => p.hasConfiguredDefault);
  const pinnedCount = pinnedProfiles.length;
  // De-duplicated, order-preserving list of the configured defaults actually being shadowed, so
  // the warning can name WHAT is being shadowed rather than just how many (103-17-PLAN.md).
  const shadowedDefaultNames = Array.from(
    new Set(
      pinnedProfiles.map(
        (p) => p.configuredDefaultDisplayName ?? p.configuredDefault ?? "its configured default"
      )
    )
  );
  const needsCostWarning = target.costTier === "expensive" || target.costTier === "unknown";

  async function runSwap() {
    const snap: SnapshotEntry[] = profiles.map((p) => ({
      profileId: p.profileId,
      displayName: profileLabel(p),
      model: p.currentModel,
      modelDisplayName: p.currentModelDisplayName,
      mode: p.mode,
      hasConfiguredDefault: p.hasConfiguredDefault,
    }));
    setSnapshot(snap);
    setOutcome({ status: "pending" });
    setConfirmTarget(target.id);
    setPhase("result");
    setLastAction("swap");
    setIsBusy(true);

    // 103-14-T1/T2: capture BEFORE dispatch — this is the value (and its display name) "Revert
    // global swap" must restore to. Captured here (not read live inside runRevert) so a revert
    // fired well after "Done" still reverts to the engine that preceded THIS swap, not whatever
    // modelOverride holds by then.
    priorOverrideRef.current = modelOverride;
    priorOverrideDisplayNameRef.current = modelOverride
      ? (snap.find((s) => s.model === modelOverride)?.modelDisplayName ?? modelOverride)
      : null;

    // The one live command this axis ever sends (103-CONTRACT.md §8) — awaited for real, its ack
    // is the sole source of the result surface, never discarded. Routed through dispatchBounded so
    // a hang or rejection still settles into an honest outcome (UAT test 16).
    try {
      const ack = await dispatchBounded({
        type: "swap.set",
        target: "brain",
        value: target.id,
        restore: false,
      });

      if (ack.status === "ok") {
        setOutcome({ status: "confirming" });
        startConfirmTimeout();
      } else {
        setOutcome({ status: "error", reason: ack.error ?? "Swap failed" });
      }
    } finally {
      // Always clears, so the dialog's only exit control can never be left disabled.
      setIsBusy(false);
    }
  }

  async function runRevert() {
    // 103-14-T1: restore-to-prior when a global override was in force before this swap; otherwise
    // preserve the pre-existing clear-override behavior. Astridr defines restore:true as "clear the
    // override, value ignored" (ws_commands.py:233) — restoring to a specific prior engine instead
    // means dispatching `value: prior, restore: false`, exactly as a fresh swap to that engine would.
    const prior = priorOverrideRef.current;
    setOutcome({ status: "pending" });
    setConfirmTarget(prior);
    setRevertRestoredName(prior ? priorOverrideDisplayNameRef.current : null);
    setPhase("result");
    setLastAction("revert");
    // Reopen (or keep open) BEFORE the dispatch — a real, state-mutating command must never fire
    // with no visible surface (CR-03).
    onOpenChange(true);
    setIsBusy(true);

    try {
      const ack = prior
        ? await dispatchBounded({
            type: "swap.set",
            target: "brain",
            value: prior,
            restore: false,
          })
        : await dispatchBounded({ type: "swap.set", target: "brain", restore: true });

      if (ack.status === "ok") {
        setOutcome({ status: "confirming" });
        startConfirmTimeout();
      } else {
        setOutcome({ status: "error", reason: ack.error ?? "Revert failed" });
      }
    } finally {
      setIsBusy(false);
    }
  }

  function handleDismiss() {
    if (lastAction === "swap") {
      if (outcome.status === "error") {
        toast(`Swap to ${target.name} failed — ${outcome.reason}.`);
      } else {
        const verb = outcome.status === "confirmed" ? "switched" : "accepted, unconfirmed";
        toast(`All profiles ${verb} to ${target.name}.`, {
          action: {
            label: "Revert global swap",
            onClick: () => {
              void runRevert();
            },
          },
        });
      }
    } else if (outcome.status === "error") {
      toast(`Revert failed — ${outcome.reason}.`);
    } else {
      toast(revertRestoredName ? `Reverted to ${revertRestoredName}.` : "Global override cleared.");
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
                  {pinnedCount === 1 ? "has" : "have"} a pinned default (
                  {shadowedDefaultNames.join(", ")}) that will be shadowed while this global
                  override is in force.
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
                    {p.hasConfiguredDefault && (
                      <Pin className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
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
                {lastAction === "swap"
                  ? `Swap all profiles to ${target.name}?`
                  : "Revert global swap"}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
                {outcome.status === "confirmed" && (
                  <Check className="h-4 w-4 shrink-0 text-(--status-ok)" aria-hidden="true" />
                )}
                {outcome.status === "error" && (
                  <X className="h-4 w-4 shrink-0 text-(--status-error)" aria-hidden="true" />
                )}
                {outcome.status === "accepted" && (
                  <AlertTriangle
                    className="h-4 w-4 shrink-0 text-(--status-warn)"
                    aria-hidden="true"
                  />
                )}
                {(outcome.status === "pending" || outcome.status === "confirming") && (
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full bg-(--status-info) animate-pulse"
                  />
                )}
                <span className="flex-1">
                  {describeOutcome(outcome, lastAction, target.name, revertRestoredName)}
                </span>
              </div>
              <div className="flex flex-col gap-1.5 rounded-md border border-border p-2">
                <p className="text-xs text-muted-foreground">
                  {lastAction === "swap"
                    ? "Profiles now governed by the global override:"
                    : revertRestoredName
                      ? "Profiles still governed by the global override:"
                      : "Profiles returning to their own defaults:"}
                </p>
                {snapshot.map((entry) => (
                  <div key={entry.profileId} className="flex items-center gap-2 text-sm">
                    {entry.hasConfiguredDefault && (
                      <Pin className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                    )}
                    <span className="flex-1">{entry.displayName}</span>
                  </div>
                ))}
              </div>
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
