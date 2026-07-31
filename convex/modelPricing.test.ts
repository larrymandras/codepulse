/**
 * Tests for convex/modelPricing.ts — pure rate-resolution helpers (D-03
 * regression guard) + the Clerk identity gate on write mutations (T-104-01).
 *
 * Mutation handlers are exercised via `._handler`, the raw function Convex's
 * mutation()/query() wrappers expose (see node_modules/convex/dist/cjs/
 * server/impl/registration_impl.js — `q._handler = func`; already used this
 * way by convex/remindersIngest.test.ts). This gives full-fidelity coverage
 * of the identity gate and validation without needing convex-test (not
 * installed in this repo).
 */
import { describe, it, expect } from "vitest";
import {
  buildRateIndex,
  resolveRate,
  priceTokens,
  create,
  seedDefaults,
  buildSeedSet,
  type PricingRow,
} from "./modelPricing";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeRow(overrides: Partial<PricingRow> & { model: string }): PricingRow {
  return {
    _id: `row_${overrides.model}` as unknown as PricingRow["_id"],
    inputPerToken: 0.000003,
    outputPerToken: 0.000015,
    source: "manual",
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// resolveRate — D-03: exactly two hit paths, one miss path, no default fallback
// ---------------------------------------------------------------------------

describe("modelPricing.resolveRate", () => {
  it("returns via:'model' for an exact model hit", () => {
    const rows = [makeRow({ model: "claude-sonnet-5" })];
    const index = buildRateIndex(rows);

    const result = resolveRate(
      { provider: "anthropic_direct", model: "claude-sonnet-5", billingType: "api" },
      index
    );

    expect(result).not.toBeNull();
    expect(result!.via).toBe("model");
    expect(result!.rate.model).toBe("claude-sonnet-5");
  });

  it("returns null for an unknown model with billingType 'api' — never falls back to a 'default' row (D-03)", () => {
    const rows = [
      makeRow({ model: "claude-sonnet-5" }),
      makeRow({ model: "default", inputPerToken: 0.000003, outputPerToken: 0.000015 }),
    ];
    const index = buildRateIndex(rows);

    const result = resolveRate(
      { provider: "anthropic_direct", model: "some-unknown-model", billingType: "api" },
      index
    );

    expect(result).toBeNull();
  });

  it("returns via:'shadow' for an unknown model with billingType 'subscription' whose provider has a shadow row", () => {
    const rows = [
      makeRow({ model: "claude-cli", shadowForProvider: "claude-cli" }),
    ];
    const index = buildRateIndex(rows);

    const result = resolveRate(
      { provider: "claude-cli", model: "unknown-opaque-id", billingType: "subscription" },
      index
    );

    expect(result).not.toBeNull();
    expect(result!.via).toBe("shadow");
    expect(result!.rate.shadowForProvider).toBe("claude-cli");
  });

  it("returns null for an unknown model with billingType 'subscription' whose provider has no shadow row", () => {
    const rows = [makeRow({ model: "claude-cli", shadowForProvider: "claude-cli" })];
    const index = buildRateIndex(rows);

    const result = resolveRate(
      { provider: "codex", model: "unknown-opaque-id", billingType: "subscription" },
      index
    );

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// priceTokens — arithmetic against a known rate
// ---------------------------------------------------------------------------

describe("modelPricing.priceTokens", () => {
  it("prices prompt and completion tokens against the rate's input/output rates", () => {
    const rate = makeRow({
      model: "claude-sonnet-5",
      inputPerToken: 3.0 / 1_000_000,
      outputPerToken: 15.0 / 1_000_000,
    });

    const cost = priceTokens(1_000_000, 500_000, rate);

    expect(cost).toBeCloseTo(3.0 + 7.5, 6);
  });

  it("ignores cache-token fields (not read this phase)", () => {
    const rate = makeRow({
      model: "claude-sonnet-5",
      inputPerToken: 0.000003,
      outputPerToken: 0.000015,
      cacheReadPerToken: 999,
      cacheWritePerToken: 999,
    });

    const cost = priceTokens(100, 100, rate);

    expect(cost).toBeCloseTo(100 * 0.000003 + 100 * 0.000015, 9);
  });
});

// ---------------------------------------------------------------------------
// create mutation — identity gate + validation (T-104-01, T-104-02)
// ---------------------------------------------------------------------------

function makeCtx(overrides: { identity?: unknown; existing?: PricingRow[] } = {}) {
  const existing = overrides.existing ?? [];
  return {
    auth: {
      getUserIdentity: async () => overrides.identity ?? null,
    },
    db: {
      query(table: string) {
        void table;
        return {
          withIndex(_index: string, cb: (q: any) => any) {
            void _index;
            let matchedModel: string | undefined;
            const q = {
              eq(_field: string, value: string) {
                matchedModel = value;
                return q;
              },
            };
            cb(q);
            return {
              async first() {
                return existing.find((r) => r.model === matchedModel) ?? null;
              },
            };
          },
        };
      },
      async insert(_table: string, doc: unknown) {
        void _table;
        return { ...(doc as object), _id: "new_id" };
      },
    },
  };
}

describe("modelPricing.create — identity gate + validation", () => {
  it("throws 'Unauthenticated' when ctx.auth.getUserIdentity() resolves to null", async () => {
    const ctx = makeCtx({ identity: null });

    await expect(
      (create as any)._handler(ctx, {
        model: "claude-sonnet-5",
        inputPerToken: 0.000003,
        outputPerToken: 0.000015,
      })
    ).rejects.toThrow("Unauthenticated");
  });

  it("throws the per-token range message for a rate of 3.0 (per-Mtok value entered by mistake)", async () => {
    const ctx = makeCtx({ identity: { subject: "user_1" } });

    await expect(
      (create as any)._handler(ctx, {
        model: "claude-sonnet-5",
        inputPerToken: 3.0,
        outputPerToken: 15.0,
      })
    ).rejects.toThrow(/per token/i);
  });

  it("rejects a duplicate model", async () => {
    const ctx = makeCtx({
      identity: { subject: "user_1" },
      existing: [makeRow({ model: "claude-sonnet-5" })],
    });

    await expect(
      (create as any)._handler(ctx, {
        model: "claude-sonnet-5",
        inputPerToken: 0.000003,
        outputPerToken: 0.000015,
      })
    ).rejects.toThrow(/already exists/i);
  });

  it("rejects a shadowForProvider value that isn't a GATEWAY_PROVIDERS member", async () => {
    const ctx = makeCtx({ identity: { subject: "user_1" } });

    await expect(
      (create as any)._handler(ctx, {
        model: "some-model",
        inputPerToken: 0.000003,
        outputPerToken: 0.000015,
        shadowForProvider: "not-a-real-provider",
      })
    ).rejects.toThrow(/shadowForProvider/);
  });

  it("succeeds for an authenticated caller with valid per-token rates", async () => {
    const ctx = makeCtx({ identity: { subject: "user_1" } });

    const result = await (create as any)._handler(ctx, {
      model: "claude-sonnet-5",
      inputPerToken: 0.000003,
      outputPerToken: 0.000015,
    });

    expect(result).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// seedDefaults — idempotent, additive-only (Task 3)
// ---------------------------------------------------------------------------

/** A mutable in-memory modelPricing table, so idempotency can be tested across two calls. */
function makeSeedCtx() {
  const store: Array<Record<string, unknown> & { model: string }> = [];
  const ctx = {
    db: {
      query(_table: string) {
        void _table;
        return {
          withIndex(_index: string, cb: (q: any) => any) {
            void _index;
            let matchedModel: string | undefined;
            const q = {
              eq(_field: string, value: string) {
                matchedModel = value;
                return q;
              },
            };
            cb(q);
            return {
              async first() {
                return store.find((r) => r.model === matchedModel) ?? null;
              },
            };
          },
        };
      },
      async insert(_table: string, doc: Record<string, unknown> & { model: string }) {
        void _table;
        store.push(doc);
        return `id_${doc.model}`;
      },
    },
  };
  return { ctx, store };
}

describe("modelPricing.seedDefaults", () => {
  it("is idempotent — running the seed handler twice inserts each model exactly once", async () => {
    const { ctx, store } = makeSeedCtx();

    const first = await (seedDefaults as any)._handler(ctx);
    const countAfterFirst = store.length;
    expect(first.inserted).toBe(buildSeedSet().length);
    expect(countAfterFirst).toBe(buildSeedSet().length);

    const second = await (seedDefaults as any)._handler(ctx);
    expect(second.inserted).toBe(0);
    expect(store.length).toBe(countAfterFirst);

    // each model id appears exactly once
    const models = store.map((r) => r.model);
    expect(new Set(models).size).toBe(models.length);
  });

  it("produces rate rows for claude-sonnet-5, claude-opus-5, and claude-fable-5", async () => {
    const { ctx, store } = makeSeedCtx();
    await (seedDefaults as any)._handler(ctx);

    for (const model of ["claude-sonnet-5", "claude-opus-5", "claude-fable-5"]) {
      const row = store.find((r) => r.model === model);
      expect(row, `expected a seeded row for ${model}`).toBeDefined();
      expect(row!.inputPerToken).toBeGreaterThan(0);
      expect(row!.outputPerToken).toBeGreaterThan(0);
    }
  });

  it("seeds no row named 'default' (D-03 regression guard)", async () => {
    const { ctx, store } = makeSeedCtx();
    await (seedDefaults as any)._handler(ctx);

    expect(store.some((r) => r.model === "default")).toBe(false);
  });

  it("seeds a claude-cli shadow row with shadowForProvider === 'claude-cli'", async () => {
    const { ctx, store } = makeSeedCtx();
    await (seedDefaults as any)._handler(ctx);

    const shadowRow = store.find(
      (r) => r.model === "claude-cli" && r.shadowForProvider === "claude-cli"
    );
    expect(shadowRow).toBeDefined();
  });

  it("seeds shadow rows for codex and antigravity but not claude-sdk", async () => {
    const { ctx, store } = makeSeedCtx();
    await (seedDefaults as any)._handler(ctx);

    expect(store.some((r) => r.shadowForProvider === "codex")).toBe(true);
    expect(store.some((r) => r.shadowForProvider === "antigravity")).toBe(true);
    expect(store.some((r) => r.shadowForProvider === "claude-sdk")).toBe(false);
  });
});
