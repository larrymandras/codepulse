/**
 * brainsFixtures.ts — the five VALIDATION.md-mandated fixtures for the D-16 per-profile
 * brain-swap stub seam (Phase 103-01-T2).
 *
 * These are real exported data, not inline test literals, so every downstream component/test
 * built against the stub adapter (waves 2-5) can exercise the actual branches the UI-SPEC
 * describes — expensive/unknown cost tiers, mixed-engine profiles, pinned-vs-inherited defaults,
 * quota thresholds, and the cmdk duplicate-name regression guard.
 */

import type { ActiveEngine, CatalogueEntry } from "./brainsApi";

/**
 * The per-profile brain catalogue the stub picker renders.
 *
 * Coverage (VALIDATION.md "Fixtures That Actually Exercise the Behavior"):
 * - At least one entry per `group` (subscription / api / local).
 * - At least one `costTier: "expensive"` and one `costTier: "unknown"` — without these the
 *   expensive-tier inline-confirm path (UI-SPEC §3) is unreachable and its test proves nothing.
 * - Two entries sharing an identical `name` ("Sonnet 5") but different `id`s — the cmdk
 *   value-keyed duplicate-selection regression guard (Pitfall 3).
 * - At least one `billing: "sub"` entry with no `quotaRemainingPct` (the "∞" branch) and at
 *   least one `billing: "api"` entry below the 0.05 quota threshold and one at/above 0.20.
 */
export const STUB_CATALOGUE: CatalogueEntry[] = [
  {
    id: "claude-cli-sonnet5",
    name: "Sonnet 5 (CLI)",
    vendor: "claude-cli",
    group: "subscription",
    billing: "sub",
    costTier: "normal",
    health: "reachable",
    // no quotaRemainingPct — subscription CLI brains render "∞"
  },
  {
    id: "codex-cli",
    name: "Codex CLI",
    vendor: "codex",
    group: "subscription",
    billing: "sub",
    costTier: "normal",
    health: "reachable",
  },
  {
    id: "antigravity-cli",
    name: "Antigravity CLI",
    vendor: "antigravity",
    group: "subscription",
    billing: "sub",
    costTier: "unknown", // unknown-tier fixture requirement
    health: "degraded",
  },
  {
    id: "anthropic-opus-4-8",
    name: "Opus 4.8",
    vendor: "anthropic_direct",
    group: "api",
    billing: "api",
    costTier: "expensive", // expensive-tier fixture requirement
    quotaRemainingPct: 0.03, // below the 0.05 error threshold
    health: "reachable",
  },
  {
    id: "anthropic-sonnet-5",
    name: "Sonnet 5",
    vendor: "anthropic_direct",
    group: "api",
    billing: "api",
    costTier: "normal",
    quotaRemainingPct: 0.35, // at/above the 0.20 ok threshold
    health: "reachable",
  },
  {
    id: "openrouter-sonnet-5-dup",
    name: "Sonnet 5", // duplicate display name, distinct id — cmdk regression guard
    vendor: "openrouter",
    group: "api",
    billing: "api",
    costTier: "normal",
    quotaRemainingPct: 0.5,
    health: "reachable",
  },
  {
    id: "ollama-llama3",
    name: "Llama 3 (local)",
    vendor: "ollama",
    group: "local",
    billing: "sub",
    costTier: "normal",
    health: "reachable",
    // no quotaRemainingPct — local brains have no quota concept either
  },
];

/**
 * Per-profile active-engine state, keyed by `profileId`.
 *
 * Coverage: at least two profiles with two DISTINCT engine values (the "Mixed brains"
 * stacked-dot path — UI-SPEC §2 — is unreachable from an all-agree fixture), and at least one
 * `mode: "pinned"` and one `mode: "inherited"` (D-11's pin-status-preserving revert cannot be
 * distinguished from a naive restore otherwise). A `mode: "session"` profile is included too so
 * the TTL-countdown branch (D-02) has a fixture as well, though it is not a mandatory-five item.
 */
export const STUB_PROFILE_ENGINES: Record<string, ActiveEngine> = {
  "assistant-default": {
    profileId: "assistant-default",
    model: "anthropic-sonnet-5",
    mode: "pinned",
    selectionPath: "codepulse-default",
    timestamp: Date.now(),
  },
  consulting: {
    profileId: "consulting",
    model: "claude-cli-sonnet5",
    mode: "inherited",
    selectionPath: "default",
    timestamp: Date.now(),
  },
  personal: {
    profileId: "personal",
    model: "ollama-llama3",
    mode: "session",
    selectionPath: "session-override",
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    timestamp: Date.now(),
  },
};

/** The profile the Ástríðr chat channel resolves against (103-CONTRACT.md §3). */
export const STUB_DEFAULT_PROFILE_ID = "assistant-default";

/**
 * Builds a configurable failure deny-list for `stubBrainsAdapter.dispatchSwap` so tests can
 * construct partial-failure global-swap scenarios (D-12) without monkey-patching the adapter.
 */
export function makeStubFailureSet(profileIds: string[]): Set<string> {
  return new Set(profileIds);
}
