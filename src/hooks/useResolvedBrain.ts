/**
 * useResolvedBrain.ts — 103-09-T1 (BSC-01 gap closure, defects 6a/6b).
 *
 * The ONE shared "what brain is actually running" resolution order, consumed by the header
 * badge, the Chat composer pill, and (indirectly, via `swapModelOverride`) Control Center's
 * `BrainControl`. Before this module existed, `BrainHeaderBadge` and the Chat composer pill each
 * held an independent, partial view of the global-override axis — one subscribed to `swap.state`
 * only (a CHANGE event) and never asked for a snapshot, the other never read the global axis at
 * all — so a global override already active before page load rendered as "No brain reported" /
 * "Auto" on two of the three surfaces while `BrainControl` (which already did both the snapshot
 * pull AND the subscription, see the precedent this module generalizes at the bottom of this file)
 * read correctly. That three-way disagreement is precisely the "stale config read presented as
 * live state" failure BSC-01 exists to eliminate.
 *
 * Resolution order (103-CONTRACT.md §9, mirroring `router.py`'s real precedence):
 *   1. A global override (`swap.set`, rung 2) — genuinely governs every turn while in force, so
 *      it wins even when per-profile telemetry (rung 4) also exists. Showing the per-profile value
 *      while a global override governs the turn IS the BSC-01 trap.
 *   2. The per-profile telemetry snapshot (`useActiveEngine`, D-14 — server-reported only, never
 *      fabricated).
 *   3. An explicit "none" reading — never a guess.
 *
 * D-14: the displayed engine comes only from server-reported state (`swap.get_state` ack /
 * `swap.state` push / Convex telemetry), never from a client assertion or an optimistic guess.
 */

import { useEffect, useMemo, useState } from "react";
import { useAstridrWS } from "@/contexts/AstridrWSContext";
import { useActiveEngine, deriveMixedState, type ActiveEngineMap } from "./useActiveEngine";

export interface GlobalBrainOverride {
  modelOverride: string | null;
  voiceOverride: string | null;
}

// Derived from ActiveEngineMap (not imported directly from the D-16 per-profile adapter seam in
// `src/lib/`) so this file has zero dependency on that module — the global axis this hook owns
// must never be able to be masked or satisfied by that seam's stub flag either way.
export interface ResolvedBrain {
  source: "global" | "profile" | "mixed" | "none";
  model: string | null;
  mode?: NonNullable<ActiveEngineMap[string]>["mode"];
  expiresAt?: number;
  distinctModels: string[];
}

/** Coerces any payload field to `string | null` — a non-string value (malformed/spoofed WS
 * payload, T-103-32) is never rendered as a reading; it becomes an honest `null` instead. */
