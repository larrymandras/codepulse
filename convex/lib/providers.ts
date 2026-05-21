/**
 * Central provider registry for CodePulse.
 * Single source of truth for all known provider names.
 * Import from here — never hardcode provider arrays elsewhere.
 */

export const GATEWAY_PROVIDERS = [
  "claude-cli",
  "codex",
  "antigravity",
  "claude-sdk",
] as const;

export const LEGACY_PROVIDERS = [
  "anthropic_direct",
  "openrouter",
  "ollama",
] as const;

export const ALL_PROVIDERS = [...LEGACY_PROVIDERS, ...GATEWAY_PROVIDERS] as const;

export type GatewayProvider = (typeof GATEWAY_PROVIDERS)[number];
export type LegacyProvider = (typeof LEGACY_PROVIDERS)[number];
export type AnyProvider = (typeof ALL_PROVIDERS)[number];
