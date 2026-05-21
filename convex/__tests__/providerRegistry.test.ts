import { describe, it, expect } from "vitest";
import { ALL_PROVIDERS, GATEWAY_PROVIDERS, LEGACY_PROVIDERS } from "../lib/providers";

describe("providerRegistry — GW-03: provider list", () => {
  it("ALL_PROVIDERS contains all 7 providers", () => {
    expect(ALL_PROVIDERS).toHaveLength(7);
  });

  it("GATEWAY_PROVIDERS contains exactly claude-cli, codex, antigravity, claude-sdk", () => {
    expect(GATEWAY_PROVIDERS).toContain("claude-cli");
    expect(GATEWAY_PROVIDERS).toContain("codex");
    expect(GATEWAY_PROVIDERS).toContain("antigravity");
    expect(GATEWAY_PROVIDERS).toContain("claude-sdk");
    expect(GATEWAY_PROVIDERS).toHaveLength(4);
  });

  it("LEGACY_PROVIDERS contains exactly anthropic_direct, openrouter, ollama", () => {
    expect(LEGACY_PROVIDERS).toContain("anthropic_direct");
    expect(LEGACY_PROVIDERS).toContain("openrouter");
    expect(LEGACY_PROVIDERS).toContain("ollama");
    expect(LEGACY_PROVIDERS).toHaveLength(3);
  });

  it("ALL_PROVIDERS is LEGACY + GATEWAY combined", () => {
    for (const p of LEGACY_PROVIDERS) {
      expect(ALL_PROVIDERS).toContain(p);
    }
    for (const p of GATEWAY_PROVIDERS) {
      expect(ALL_PROVIDERS).toContain(p);
    }
  });
});

describe("providerRegistry — GW-01: toolExecutions provider field", () => {
  it.todo("toolExecutions.insert mutation accepts provider arg without error");
  it.todo("toolExecutions.insert mutation works without provider arg (backward compat)");
});

describe("providerRegistry — GW-03: dynamic providerHealth query", () => {
  it.todo("providerHealth.latest returns records keyed by all 7 providers");
  it.todo("providerHealth.upsert accepts authenticated, billingType, quotaRemaining");
});
