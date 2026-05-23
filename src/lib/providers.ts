/** Frontend mirror of convex/lib/providers.ts — keep in sync. */
export const GATEWAY_PROVIDERS = ["claude-cli", "codex", "antigravity", "claude-sdk"] as const;
export const LEGACY_PROVIDERS = ["anthropic_direct", "openrouter", "ollama"] as const;
export const ALL_PROVIDERS = [...LEGACY_PROVIDERS, ...GATEWAY_PROVIDERS] as const;

export type GatewayProvider = (typeof GATEWAY_PROVIDERS)[number];
export type LegacyProvider = (typeof LEGACY_PROVIDERS)[number];
export type AnyProvider = (typeof ALL_PROVIDERS)[number];

/** Display name mapping for UI rendering. Raw key used if not in map. */
export const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  "claude-cli": "Claude CLI",
  "codex": "Codex CLI",
  "antigravity": "Antigravity CLI",
  "claude-sdk": "Claude SDK",
  "anthropic_direct": "Anthropic Direct",
  "openrouter": "OpenRouter",
  "ollama": "Ollama",
};

/** Maps each provider to its billing model. Phase 67. */
export const PROVIDER_BILLING: Record<AnyProvider, "api" | "subscription"> = {
  "anthropic_direct": "api",
  "openrouter":       "api",
  "ollama":           "subscription",
  "claude-cli":       "subscription",
  "codex":            "subscription",
  "antigravity":      "subscription",
  "claude-sdk":       "api",
};

/** Returns billing type for a provider. Unknown providers default to "api" (conservative). */
export function getBillingType(provider: string): "api" | "subscription" {
  return (PROVIDER_BILLING as Record<string, "api" | "subscription">)[provider] ?? "api";
}

/** Provider family colors for badges, charts, and controls. Source: Phase 67 D-09. */
export const PROVIDER_COLORS: Record<string, string> = {
  "claude-cli":       "#10b981",   // emerald
  "claude-sdk":       "#10b981",   // emerald
  "codex":            "#22c55e",   // green (GPT family)
  "antigravity":      "#06b6d4",   // cyan
  "anthropic_direct": "#f59e0b",   // gold/amber
  "openrouter":       "#a855f7",   // purple (Gemini family)
  "ollama":           "#6b7280",   // gray
};
