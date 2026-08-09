/**
 * brainsApi.ts — model-id display/normalization helpers (Phase 109 Plan 03).
 *
 * Historical note: this module used to be the D-16 adapter seam for the per-profile brain-swap
 * axis — a stub/live adapter pair gated by a build-time stub-mode env flag. Phase 109 D-01
 * retired that seam entirely: the per-profile axis now dispatches the real, server-registered
 * `swap.set` (with `profile_id`) through the same `useCommandDispatch()` sender the global axis
 * already uses, and the catalogue is read through `src/hooks/useBrainCatalogue.ts` — the one
 * `swap.catalogue` fetcher for every brain surface (D-02). There is no stub concept left anywhere
 * in this module, and no build-time flag can make any surface render fabricated engine data
 * (T-103-03).
 *
 * What survives here is strictly display-metadata resolution: turning a raw model id into the
 * catalogue's display name, tolerating the vendor-prefix split between config-sourced ids
 * ("anthropic/claude-sonnet-5") and live `swap.catalogue` ids ("claude-sonnet-5"). See
 * .planning/phases/103-brain-swap-control-surface/103-CONTRACT.md for the full historical shape
 * spec these types still mirror.
 */

export interface CatalogueEntry {
  id: string;
  name: string;
  vendor: string;
  group: "subscription" | "api" | "local";
  billing: "api" | "sub";
  costTier: "normal" | "expensive" | "unknown";
  quotaRemainingPct?: number;
  health?: "reachable" | "degraded" | "unreachable";
}

/**
 * The shape `convex/activeEngine.ts`'s `latestByProfile` query reports — genuinely live telemetry
 * (astridr's `model_routing` ingest, 103-CONTRACT.md §4), never part of the deleted per-profile
 * stub/live adapter seam. `useActiveEngine.ts` is this type's real consumer; it stays here because
 * every brain surface already imports catalogue/display types from this module.
 */
export interface ActiveEngine {
  profileId: string;
  model: string;
  mode: "session" | "pinned" | "inherited";
  selectionPath: string;
  expiresAt?: number;
  timestamp: number;
}

// ─── Model display names (UAT 2026-07-29, cosmetic follow-up) ─────────────────────────────────
//
// Raw model ids were leaking into operator-facing copy in four places while a real display name was
// available: the header badge and Chat composer pill labels ("claude-sonnet-5"), the confirm modal's
// shadowing warning ("anthropic/claude-sonnet-5"), and the revert result ("Reverted to
// claude-haiku-4-5-20251001") — all while the dialog TITLES correctly said "Claude Sonnet 5" /
// "Claude Haiku 4.5".
//
// The confirm-modal case had a real cause, not just a missing lookup: `profileConfigs
// .modelPreferences.primary` is vendor-prefixed ("anthropic/claude-sonnet-5") while live
// `swap.catalogue` ids are not ("claude-sonnet-5"), so an exact id match could never hit. Hence the
// prefix-tolerant match below.
//
// Deliberately does NOT invent a name when the catalogue has no entry: it returns the id unchanged.
// Prettifying an unknown id is unreliable (e.g. "claude-haiku-4-5-20251001" would become "Claude
// Haiku 4 5 20251001", worse than the id) and dressing up an identifier as a product name is the
// same class of dishonesty D-14 exists to prevent.

/** Strips a leading vendor namespace: "anthropic/claude-sonnet-5" -> "claude-sonnet-5". */
function stripVendorPrefix(modelId: string): string {
  const slash = modelId.lastIndexOf("/");
  return slash === -1 ? modelId : modelId.slice(slash + 1);
}

/**
 * Resolves a model id to its catalogue display name, tolerating the vendor-prefix mismatch between
 * config-sourced ids and live catalogue ids. Falls back to the id itself, unchanged, when no
 * catalogue entry matches — never a fabricated name.
 */
export function resolveModelDisplayName(
  modelId: string,
  catalogue: CatalogueEntry[] | { id: string; name: string; vendor?: string }[] | null | undefined,
  fallbackNames?: Record<string, string> | null
): string {
  const bare = stripVendorPrefix(modelId);

  if (catalogue && catalogue.length > 0) {
    const exact = catalogue.find((e) => e.id === modelId);
    if (exact) return exact.name;
    const suffix = catalogue.find((e) => stripVendorPrefix(e.id) === bare);
    if (suffix) return suffix.name;
  }

  // `fallbackNames` carries the LIVE global catalogue's names for surfaces whose own `catalogue`
  // comes from a source that does not contain global-axis ids at all — the header badge and Chat
  // composer pill, which is why they still rendered "claude-sonnet-5" after the first pass of this
  // fix.
  if (fallbackNames) {
    const hit = fallbackNames[modelId] ?? fallbackNames[bare];
    if (hit) return hit;
  }

  return modelId;
}

/**
 * Builds an id -> display-name map for surfaces that must resolve a name WITHOUT holding the
 * catalogue themselves (GlobalSwapModal resolving the prior override it is reverting to). Includes
 * both the raw and vendor-stripped keys so either id namespace resolves.
 */
export function buildModelNameMap(
  catalogue: CatalogueEntry[] | { id: string; name: string; vendor?: string }[] | null | undefined
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const entry of catalogue ?? []) {
    map[entry.id] = entry.name;
    const bare = stripVendorPrefix(entry.id);
    if (!(bare in map)) map[bare] = entry.name;
  }
  return map;
}
