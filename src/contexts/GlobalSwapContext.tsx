/**
 * GlobalSwapContext.tsx — 103-18-T1 (gap closure: WR-01, `103-REVIEW.md`, 2026-07-29).
 *
 * Hoists the global-swap modal ABOVE the router outlet so its mount lifetime is decoupled from
 * whichever `BrainPicker` host happened to request it. Before this plan, `GlobalSwapModal`'s
 * mount lifetime was owned by `BrainPicker.tsx`'s own `globalTarget` state (103-12/CR-03: only
 * ever replaced, never nulled on close, so the instance survives "Done" *within a single
 * BrainPicker*). That guarantee only held for the lifetime of the HOSTING `BrainPicker` — and
 * there are two hosts: `BrainHeaderBadge` (mounted in `DashboardLayout.tsx`, wraps every route,
 * survives navigation) and the Chat composer pill (`Chat.tsx`, page-scoped, unmounts on route
 * change). Starting a global swap from the Chat pill, clicking Done, navigating away from `/chat`,
 * then clicking "Revert global swap" in the still-visible sonner toast fired a real, process-wide
 * `swap.set` into a dead component instance with zero UI feedback — the exact defect WR-01
 * reports, a narrower reproduction of the symptom CR-03 already closed once.
 *
 * `GlobalSwapProvider` owns exactly what `BrainPicker` used to own for the global axis — the
 * target, its profile snapshot, the visibility flag, and 103-16's per-selection nonce — and
 * renders exactly ONE `GlobalSwapModal` instance for the whole app. 103-CONTRACT.md §8: a global
 * swap fires exactly one live command; hoisting must not create a second dispatch path or a second
 * modal — there is exactly one `<GlobalSwapModal>` element in this file, rendered unconditionally
 * once `target` is non-null, regardless of how many `BrainPicker` hosts are mounted. Mounted once
 * in `DashboardLayout`, above `<Outlet/>`, so it is never unmounted by a route change — the same
 * "app-level provider wraps the routed content" shape this codebase already uses for
 * `PrivacyProvider`/`AmbientProvider` (`src/main.tsx`), just scoped inside the router so it can sit
 * alongside `BrainHeaderBadge` in the header cluster instead of at the very root.
 *
 * `BrainPicker` no longer mounts or owns a `GlobalSwapModal` instance at all — it calls
 * `useGlobalSwap().openGlobalSwap(target, profiles)` from its global-scope `handleSelect` branch,
 * which is the exact point 103-16 already bumped the selection nonce. Both hosts drive the same
 * surviving instance through this one function; there is no second entry point.
 *
 * Preserves three invariants, each a separately-found, separately-fixed defect — re-breaking any
 * of them is a regression, not just this plan's own WR-01 fix:
 *   - 103-12/CR-03: mount lifetime is decoupled from visibility — the instance survives "Done".
 *     Trivially satisfied here: the instance now outlives every consumer that has ever requested
 *     a swap, not just the one that opened it last, so it also survives past "Done" a fortiori.
 *   - 103-16/CR-01: reset is keyed to a fresh SELECTION (`selectionNonce`), never to `open` alone.
 *     `openGlobalSwap` bumps the nonce unconditionally on every call, including a repeat request
 *     for the same target; `GlobalSwapModal.runRevert`'s own `onOpenChange(true)` call never calls
 *     `openGlobalSwap`, so a revert reopen can never bump it and can never trigger the modal's own
 *     reset effect (which still lives inside `GlobalSwapModal.tsx`, untouched by this plan).
 *   - 103-14: `runSwap` captures the prior global override at dispatch time; `runRevert` restores
 *     it with `{value: prior, restore: false}`. Entirely internal to `GlobalSwapModal.tsx`, which
 *     this plan does not modify — unaffected by where the modal is mounted.
 */

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { GlobalSwapModal, type GlobalSwapProfile } from "@/components/brains/GlobalSwapModal";
import type { CatalogueEntry } from "@/lib/brainsApi";

export interface GlobalSwapContextValue {
  /**
   * Requests a global swap confirmation for `target`, described by `profiles` (the calling
   * `BrainPicker`'s own `globalSwapProfiles` snapshot — the global axis' profile rows depend on
   * that specific picker's fetched catalogue and telemetry/config reads, so there is no shared,
   * caller-independent source for them; the caller supplies a fresh snapshot on every call).
   *
   * Bumps the shared selection nonce unconditionally (103-16/CR-01) — including a repeat
   * activation of the same catalogue entry — so the surviving `GlobalSwapModal` instance always
   * resets to a fresh confirm prompt, never the previous caller's stale result.
   */
  openGlobalSwap: (target: CatalogueEntry, profiles: GlobalSwapProfile[]) => void;
}

const GlobalSwapContext = createContext<GlobalSwapContextValue | null>(null);

export function GlobalSwapProvider({ children }: { children: ReactNode }) {
  // The MOUNT guard (103-12/CR-03, hoisted): only ever replaced by a new `openGlobalSwap` call,
  // never nulled on close — see `open` below for the separate visibility flag.
  const [target, setTarget] = useState<CatalogueEntry | null>(null);
  const [profiles, setProfiles] = useState<GlobalSwapProfile[]>([]);
  // VISIBILITY only — decoupled from `target`, mirroring 103-12/CR-03's original decoupling one
  // level up: closing the dialog (Cancel/Done) never nulls `target`, so this provider's single
  // `GlobalSwapModal` instance — and the `runRevert` closure inside it — outlives every consumer
  // that has ever requested a swap, not just the one that opened it last.
  const [open, setOpen] = useState(false);
  // 103-16/CR-01, hoisted: bumped on every `openGlobalSwap` call, including a repeat request for
  // the same target. A revert's own `onOpenChange(true)` (inside `GlobalSwapModal`) never calls
  // `openGlobalSwap`, so it can never bump this — the same asymmetry `BrainPicker` relied on before
  // this plan, now owned once at the provider level instead of duplicated per-picker.
  const [selectionNonce, setSelectionNonce] = useState(0);

  const openGlobalSwap = useCallback(
    (nextTarget: CatalogueEntry, nextProfiles: GlobalSwapProfile[]) => {
      setTarget(nextTarget);
      setProfiles(nextProfiles);
      setOpen(true);
      setSelectionNonce((n) => n + 1);
    },
    []
  );

  return (
    <GlobalSwapContext.Provider value={{ openGlobalSwap }}>
      {children}
      {target && (
        <GlobalSwapModal
          target={target}
          profiles={profiles}
          open={open}
          onOpenChange={setOpen}
          selectionNonce={selectionNonce}
        />
      )}
    </GlobalSwapContext.Provider>
  );
}

export function useGlobalSwap(): GlobalSwapContextValue {
  const ctx = useContext(GlobalSwapContext);
  if (!ctx) {
    throw new Error("useGlobalSwap must be used within a GlobalSwapProvider");
  }
  return ctx;
}
