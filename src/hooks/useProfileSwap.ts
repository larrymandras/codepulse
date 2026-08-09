/**
 * useProfileSwap.ts — Phase 109 Plan 06 (ENGINE-04, D-05).
 *
 * The per-profile mirror of `GlobalSwapModal.tsx`'s server-confirmed outcome machine
 * (`pending -> confirming -> confirmed`, with `accepted` as a bounded honest fallback and `error`
 * from the ack) — extracted into a hook because the per-profile axis has FOUR render surfaces
 * (`BrainPicker`'s own default trigger, `BrainHeaderBadge`, Chat's composer pill, Settings' per-
 * profile row) and no modal to hold component-local state in. Every one of those surfaces renders
 * the exact same five-state suffix (109-UI-SPEC.md §C) driven by ONE instance of this hook per
 * profile — this is the single implementation; no consumer may hold a second, competing copy of
 * this state (the exact failure mode `BrainPicker.tsx`'s pre-Plan-06 `pendingTarget` block was).
 *
 * D-05 substitution — the one thing that differs from the global axis, stated explicitly per
 * 109-CONTEXT.md/109-UI-SPEC.md's own instruction: the global axis confirms `confirming ->
 * confirmed` against `modelOverride` — the GLOBAL override slot from `swap.state`
 * (`GlobalSwapModal.tsx:451-458`). This hook confirms against `profileOverrides[profileId]` — the
 * PER-PROFILE override slot plan 109-01 added to the same `swap.state` push, exposed here via
 * `useProfileBrainOverrides()`. Both are the override slot, never a resolved `model_routing`
 * telemetry row: a scoped SET emits no telemetry row of its own — it only writes the override; the
 * row arrives on the profile's next real resolution, which for an idle profile may never come — so
 * a 4s timeout bounded against telemetry would nearly always fire "accepted, unconfirmed" and would
 * assert a resolution that never happened. The CONFIRMATION reads the override slot (this hook's
 * readback effect, below); the CURRENT-ENGINE DISPLAY — every consumer's base label, and this
 * hook's own error-toast naming of what the profile is "still on" — reads telemetry / the full
 * resolved chain instead. Both are honest; they answer different questions.
 *
 * Restore semantics (D-05): a scoped restore's readback is the ABSENCE of this profile's entry
 * from `profileOverrides`, mirroring `GlobalSwapModal.tsx:537`'s `setConfirmTarget(prior)`, where
 * `prior` can be `null` after a global restore. A restore is never confirmed by the entry being
 * present with a null-ish value — `coerceProfileOverrides` (`useResolvedBrain.ts`) guarantees the
 * map never contains such an entry; a profile with no override is simply absent from the map.
 *
 * Race protection (not spelled out in the plan's task text, added per Rule 2 — this is a real,
 * reachable state: the popover closes immediately on dispatch, so nothing stops the operator from
 * reopening it and picking a SECOND engine before the first dispatch's promise has even settled).
 * `epochRef` is bumped synchronously by every `swapTo`/`restore` call; the async dispatch
 * continuation checks it is still the current epoch before calling `setOutcome` — a stale,
 * late-resolving dispatch for an ABANDONED target can never clobber the state of a swap that
 * superseded it. `unmountedRef` guards the same continuation against calling `setOutcome` after
 * this hook's owning component has unmounted.
 *
 * Toasts fire from THIS hook, never from a consumer (109-UI-SPEC.md §C) — there is no modal
 * holding the "accepted" state visibly on screen for the operator to notice on their own, unlike
 * the global axis's dialog; the per-profile popover has already closed. Each toast fires at most
 * once per swap, guarded by refs that reset at the start of every `swapTo`/`restore` call — per
 * `describeOutcome`'s two toast-worthy transitions (§C's "accepted" and "confirmed" rows); no
 * toast fires for "pending"/"confirming" (both collapse to one silent suffix, per §C) or for
 * starting a new swap.
 *
 * NOT put in a component, and NOT left alongside a second, competing implementation (the plan's
 * own explicit instruction): `BrainPicker.tsx`'s pre-Plan-06 `pendingTarget` state, its D-14
 * success-toast effect, and its `dispatchBounded`/`PROFILE_SWAP_DISPATCH_TIMEOUT_MS` are all
 * deleted by plan Task 2 in favor of this hook.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useActiveEngine } from "@/hooks/useActiveEngine";
import { useCommandDispatch } from "@/hooks/useCommandDispatch";
import { useProfileBrainOverrides } from "@/hooks/useResolvedBrain";
import type { CatalogueEntry } from "@/lib/brainsApi";

/**
 * Copied verbatim (renamed per-instance) from `GlobalSwapModal.tsx`'s `GlobalOutcome`
 * (`:142-147`) per D-05 — the per-profile axis reuses this exact five-member vocabulary; no
 * second vocabulary is invented.
 */