function coerceOverrideString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * useGlobalBrainOverride — owns the global-override axis end to end: a `swap.get_state` snapshot
 * pull on every `connected` transition (THE FIX — this is what neither `BrainHeaderBadge` nor the
 * Chat composer pill did before this module existed) plus a live `swap.state` subscription for
 * changes that happen while the tab is open. This is the precedent Chat.tsx already established
 * at its own former inline `swapState` (see `src/pages/Chat.tsx`'s pre-103-09 history around what
 * is now this hook's call site) — generalized here so every consumer shares one instance of the
 * pull+push pair instead of three independently-wrong copies.
 *
 * `useAstridrWS()` throws when rendered outside `AstridrWSProvider`. The try/catch below is safe
 * with respect to the rules of hooks: `useAstridrWS()` either succeeds (its one `useContext` call
 * already completed) or throws a plain JS error from application code that runs *after* that hook
 * call finished — the number and order of hooks invoked per render never changes between branches.
 */
export function useGlobalBrainOverride(): GlobalBrainOverride {
  const [state, setState] = useState<GlobalBrainOverride>({
    modelOverride: null,
    voiceOverride: null,
  });

  let subscribeEvent: ReturnType<typeof useAstridrWS>["subscribeEvent"] | null;
  let sendCommand: ReturnType<typeof useAstridrWS>["sendCommand"] | null;
  let status: ReturnType<typeof useAstridrWS>["status"] | undefined;
  try {
    ({ subscribeEvent, sendCommand, status } = useAstridrWS());
  } catch {
    subscribeEvent = null;
    sendCommand = null;
    status = undefined;
  }

  // Effect A (THE FIX): re-hydrate on every (re)connect, not just first mount — a swap made while
  // this tab's socket was down (or from another surface) must not leave a stale reading (the
  // WR-07 lesson). Skip while the socket is down. On a non-ok ack or a throw, warn and leave the
  // prior value in place — never silently clear a real reading because one hydration attempt
  // failed.
  useEffect(() => {
    if (status !== "connected" || !sendCommand) return;
    let cancelled = false;
    (async () => {
      try {
        const ack = await sendCommand({ type: "swap.get_state" });
        if (cancelled) return;
        if (ack.status === "ok") {
          setState({
            modelOverride: coerceOverrideString(ack.model_override),
            voiceOverride: coerceOverrideString(ack.voice_override_name),
          });
        } else {
          console.warn("Failed to hydrate global brain override from server:", ack.error);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn("Failed to hydrate global brain override from server:", err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, sendCommand]);

  // Effect B: live push for changes that happen while this tab is open.
  useEffect(() => {
    if (!subscribeEvent) return;
    return subscribeEvent("swap.state", (event) => {
      const data = (event as { data?: Record<string, unknown> }).data;
      if (!data) return;
      setState({
        modelOverride: coerceOverrideString(data.model_override),
        voiceOverride: coerceOverrideString(data.voice_override_name),
      });
    });
  }, [subscribeEvent]);

  return state;

}

/**
 * resolveActiveBrain — PURE, no React. Exported for direct unit test.
 *
 * Precedence (103-CONTRACT.md §9):
 *   a. `globalOverride` non-null wins outright, regardless of per-profile telemetry.
 *   b. `profileId` supplied → that profile's reported `ActiveEngine`, or an honest "none".
 *   c. `profileId` omitted → the fleet-wide reading via `deriveMixedState`: mixed when profiles
 *      disagree, the single agreed engine when they agree, "none" when nothing is reported.
 */
/**
 * useGlobalModelNames — an id -> display-name map for the LIVE global catalogue.
 *
 * Added closing the last of the UAT cosmetic leak (2026-07-29): the header badge and the Chat
 * composer pill resolve names against `brainsApi.getCatalogue()`, the per-profile D-16 seam, which
 * does NOT contain live global-axis ids. So while a global override was in force they rendered the
 * raw id ("claude-sonnet-5") even though the swap dialogs correctly said "Claude Sonnet 5".
 *
 * Deliberately a SEPARATE hook rather than folding this into `useGlobalBrainOverride`: that hook's
 * `swap.get_state` snapshot behavior is directly asserted by its own tests, and a display-name
 * concern has no business changing the shape of the override-truth path. Consumers opt in.
 *
 * One `swap.catalogue` per `connected` transition — the picker already sends the same command on
 * every open, so this is a small, bounded addition. On any failure it returns an empty map and every
 * caller falls back to showing the raw id: an honest degrade, never a fabricated name.
 */
export function useGlobalModelNames(): Record<string, string> {
  const [names, setNames] = useState<Record<string, string>>({});

  let sendCommand: ReturnType<typeof useAstridrWS>["sendCommand"] | null;
  let status: ReturnType<typeof useAstridrWS>["status"] | undefined;
  try {
    ({ sendCommand, status } = useAstridrWS());
  } catch {
    sendCommand = null;
    status = undefined;
  }

  useEffect(() => {
    if (status !== "connected" || !sendCommand) return;
    let cancelled = false;
    (async () => {
      try {
        // `target: "brain"` is REQUIRED — Ástríðr rejects the command without it. Omitting it made
        // this hook silently return an empty map (verified live: the badge kept showing the raw id
        // while the honest-degrade catch swallowed the error ack). Matches BrainPicker.tsx:249.
        const ack = await sendCommand({ type: "swap.catalogue", target: "brain" });
        if (cancelled || ack.status !== "ok") return;
        const raw = (ack as { entries?: unknown }).entries;
        if (!Array.isArray(raw)) return;
        const map: Record<string, string> = {};
        for (const item of raw) {
          const entry = item as { id?: unknown; name?: unknown };
          if (typeof entry.id === "string" && typeof entry.name === "string") {
            map[entry.id] = entry.name;
          }
        }
        setNames(map);
      } catch {
        /* honest degrade: callers show the raw model id */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, sendCommand]);

  return names;
}

export function resolveActiveBrain(args: {
  globalOverride: string | null;
  activeEngines: ActiveEngineMap;
  profileId?: string;
}): ResolvedBrain {
  const { globalOverride, activeEngines, profileId } = args;

  if (globalOverride) {
    return { source: "global", model: globalOverride, distinctModels: [] };
  }

  if (profileId !== undefined) {
    const engine = activeEngines[profileId];
    if (engine) {
      return {
        source: "profile",
        model: engine.model,
        mode: engine.mode,
        expiresAt: engine.expiresAt,
        distinctModels: [],
      };
    }
    return { source: "none", model: null, distinctModels: [] };
  }

  const mixedState = deriveMixedState(activeEngines);
  if (mixedState.mixed) {
    return { source: "mixed", model: null, distinctModels: mixedState.distinctModels };
  }
  if (mixedState.single) {
    return {
      source: "profile",
      model: mixedState.single.model,
      mode: mixedState.single.mode,
      expiresAt: mixedState.single.expiresAt,
      distinctModels: mixedState.distinctModels,
    };
  }
  return { source: "none", model: null, distinctModels: [] };
}

/**
 * useResolvedBrain — composes `useGlobalBrainOverride()` + `useActiveEngine()` +
 * `resolveActiveBrain`, memoized on its inputs. This is the one call every brain surface makes;
 * none of them may re-derive the resolution order independently.
 */
export function useResolvedBrain(profileId?: string): ResolvedBrain {
  const { modelOverride } = useGlobalBrainOverride();
  const activeEngines = useActiveEngine();

  return useMemo(
    () => resolveActiveBrain({ globalOverride: modelOverride, activeEngines, profileId }),
    [modelOverride, activeEngines, profileId]
  );
}
