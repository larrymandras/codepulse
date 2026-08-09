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
import { useBrainCatalogue } from "./useBrainCatalogue";
import { buildModelNameMap } from "@/lib/brainsApi";

export interface GlobalBrainOverride {
  modelOverride: string | null;
  voiceOverride: string | null;
}

// Derived from ActiveEngineMap (not imported directly from the D-16 per-profile adapter seam in
// `src/lib/`) so this file has zero dependency on that module — the global axis this hook owns
// must never be able to be masked or satisfied by that seam's stub flag either way.
export interface ResolvedBrain {
  source: "global" | "profile" | "mixed" | "lastTurn" | "none";
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
 * useGlobalModelNames — an id -> display-name map for the LIVE catalogue.
 *
 * Added closing the last of the UAT cosmetic leak (2026-07-29): the header badge and the Chat
 * composer pill resolve names against a catalogue that, before Phase 109, did NOT contain live
 * global-axis ids. So while a global override was in force they rendered the raw id
 * ("claude-sonnet-5") even though the swap dialogs correctly said "Claude Sonnet 5".
 *
 * Phase 109 D-02: reimplemented as a thin derivation over `useBrainCatalogue()` +
 * `buildModelNameMap` — there is exactly one `swap.catalogue` fetcher in the app
 * (`src/hooks/useBrainCatalogue.ts`) now that the per-profile and global axes share one catalogue.
 * External contract unchanged: still returns `Record<string, string>`, still an empty map on
 * failure, every existing caller keeps working with no changes of its own.
 *
 * Deliberately a SEPARATE hook rather than folding this into `useGlobalBrainOverride`: that hook's
 * `swap.get_state` snapshot behavior is directly asserted by its own tests, and a display-name
 * concern has no business changing the shape of the override-truth path. Consumers opt in.
 */
export function useGlobalModelNames(): Record<string, string> {
  const { entries } = useBrainCatalogue();
  return useMemo(() => buildModelNameMap(entries), [entries]);
}

/**
 * useLastTurnModel — the fleet-wide "model that answered the most recent completed turn",
 * sourced from `run.completed`'s `model` field (185-08; the same signal Control Center's
 * `BrainControl` and Chat.tsx's own `lastTurnModel` already use and that is confirmed working
 * live). Added to close the "No brain reported" gap (live finding 2026-07-31): the per-profile
 * telemetry rung (`useActiveEngine`, fed by astridr's `model_routing` ingest) is permanently
 * empty because the backend emitter never sends `profileId` and uses a different key name
 * (`selectedModel`, not `model`) than the Convex ingest expects — a real gap in astridr-repo's
 * router.py, tracked separately as the still-unbuilt "Ástríðr Phase 184.1" per
 * 103-CONTRACT.md. Rather than leave the header badge honestly-but-uselessly blank until that
 * backend work lands, this hook gives `resolveActiveBrain` a THIRD rung to fall back to.
 *
 * D-14 compliance: this is not a guess and not a persisted config value re-presented as live
 * state (the BSC-01 trap `useActiveEngine`'s docstring warns against) — `run.completed.model`
 * is genuine server-pushed, per-turn-confirmed state, just delivered over a different (already
 * working) telemetry path than the per-profile one. Callers must treat `source: "lastTurn"` as
 * distinct from `"profile"` — it is fleet-wide and can lag behind whichever profile most
 * recently completed a turn, not a live per-profile reading.
 */
export function useLastTurnModel(): string | null {
  const [model, setModel] = useState<string | null>(null);

  let subscribeEvent: ReturnType<typeof useAstridrWS>["subscribeEvent"] | null;
  try {
    ({ subscribeEvent } = useAstridrWS());
  } catch {
    subscribeEvent = null;
  }

  useEffect(() => {
    if (!subscribeEvent) return;
    return subscribeEvent("run.completed", (event) => {
      const data = (event as { data?: Record<string, unknown> }).data;
      const completedModel = data?.model as string | undefined;
      // Fast-path turns (control-verb refusals/confirmations, catalogue answers) complete with
      // no/empty model — keep the last real one rather than overwriting with a blank reading.
      if (completedModel) setModel(completedModel);
    });
  }, [subscribeEvent]);

  return model;
}

export function resolveActiveBrain(args: {
  globalOverride: string | null;
  activeEngines: ActiveEngineMap;
  profileId?: string;
  lastTurnModel?: string | null;
}): ResolvedBrain {
  const { globalOverride, activeEngines, profileId, lastTurnModel } = args;

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
    if (lastTurnModel) {
      return { source: "lastTurn", model: lastTurnModel, distinctModels: [] };
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
  if (lastTurnModel) {
    return { source: "lastTurn", model: lastTurnModel, distinctModels: [] };
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
  const lastTurnModel = useLastTurnModel();

  return useMemo(
    () => resolveActiveBrain({ globalOverride: modelOverride, activeEngines, profileId, lastTurnModel }),
    [modelOverride, activeEngines, profileId, lastTurnModel]
  );
}
