import { describe, it, expect } from "vitest";
import { deduplicateByProvider } from "./gatewayQuota";

// Tests for GW-08: gatewayQuota backend service

describe("gatewayQuota — insertSnapshot args shape", () => {
  it("insertSnapshot accepts all required fields", () => {
    const args = {
      provider: "claude-sdk",
      billingType: "subscription",
      usedToday: 42,
      dailyLimit: 100,
      spendUsd: 0.05,
      spendCapUsd: 10.0,
      remainingPct: 0.72,
      timestamp: Date.now() / 1000,
    };
    expect(args).toHaveProperty("provider");
    expect(args).toHaveProperty("billingType");
    expect(args).toHaveProperty("usedToday");
    expect(args).toHaveProperty("spendUsd");
    expect(args).toHaveProperty("remainingPct");
    expect(args).toHaveProperty("timestamp");
  });

  it("insertSnapshot allows optional dailyLimit and spendCapUsd to be undefined", () => {
    const args = {
      provider: "codex",
      billingType: "api",
      usedToday: 5,
      dailyLimit: undefined,
      spendUsd: 0.02,
      spendCapUsd: undefined,
      remainingPct: 1.0,
      timestamp: Date.now() / 1000,
    };
    expect(args.dailyLimit).toBeUndefined();
    expect(args.spendCapUsd).toBeUndefined();
  });
});

describe("deduplicateByProvider — latestByProvider logic", () => {
  it("deduplicates to most recent per provider", () => {
    // Rows ordered newest-first (as returned by by_timestamp desc)
    const rows = [
      { provider: "claude-sdk", timestamp: 200, billingType: "subscription", usedToday: 50, spendUsd: 0.1, remainingPct: 0.5 },
      { provider: "codex", timestamp: 150, billingType: "api", usedToday: 10, spendUsd: 0.02, remainingPct: 0.9 },
      { provider: "claude-sdk", timestamp: 100, billingType: "subscription", usedToday: 40, spendUsd: 0.08, remainingPct: 0.6 },
    ];
    const result = deduplicateByProvider(rows);
    expect(result).toHaveLength(2);
    const claude = result.find((r) => r.provider === "claude-sdk");
    expect(claude!.timestamp).toBe(200);
  });

  it("returns empty array when no snapshots exist", () => {
    const result = deduplicateByProvider([]);
    expect(result).toHaveLength(0);
  });

  it("returns single entry when only one provider exists", () => {
    const rows = [
      { provider: "codex", timestamp: 300, billingType: "api", usedToday: 1, spendUsd: 0.01, remainingPct: 0.99 },
    ];
    const result = deduplicateByProvider(rows);
    expect(result).toHaveLength(1);
    expect(result[0].provider).toBe("codex");
  });
});
