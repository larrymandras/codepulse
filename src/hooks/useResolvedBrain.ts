/**
 * useResolvedBrain.ts — 103-09-T1 (BSC-01 gap closure, defects 6a/6b).
 *
 * The ONE shared "what brain is actually running" resolution order, consumed by the header
 * badge, the Chat composer pill, and (indirectly, via `swapModelOverride`) Control Center's
 * `BrainControl`. Before this module existed, `BrainHeaderBadge` and the Chat composer pill each
 * held an independent, partial view of the global-override axis — one subscribed to `swap.state`
 * only (a CHANGE event) and never asked for a snapshot, the other never read the global axis at
 * all — so a global override already active before page load rendered as an honest-absent string
 * on two of the three surfaces while `BrainControl` (which already did both the snapshot
 * pull AND the subscription, see the precedent this module generalizes at the bottom of this file)
 * read correctly. That three-way disagreement is precisely the "stale config read presented as
 * live state" failure BSC-01 exists to eliminate.
 *
 * Resolution order (Phase 109 D-06/D-07, mirroring Ástríðr's own `ModelRouter._resolve_model`
 * chain — this corrects 103-CONTRACT.md §9's original, inverted description, which checked the
 * global override before a live per-profile override could even be represented):
 *   1. A live per-profile override (`profile_overrides` on `swap.state`, D-05/D-06) — the top
 *      rung. A profile pinned via a scoped `swap.set` wins even while a DIFFERENT global override
 *      is simultaneously active, exactly as Ástríðr will actually resolve that profile's next
 *      turn. Renders identically to a pinned per-profile telemetry reading (rung 3) — the operator
 *      never needs to know which of the two live signals answered the question.
 *   2. A global override (`swap.set`, rung 2) — genuinely governs every turn while in force, so
 *      it wins even when per-profile telemetry (rung 3) also exists. Showing the per-profile value
 *      while a global override governs the turn IS the BSC-01 trap.
 *   3. The per-profile telemetry snapshot (`useActiveEngine`, D-14 — server-reported only, never
 *      fabricated).
 *   4. `lastTurnModel`, FLEET-WIDE reads only (D-07) — never fed into a scoped (`profileId`
 *      supplied) read, because another profile's last-answered model is not this profile's engine.
 *   5. An explicit "none" reading — never a guess.
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
  source: "override" | "global" | "profile" | "mixed" | "lastTurn" | "none";
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

/** Per-profile override map: profile id -> the live override Ástríðr is currently applying for
 * that profile. A profile absent from the map has no override. */
export type ProfileBrainOverrides = Record<string, { model: string; source: string | null }>;

/** Coerce-or-drop discipline (T-103-32), applied to the WHOLE `profile_overrides` payload: a
 * missing/non-object payload yields an empty map; an individual entry whose `model` is not a
 * non-empty string is DROPPED from the map entirely rather than rendered as a reading. A profile
 * absent from the returned map has no override — this never invents a null-valued entry for it. */