export type ProfileSwapOutcome =
  | { status: "pending" }
  | { status: "confirming" }
  | { status: "confirmed" }
  | { status: "accepted" }
  | { status: "error"; reason: string };

/**
 * Bounded wait for the `swap.state` readback before falling back to an honest "accepted, not yet
 * confirmed" reading. Same value as `GLOBAL_SWAP_CONFIRM_TIMEOUT_MS` — the per-profile readback
 * rides the same `swap.state` push `_handle_swap_set` already fires unconditionally after every
 * dispatch (both scoped and global), so the global axis's bound remains viable here unchanged.
 * Exported for direct test control.
 */
export const PROFILE_SWAP_CONFIRM_TIMEOUT_MS = 4000;

/**
 * Bound on the dispatch itself, distinct from the readback bound above — mirrors
 * `GlobalSwapModal.tsx`'s `GLOBAL_SWAP_DISPATCH_TIMEOUT_MS` (T-109-08/T-109-17). Relocated here
 * from `BrainPicker.tsx` (where it was previously a local export of the same name/value) now that
 * this hook owns the dispatch. Exported for direct test control.
 */
export const PROFILE_SWAP_DISPATCH_TIMEOUT_MS = 15000;

export interface UseProfileSwapResult {
  outcome: ProfileSwapOutcome;
  /**
   * The catalogue entry a `swapTo()` is in flight for (or was most recently in flight for), or
   * `null` before any swap has ever started and during a `restore()` (which has no "new engine"
   * to name). Consumers must gate suffix rendering on BOTH `target` and `outcome.status` — this
   * hook's own initial `{status:"pending"}`/`target:null` pair is a genuine idle state, not an
   * in-flight one, exactly because `target` starts `null` and is set only inside `swapTo`.
   */
  target: CatalogueEntry | null;
  swapTo: (entry: CatalogueEntry) => void;
  restore: () => void;
}

type SwapActionKind = "set" | "restore";

