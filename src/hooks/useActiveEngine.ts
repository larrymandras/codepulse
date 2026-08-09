import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { isUnresolvedRouting } from "../../convex/activeEngineFilters";
import { useProfileConfigs } from "./useProfileConfigs";
import { modelIdsMatch, type ActiveEngine } from "../lib/brainsApi";

/**
 * useActiveEngine.ts — the single reactive per-profile active-engine map (BSC-01's
 * read half, D-14). Every brain surface (header badge, Settings row, composer pill,
 * picker) reads THIS hook so they cannot disagree with themselves.
 *
 * D-14: the hook returns ONLY what `convex/activeEngine.ts`'s `latestByProfile`
 * query reports (fed exclusively by astridr's `model_routing` telemetry ingest —
 * see 103-CONTRACT.md §4). It computes NO engine value of its own and performs NO
 * fallback to the profile config's persisted model-preference field — that field
 * holds a persisted CONFIG value, not a live reading, and presenting it as live state
 * is exactly the v9.0 VitalsRail active-profile trap BSC-01 exists to remove. A
 * profile with no reported telemetry row reads as unknown (`null`), never as a
 * guess derived from its config.
 */

/** Per-profile map: `null` means "known profile, no telemetry reported yet" —
 * distinct from a missing key, which would read as "not a known profile at all". */
export type ActiveEngineMap = Record<string, ActiveEngine | null>;

export interface MixedState {
  mixed: boolean;
  distinctModels: string[];
  /** Only set when every reporting profile agrees on one model. */
  single?: ActiveEngine;
}

/**
 * deriveMixedState — PURE function, no Convex/React dependency, exported
 * separately so the "Mixed brains" computation (UI-SPEC §2) is unit-testable
 * without a Convex runtime. Profiles with a `null`/unreported engine are
 * excluded from the model comparison — "unreported" is not itself a model
 * value and must never manufacture a spurious "mixed" reading.
 */
export function deriveMixedState(engines: ActiveEngineMap): MixedState {
  const reported = Object.values(engines).filter(
    (e): e is ActiveEngine => e !== null && e !== undefined
  );

  if (reported.length === 0) {
    return { mixed: false, distinctModels: [] };
  }

  // D-08: fold with modelIdsMatch instead of a raw `Set` — a raw Set splits one model reported in
  // two id formats (e.g. "anthropic/claude-sonnet-5" vs "claude-sonnet-5") into two distinct
  // entries, which is exactly the false "Mixed brains" defect this rule exists to prevent. This
  // changes ONLY the comparison; the accumulator keeps the FIRST-seen literal id as the
  // representative, so `distinctModels` still contains a byte-faithful value the server actually
  // reported, never a synthesized canonical form. Canonicalizing here (stripping every id before
  // storing it) is D-08's explicitly rejected option: it would make this hook stop returning what
  // Ástríðr actually said.
  const distinctModels: string[] = [];
  for (const engine of reported) {
    if (!distinctModels.some((m) => modelIdsMatch(m, engine.model))) {
      distinctModels.push(engine.model);
    }
  }

  if (distinctModels.length === 1) {
    return { mixed: false, distinctModels, single: reported[0] };
  }

  return { mixed: true, distinctModels };
}

/**
 * useActiveEngine — reads `api.activeEngine.latestByProfile` (plain `useQuery`,
 * not `useThrottledQuery`'s `useProviderHealth.ts` idiom: swap state must feel
 * closer to real-time than provider-health polling, which throttles re-renders
 * on a 5s cadence) and joins it against `useProfileConfigs()` — `profileConfigs`
 * is the real, populated per-profile source (`convex/profiles.ts:188-197`'s
 * `listConfigs`); the legacy per-agent profile table has zero rows in production
 * (`convex/profiles.ts:113`) and is never read here.
 *
 * Coalesced with `??` at every query boundary so this hook can NEVER return
 * `undefined`. This is load-bearing: the header badge built in 103-06 renders
 * on every page via `DashboardLayout`, and a throwing or undefined `useQuery`
 * here would unmount the whole React tree and blank the entire dashboard
 * (T-103-09).
 */
export function useActiveEngine(): ActiveEngineMap {
  const snapshots = useQuery(api.activeEngine.latestByProfile) ?? [];
  const profiles = useProfileConfigs();

  const byProfileId = new Map<string, ActiveEngine>();
  for (const row of snapshots) {
    // UAT 2026-07-29 (103-UAT.md test 2): a row carrying no resolvable profile or model is the
    // ABSENCE of a reading, not a reading of "unknown". Dropping it here is what keeps a profile
    // with no telemetry reading as null (→ the honest absent state) instead of letting the sentinel
    // become deriveMixedState's single agreed model and light the confirmed-live pulse on it.
    // Filtered on the read path as well as at ingest because one such row is already stored in
    // production, and this hook must be honest about it before it is deleted.
    if (isUnresolvedRouting(row)) continue;
    byProfileId.set(row.profileId, row as ActiveEngine);
  }

  const map: ActiveEngineMap = {};
  for (const profile of profiles) {
    map[profile.profileId] = byProfileId.get(profile.profileId) ?? null;
  }

  // Defensive: a profile that reported telemetry but is not (yet) present in
  // profileConfigs still gets a real reading rather than being silently
  // dropped — the server report is never discarded just because the join
  // target is momentarily behind.
  for (const [profileId, engine] of byProfileId) {
    if (!(profileId in map)) {
      map[profileId] = engine;
    }
  }

  return map;
}
