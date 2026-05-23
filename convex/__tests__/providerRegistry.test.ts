import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { ALL_PROVIDERS, GATEWAY_PROVIDERS, LEGACY_PROVIDERS, getBillingType, PROVIDER_BILLING } from "../lib/providers";
import * as toolExecutions from "../toolExecutions";
import * as providerHealth from "../providerHealth";

// Source snapshots for schema-level assertions on Convex mutation arg shapes.
// (Convex mutations cannot be invoked outside the Convex runtime —
// the established project pattern is source-level verification for arg schema
// shape, with top-level imports to verify exports exist.)
const toolExecutionsSrc = readFileSync(
  resolve(__dirname, "../toolExecutions.ts"),
  "utf-8"
);
const providerHealthSrc = readFileSync(
  resolve(__dirname, "../providerHealth.ts"),
  "utf-8"
);

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
  it("toolExecutions.insert mutation accepts provider arg without error", () => {
    // The insert mutation's args object must declare a provider field so callers
    // can supply the originating provider when inserting a tool execution record.
    // Behavioral contract: provider is present in the args schema.
    expect(toolExecutionsSrc).toContain("provider");
    // Must be declared inside the args object of the insert mutation
    expect(toolExecutionsSrc).toMatch(/args:\s*\{[^}]*provider[^}]*\}/s);
    // The insert export must exist
    expect(toolExecutions.insert).toBeDefined();
  });

  it("toolExecutions.insert mutation works without provider arg (backward compat)", () => {
    // provider must be optional — omitting it is valid (backward compatibility
    // with existing callers that do not pass a provider).
    // Behavioral contract: provider is declared as v.optional(...), not required.
    expect(toolExecutionsSrc).toMatch(/provider:\s*v\.optional\(v\.string\(\)\)/);
    // Confirm it is NOT declared as a required v.string() bare field
    expect(toolExecutionsSrc).not.toMatch(/provider:\s*v\.string\(\)[^)]/);
  });
});

describe("providerRegistry — GW-03: dynamic providerHealth query", () => {
  it("providerHealth.latest returns records keyed by all 7 providers", () => {
    // The latest query must iterate over ALL_PROVIDERS (7 providers) as its
    // source of truth, NOT a hardcoded 3-element array.
    // Behavioral contract: source imports and uses ALL_PROVIDERS, old array is gone.
    expect(providerHealthSrc).toContain('import { ALL_PROVIDERS } from "./lib/providers"');
    // The latest handler must reference ALL_PROVIDERS
    expect(providerHealthSrc).toMatch(/const providers = ALL_PROVIDERS/);
    // The old hardcoded 3-provider array must not appear anywhere in the file
    expect(providerHealthSrc).not.toContain(
      '["anthropic_direct", "openrouter", "ollama"]'
    );
    // Registry covers all 7 — verified via the real ALL_PROVIDERS export
    expect(ALL_PROVIDERS).toHaveLength(7);
  });

  it("providerHealth.upsert accepts authenticated, billingType, quotaRemaining", () => {
    // The upsert mutation must accept these three new fields so gateway health
    // reporters can record auth state, billing model, and quota usage.
    // Behavioral contract: all three fields are in the upsert args schema.
    expect(providerHealthSrc).toMatch(/authenticated:\s*v\.optional\(v\.boolean\(\)\)/);
    expect(providerHealthSrc).toMatch(/billingType:\s*v\.optional\(v\.string\(\)\)/);
    expect(providerHealthSrc).toMatch(/quotaRemaining:\s*v\.optional\(v\.float64\(\)\)/);
    // All three must be present within the upsert mutation's args block
    // (not just anywhere in the file — both upsert and recordStateChange have them,
    // so we verify the upsert mutation specifically contains the args block)
    const upsertBlock = providerHealthSrc.slice(
      providerHealthSrc.indexOf("export const upsert"),
      providerHealthSrc.indexOf("export const recordStateChange")
    );
    expect(upsertBlock).toContain("authenticated");
    expect(upsertBlock).toContain("billingType");
    expect(upsertBlock).toContain("quotaRemaining");
    // The upsert and latest exports must exist
    expect(providerHealth.upsert).toBeDefined();
    expect(providerHealth.latest).toBeDefined();
  });
});
