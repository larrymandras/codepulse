/**
 * useBrainCatalogue.ts — Phase 109 Plan 03 (D-01/D-02/D-03).
 *
 * The ONE `swap.catalogue` fetcher in the app. Before this hook existed, the per-profile axis read
 * a stub-fixture catalogue (`src/lib/brainsApi.ts`'s D-16 seam) while the global axis
 * (`BrainPicker.tsx`'s "All profiles" scope, `useResolvedBrain.ts`'s `useGlobalModelNames`) each
 * issued their own independent `{type:"swap.catalogue", target:"brain"}` round trip. D-02 collapses
 * that to a single source: the catalogue was never scope-dependent in the first place — only the
 * DISPATCH is (`swap.set` with an optional `profile_id`) — so every brain surface now reads this
 * hook instead of maintaining a second, structurally-unable-to-succeed fetch path.
 *
 * Modeled directly on `useResolvedBrain.ts`'s `useGlobalModelNames`/`useGlobalBrainOverride`: the
 * same try/catch degrade for a host with no `AstridrWSProvider` ancestor, the same "fetch once per
 * `connected` transition" effect shape, and the same "coerce a malformed field to an honest empty
 * value, never a fabricated reading" discipline.
 *
 * `target: "brain"` is REQUIRED on the wire — Ástríðr silently returns an empty map without it
 * (`useResolvedBrain.ts`'s pre-existing `useGlobalModelNames` comment, matches `BrainPicker.tsx`).
 *
 * D-03: the ack also carries `default_profile_id` (Ástríðr's own resolved chat-channel default,
 * `astridr/engine/bootstrap/wiring.py`, threaded through by 109-01) — the authoritative value the
 * header badge and Chat's composer pill address, replacing the deleted per-profile-adapter seam
 * and its Convex `profileConfigs`-ordering fallback (D-03's explicitly rejected option).
 */

import { useEffect, useRef, useState } from "react";
import { useAstridrWS } from "@/contexts/AstridrWSContext";

/** Raw entry shape `swap.catalogue` actually returns
 * (`ws_commands.py::_handle_swap_catalogue`) — id/name/vendor only. */
export type BrainCatalogueEntry = { id: string; name: string; vendor?: string };

export interface UseBrainCatalogueResult {
  /** `null` while unfetched or on a failed fetch (never a fabricated empty array); the real array
   * once a successful ack has landed. */
  entries: BrainCatalogueEntry[] | null;
  /** Ástríðr's own resolved chat-channel default profile id (D-03). `""` until a successful ack
   * carries a non-empty string — never a guess, never `profiles[0]`. */
  defaultProfileId: string;
  /** `true` when the most recent fetch attempt failed (non-ok ack, malformed payload, or a thrown
   * error) — an honest failure signal, distinct from "not yet fetched." */
  error: boolean;
  /** Re-issues the `swap.catalogue` command, superseding any still-in-flight response. */
  refetch: () => void;
}

export function useBrainCatalogue(): UseBrainCatalogueResult {
  const [entries, setEntries] = useState<BrainCatalogueEntry[] | null>(null);
  const [defaultProfileId, setDefaultProfileId] = useState("");
  const [error, setError] = useState(false);
  const [refetchNonce, setRefetchNonce] = useState(0);

  let sendCommand: ReturnType<typeof useAstridrWS>["sendCommand"] | null;
  let status: ReturnType<typeof useAstridrWS>["status"] | undefined;
  try {
    ({ sendCommand, status } = useAstridrWS());
  } catch {
    sendCommand = null;
    status = undefined;
  }

  // Generation guard: a `refetch()` (or a fresh connected transition) supersedes any still-pending
  // response from an earlier fetch — the earlier one is discarded rather than allowed to overwrite
  // fresher state on a race.
  const genRef = useRef(0);

  useEffect(() => {
    if (status !== "connected" || !sendCommand) return;
    const gen = ++genRef.current;
    let cancelled = false;
    (async () => {
      try {
        const ack = await sendCommand({ type: "swap.catalogue", target: "brain" });
        if (cancelled || gen !== genRef.current) return;
        if (ack.status !== "ok") {
          setError(true);
          return;
        }
        const raw = (ack as { entries?: unknown }).entries;
        if (!Array.isArray(raw)) {
          setError(true);
          return;
        }
        setEntries(raw as BrainCatalogueEntry[]);
        setError(false);
        const rawDefault = (ack as { default_profile_id?: unknown }).default_profile_id;
        setDefaultProfileId(typeof rawDefault === "string" ? rawDefault : "");
      } catch {
        if (!cancelled && gen === genRef.current) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, sendCommand, refetchNonce]);

  const refetch = () => setRefetchNonce((n) => n + 1);

  return { entries, defaultProfileId, error, refetch };
}
