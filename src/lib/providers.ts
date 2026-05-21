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