export function useProfileSwap(profileId: string): UseProfileSwapResult {
  const { dispatch } = useCommandDispatch();
  const profileOverrides = useProfileBrainOverrides();
  // Telemetry-only, used exclusively to name the CURRENT engine in the error toast's "...is still
  // on {CurrentEngineDisplayName}" clause — never the confirm source (see this file's top
  // docstring on the D-05 substitution: confirmation reads the override, display reads telemetry).
  const activeEngines = useActiveEngine();
  const activeEngine = activeEngines[profileId] ?? null;

  const [outcome, setOutcome] = useState<ProfileSwapOutcome>({ status: "pending" });
  const [target, setTarget] = useState<CatalogueEntry | null>(null);

  const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionKindRef = useRef<SwapActionKind | null>(null);
  const confirmTargetRef = useRef<string | null>(null);
  const acceptedToastFiredRef = useRef(false);
  const confirmedToastFiredRef = useRef(false);
  const epochRef = useRef(0);
  const unmountedRef = useRef(false);

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
    }, PROFILE_SWAP_CONFIRM_TIMEOUT_MS);
  }

  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      clearConfirmTimeout();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * D-05 readback: once the server-pushed `swap.state`'s per-profile override slot matches what
   * we're waiting to confirm, "confirming" (or a previously-"accepted" late arrival, per §C's
   * persistence rule) resolves to "confirmed" — never before, and never from the ack alone
   * (T-109-14). A restore's readback is the ABSENCE of this profile's entry — never a
   * present-with-null-ish value, since the map never contains one.
   */
  useEffect(() => {
    if (outcome.status !== "confirming" && outcome.status !== "accepted") return;
    const entry = profileOverrides[profileId];
    const confirmed =
      actionKindRef.current === "restore"
        ? entry === undefined
        : entry?.model === confirmTargetRef.current;
    if (confirmed) {
      setOutcome({ status: "confirmed" });
      clearConfirmTimeout();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileOverrides, outcome.status, profileId]);

  // Fires exactly once per swap, at the moment the machine enters "accepted" — the popover has
  // already closed (the caller's handleOpenChange(false) fires immediately on dispatch), so this
  // is the operator's only notice that the swap landed as "accepted, unconfirmed" rather than
  // "confirmed" (109-UI-SPEC.md §C: "a silent suffix change... fails ENGINE-04's honest live
  // status requirement in practice").
  useEffect(() => {
    if (outcome.status !== "accepted" || acceptedToastFiredRef.current) return;
    acceptedToastFiredRef.current = true;
    const engineName = actionKindRef.current === "restore" ? "its own default" : target?.name;
    toast.warning(
      `No confirmation yet that ${profileId} switched to ${engineName ?? "the requested engine"} — it may still be in progress.`
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome.status]);

  // Fires exactly once per swap, on entering "confirmed" — whether that arrives directly from
  // "confirming" or as a late resolution out of "accepted" (both are the SAME success, per
  // §C's persistence rule: "resolves to confirmed exactly as if no timeout had occurred, including
  // firing the normal success toast").
  useEffect(() => {
    if (outcome.status !== "confirmed" || confirmedToastFiredRef.current) return;
    confirmedToastFiredRef.current = true;
    if (actionKindRef.current === "restore") {
      toast.success(`${profileId} restored to its own default engine.`);
    } else {
      toast.success(`${profileId} switched to ${target?.name ?? confirmTargetRef.current}.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome.status]);

  /**
   * Copied verbatim (renamed per-instance) from `GlobalSwapModal.tsx`'s `dispatchBounded`
   * (`:354-380`), built on `useCommandDispatch()`'s `dispatch` — guarantees a settled, shaped
   * result no matter how the underlying command fails: a rejection becomes an honest error, and a
   * promise that never settles is bounded by `PROFILE_SWAP_DISPATCH_TIMEOUT_MS`.
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
            PROFILE_SWAP_DISPATCH_TIMEOUT_MS
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

  const swapTo = useCallback(
    (entry: CatalogueEntry) => {
      // Starting a new swap resets to "pending" for the new target and clears any outstanding
      // timer, regardless of what state the machine was previously in.
      clearConfirmTimeout();
      acceptedToastFiredRef.current = false;
      confirmedToastFiredRef.current = false;
      actionKindRef.current = "set";
      confirmTargetRef.current = entry.id;
      const myEpoch = ++epochRef.current;
      setTarget(entry);
      setOutcome({ status: "pending" });

      void (async () => {
        const ack = await dispatchBounded({
          type: "swap.set",
          target: "brain",
          value: entry.id,
          restore: false,
          profile_id: profileId,
        });
        // A superseding swapTo/restore call (or an unmount) already moved the machine on — this
        // resolution is for an abandoned target and must never clobber the current state.
        if (unmountedRef.current || epochRef.current !== myEpoch) return;
        if (ack.status === "ok") {
          setOutcome({ status: "confirming" });
          startConfirmTimeout();
        } else {
          // D-05/T-109-14: the server pushed no swap.state on an error ack — there is nothing to
          // wait for, so this resolves immediately without ever entering "confirming".
          setOutcome({ status: "error", reason: ack.error ?? "Swap failed" });
          toast.error(
            `Couldn't switch to ${entry.name} — ${ack.error ?? "unknown error"}. ${profileId} is still on ${activeEngine?.model ?? "its current engine"}.`
          );
        }
      })();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profileId, activeEngine, dispatch]
  );

  const restore = useCallback(() => {
    clearConfirmTimeout();
    acceptedToastFiredRef.current = false;
    confirmedToastFiredRef.current = false;
    actionKindRef.current = "restore";
    confirmTargetRef.current = null;
    const myEpoch = ++epochRef.current;
    setTarget(null);
    setOutcome({ status: "pending" });

    void (async () => {
      const ack = await dispatchBounded({
        type: "swap.set",
        target: "brain",
        restore: true,
        profile_id: profileId,
      });
      if (unmountedRef.current || epochRef.current !== myEpoch) return;
      if (ack.status === "ok") {
        setOutcome({ status: "confirming" });
        startConfirmTimeout();
      } else {
        setOutcome({ status: "error", reason: ack.error ?? "Restore failed" });
        toast.error(
          `Couldn't restore ${profileId}'s own default engine — ${ack.error ?? "unknown error"}.`
        );
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, dispatch]);

  return { outcome, target, swapTo, restore };
}