function coerceProfileOverrides(raw: unknown): ProfileBrainOverrides {
  if (typeof raw !== "object" || raw === null) return {};
  const result: ProfileBrainOverrides = {};
  for (const [profileId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== "object" || value === null) continue;
    const model = (value as { model?: unknown }).model;
    if (typeof model !== "string" || model.length === 0) continue;
    const source = (value as { source?: unknown }).source;
    result[profileId] = { model, source: typeof source === "string" ? source : null };
  }
  return result;
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
 * useProfileBrainOverrides — owns the per-profile override axis end to end (D-05/D-06), mirroring
 * `useGlobalBrainOverride`'s pull+push shape exactly: a `swap.get_state` snapshot pull on every
 * `connected` transition plus a live `swap.state` subscription for changes that happen while the
 * tab is open.
 *
 * `profile_overrides` (added to `swap.state`/`swap.get_state` by plan 109-01) maps profile id ->
 * the live in-memory override Ástríðr is currently applying for that profile. A profile absent
 * from the map has no override — this hook never invents a null-valued entry for it.
 * `coerceProfileOverrides` applies the coerce-or-drop discipline per entry (T-103-32): a non-object
 * entry, or one whose `model` is not a non-empty string, is dropped rather than rendered.
 *
 * On a non-ok ack or a thrown error, this hook warns and leaves the PRIOR value in place — never
 * silently clears a real reading because one hydration attempt failed (the same rule
 * `useGlobalBrainOverride`'s Effect A documents). A successful ack/push whose `profile_overrides`
 * field is missing or malformed still updates state, coercing to an empty map — that is a real,
 * successful report that nothing is currently overridden, distinct from a failed attempt.
 */
export function useProfileBrainOverrides(): ProfileBrainOverrides {
  const [state, setState] = useState<ProfileBrainOverrides>({});

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

  // Effect A: re-hydrate on every (re)connect, not just first mount — mirrors
  // useGlobalBrainOverride's Effect A (the WR-07 lesson) for the same reason.
  useEffect(() => {
    if (status !== "connected" || !sendCommand) return;
    let cancelled = false;
    (async () => {
      try {
        const ack = await sendCommand({ type: "swap.get_state" });
        if (cancelled) return;
        if (ack.status === "ok") {
          setState(coerceProfileOverrides((ack as { profile_overrides?: unknown }).profile_overrides));
        } else {
          console.warn("Failed to hydrate per-profile brain overrides from server:", ack.error);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn("Failed to hydrate per-profile brain overrides from server:", err);
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
      setState(coerceProfileOverrides(data.profile_overrides));
    });
  }, [subscribeEvent]);

  return state;
}

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
 * useLastTurnModel — the FLEET-WIDE "model that answered the most recently completed turn",
 * sourced from `run.completed`'s `model` field (185-08; the same signal Control Center's
 * `BrainControl` and Chat.tsx's own `lastTurnModel` already use and that is confirmed working
 * live).
 *
 * D-07 (Phase 109): `resolveActiveBrain` routes this rung into the FLEET-WIDE (no-`profileId`)
 * read only — never a scoped per-profile read. `run.completed.model` is genuine server-pushed
 * state at fleet scope (the model that most recently answered ANY turn, fleet-wide), but at
 * per-profile scope it can be a DIFFERENT profile's model entirely — exactly the
 * fabricated-reading class ENGINE-03 exists to remove. Before this fix, a scoped read with no
 * per-profile telemetry and no override fell through to this rung and rendered a stranger's
 * engine as if it were this profile's own.
 *
 * Historical note, corrected: an earlier version of this docstring justified the (at-the-time
 * permanent) emptiness of the per-profile telemetry rung by citing an emitter bug — "the backend
 * never sends `profileId` and uses a different key name than the Convex ingest expects" — and a
 * nonexistent, still-unbuilt future astridr phase. Phase 108's D-01/D-11 fixed both of those
 * things; the per-profile telemetry rung is populated today. D-03's boot seed also emits one `model_routing`
 * row per profile at every process start (`bootstrap/core.py:1437`), so the fleet fallback below
 * is nearly unreachable in practice — it is kept because it costs nothing where it stays honest
 * (a genuine fleet-wide reading, never presented as a per-profile one).
 *
 * D-14 compliance: this is not a guess and not a persisted config value re-presented as live
 * state (the BSC-01 trap `useActiveEngine`'s docstring warns against) — `run.completed.model`
 * is genuine server-pushed, per-turn-confirmed state, just delivered over a different (already
 * working) telemetry path than the per-profile one. Callers must treat `source: "lastTurn"` as
 * fleet-wide only; `resolveActiveBrain` never routes it into a scoped read.
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

/**
 * resolveActiveBrain — PURE, no React. Exported for direct unit test.
 *
 * Precedence, mirroring Ástríðr's own `ModelRouter._resolve_model` chain (Phase 109 D-06/D-07 —
 * this order replaces 103-CONTRACT.md §9's original, inverted description, corrected in place):
 *   a. A live per-profile override (`profileOverrides[profileId]`, D-05/D-06) — the top rung.
 *      Renders identically to a pinned per-profile telemetry reading (`mode: "pinned"`); the
 *      operator never needs to know which of the two live signals answered the question.
 *   b. `globalOverride` non-null — wins over per-profile telemetry, but never over a live
 *      per-profile override (rung a): a pinned profile under an active global override still
 *      shows its own pin, exactly as Ástríðr will actually resolve that profile's next turn.
 *   c. `profileId` supplied → that profile's reported `ActiveEngine` (telemetry), or an honest
 *      "none" — NEVER the fleet-wide `lastTurnModel` (D-07): another profile's last-answered
 *      model is not this profile's engine.
 *   d. `profileId` omitted → the fleet-wide reading via `deriveMixedState`: mixed when profiles
 *      disagree, the single agreed engine when they agree, `lastTurnModel` when nothing is
 *      reported (a genuine fleet-wide signal), "none" when nothing at all is known.
 */
export function resolveActiveBrain(args: {
  globalOverride: string | null;
  activeEngines: ActiveEngineMap;
  profileId?: string;
  lastTurnModel?: string | null;
  profileOverrides?: ProfileBrainOverrides;
}): ResolvedBrain {
  const { globalOverride, activeEngines, profileId, lastTurnModel, profileOverrides = {} } = args;

  if (profileId !== undefined && profileOverrides[profileId]) {
    const override = profileOverrides[profileId];
    return {
      source: "override",
      model: override.model,
      mode: "pinned",
      distinctModels: [override.model],
    };
  }

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
    // D-07: the scoped branch never falls back to lastTurnModel — that signal is fleet-wide and
    // may describe a different profile's most recent turn entirely.
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
  const profileOverrides = useProfileBrainOverrides();
  const activeEngines = useActiveEngine();
  const lastTurnModel = useLastTurnModel();

  return useMemo(
    () =>
      resolveActiveBrain({
        globalOverride: modelOverride,
        activeEngines,
        profileId,
        lastTurnModel,
        profileOverrides,
      }),
    [modelOverride, activeEngines, profileId, lastTurnModel, profileOverrides]
  );
}
