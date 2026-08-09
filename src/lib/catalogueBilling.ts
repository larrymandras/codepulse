/**
 * catalogueBilling.ts — `mapCatalogueVendorToBilling`, the D-13 translation (109-CONTEXT.md,
 * correcting D-09's original premise) from `swap.catalogue`'s `vendor` field onto CodePulse's own
 * `PROVIDER_BILLING` registry (`src/lib/providers.ts`).
 *
 * The two fields describe DIFFERENT axes, not a 1:1 alias pair:
 *   - `swap.catalogue`'s `vendor` means model MANUFACTURER. The static pinned Claude tier hardcodes
 *     `"vendor": "anthropic"` (astridr `ws_commands.py:1202`); every dynamic entry sets
 *     `"vendor": model_id.split("/", 1)[0]` (`:1225`) — an OpenRouter routing slug like `"google"`,
 *     `"x-ai"`, `"meta-llama"`, `"mistralai"`, `"deepseek"`, `"qwen"`.
 *   - `PROVIDER_BILLING`'s keys mean EXECUTION/BILLING CHANNEL: `anthropic_direct`, `openrouter`,
 *     `ollama`, `claude-cli`, `codex`, `antigravity`, `claude-sdk` (`providers.ts:22-29`).
 * A literal `vendor in PROVIDER_BILLING` lookup matches NOTHING — not even the Claude tier — and
 * would put essentially the entire live catalogue (300+ entries) in "Unclassified", firing the
 * expensive-model confirm on almost every row. That lands close to the flattening D-09 exists to
 * undo, which is why D-13 REJECTS the literal per-vendor-slug lookup in favor of the rule below.
 *
 * D-13's rule, implemented verbatim:
 *   - `"anthropic"` maps to the `anthropic_direct` registry entry.
 *   - every other NON-EMPTY vendor reaching this catalogue arrived via
 *     `swap_model._openrouter.get_models()` (`ws_commands.py:1206-1238` — verified, there is no
 *     third source) and is therefore billed per-token as the OpenRouter catch-all.
 *   - an EMPTY or MISSING vendor is the only path to `"unclassified"` / `costTier:"unknown"` — this
 *     is D-09's honesty clause surviving unchanged: never silently default to `api`/`normal`.
 *
 * A vendor string that happens to also BE a `PROVIDER_BILLING` key (e.g. `"ollama"`) still resolves
 * through the SAME rule rather than by accident — it is a non-empty, non-`"anthropic"` vendor, so it
 * takes the OpenRouter catch-all like any other manufacturer slug. The two axes are unrelated; a
 * vendor slug colliding with a billing-channel key is coincidence, not a signal.
 *
 * Detection of the unclassified case is by EMPTINESS, never by calling the registry's own
 * unmapped-provider fallback helper (`providers.ts:32-35`) — that helper's `?? "api"` default
 * (its own comment: "conservative") makes "unclassified" undetectable, since every vendor (mapped
 * or not) would resolve to `"api"`. This function derives the group directly from
 * `PROVIDER_BILLING[key]` instead, so a future registry change (e.g. moving a channel from `"api"`
 * to `"subscription"`) propagates here rather than being hardcoded twice.
 *
 * Two consequences on record, not left to be discovered:
 *   1. Under this rule "Unclassified" only fires on a malformed/missing vendor — a defensive branch
 *      today, since the live catalogue always reports a real vendor slug or the literal
 *      `"anthropic"`.
 *   2. The Subscription and Local groups are structurally UNREACHABLE from `swap.catalogue` today —
 *      `grep -in "ollama"` across `swap_model.py`/`ws_commands.py` returns zero hits, and no
 *      CLI-gateway vendor is ever returned — so they render empty via the picker's existing
 *      `.filter((g) => g.entries.length > 0)`. That is honest: it matches what the server can
 *      actually report. Populating them is the already-deferred `swap.catalogue` enrichment, not
 *      this phase.
 */

import { PROVIDER_BILLING } from "@/lib/providers";

export interface CatalogueBilling {
  group: "subscription" | "api" | "local" | "unclassified";
  billing: "api" | "sub";
  costTier: "normal" | "expensive" | "unknown";
}

export function mapCatalogueVendorToBilling(vendor: string | undefined): CatalogueBilling {
  if (!vendor) {
    return { group: "unclassified", billing: "api", costTier: "unknown" };
  }

  // "anthropic" is the one manufacturer slug D-13 aliases to a specific billing channel; every
  // other non-empty vendor is the OpenRouter catch-all — see the module docstring for why a literal
  // per-slug lookup against PROVIDER_BILLING cannot be used here.
  const registryKey = vendor === "anthropic" ? "anthropic_direct" : "openrouter";
  const billingChannel = PROVIDER_BILLING[registryKey]; // "api" | "subscription"
  const group: CatalogueBilling["group"] = billingChannel === "subscription" ? "subscription" : "api";
  const billing: CatalogueBilling["billing"] = billingChannel === "subscription" ? "sub" : "api";

  return { group, billing, costTier: "normal" };
}
