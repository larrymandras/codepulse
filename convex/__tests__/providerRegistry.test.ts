import { describe, it, expect } from "vitest";
import { ALL_PROVIDERS, GATEWAY_PROVIDERS, LEGACY_PROVIDERS, getBillingType, PROVIDER_BILLING } from "../lib/providers";

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

describe("providerRegistry — GW-05: billing type registry", () => {
  it("getBillingType('claude-sdk') returns 'api'", () => {
    expect(getBillingType("claude-sdk")).toBe("api");
  });

  it("getBillingType('codex') returns 'subscription'", () => {
    expect(getBillingType("codex")).toBe("subscription");
  });

  it("getBillingType('antigravity') returns 'subscription'", () => {
    expect(getBillingType("antigravity")).toBe("subscription");
  });

  it("getBillingType('claude-cli') returns 'subscription'", () => {
    expect(getBillingType("claude-cli")).toBe("subscription");
  });

  it("getBillingType('anthropic_direct') returns 'api'", () => {
    expect(getBillingType("anthropic_direct")).toBe("api");
  });

  it("getBillingType('openrouter') returns 'api'", () => {
    expect(getBillingType("openrouter")).toBe("api");
  });

  it("getBillingType('ollama') returns 'subscription'", () => {
    expect(getBillingType("ollama")).toBe("subscription");
  });

  it("getBillingType('unknown-provider') returns 'api' as default", () => {
    expect(getBillingType("unknown-provider")).toBe("api");
  });

  it("PROVIDER_BILLING covers all providers in ALL_PROVIDERS", () => {
    for (const p of ALL_PROVIDERS) {
      expect(PROVIDER_BILLING).toHaveProperty(p);
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
